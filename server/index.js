import express from 'express';
import { randomUUID } from 'node:crypto';
import {
  getDatabaseInfo,
  getSettings,
  insertHistoryRun,
  listHistory,
  saveSettings,
  listSchedules,
  insertSchedule,
  updateSchedule,
  deleteSchedule,
  getDueSchedules
} from './db.js';
import { runOrchestratorDetailed } from '../src/orchestrator/engine.js';

const app = express();
const port = Number(process.env.PORT || 4000);
const jobs = new Map();
const jobTtlMs = 1000 * 60 * 60;

app.use(express.json({ limit: '2mb' }));

function createJob() {
  const id = randomUUID();
  const job = {
    id,
    status: 'running',
    events: [],
    result: null,
    error: null,
    createdAt: Date.now()
  };

  jobs.set(id, job);
  return job;
}

function pruneJobs() {
  const cutoff = Date.now() - jobTtlMs;
  for (const [jobId, job] of jobs.entries()) {
    if (job.createdAt < cutoff) {
      jobs.delete(jobId);
    }
  }
}

setInterval(pruneJobs, 1000 * 60 * 10).unref();

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    database: getDatabaseInfo()
  });
});

app.get('/api/settings', (_req, res) => {
  res.json(getSettings());
});

app.put('/api/settings', (req, res) => {
  const saved = saveSettings(req.body ?? {});
  res.json(saved);
});

app.get('/api/history', (_req, res) => {
  res.json(listHistory());
});

app.post('/api/orchestrations', (req, res) => {
  const { industry, context, activeTree, provider, field, location } = req.body ?? {};

  if (!industry || !context || !activeTree) {
    return res.status(400).json({ error: 'industry, context, and activeTree are required.' });
  }

  const settings = getSettings();
  const selectedProvider = provider || settings.provider || 'gemini';
  const apiKey = settings.apiKeys?.[selectedProvider] || null;
  const tavilyApiKey = settings.tavilyApiKey || null;
  const job = createJob();

  const pushEvent = (event) => {
    job.events.push({
      ...event,
      timestamp: new Date().toISOString()
    });
  };

  void (async () => {
    try {
      const { report, tree, analysis } = await runOrchestratorDetailed(industry, context, [], {
        apiKey,
        provider: selectedProvider,
        activeTree,
        onProgress: pushEvent,
        tavilyApiKey,
        goal: { industry, field: field || '', location: location || '' }
      });

      const historyItem = insertHistoryRun({
        id: randomUUID(),
        industry,
        context,
        date: new Date().toLocaleString(),
        report,
        providerUsed: apiKey ? selectedProvider : 'Mock Mode',
        treeSnapshot: tree,
        analysis,
        createdAt: new Date().toISOString()
      });

      job.status = 'complete';
      job.result = {
        report,
        treeSnapshot: tree,
        analysis,
        historyItem
      };
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown orchestration failure.';
      pushEvent({
        status: 'error',
        message: job.error
      });
    }
  })();

  return res.status(202).json({ jobId: job.id });
});

app.get('/api/orchestrations/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found.' });
  }

  return res.json({
    id: job.id,
    status: job.status,
    events: job.events,
    result: job.result,
    error: job.error
  });
});

// ── Phase 5: Scheduled recurring research ──────────────────────────────────

app.get('/api/schedules', (_req, res) => {
  res.json(listSchedules());
});

app.post('/api/schedules', (req, res) => {
  const { label, industry, context, field, location, provider, treeSnapshot, intervalMinutes } = req.body ?? {};

  if (!industry || !context || !treeSnapshot || !intervalMinutes) {
    return res.status(400).json({ error: 'industry, context, treeSnapshot, and intervalMinutes are required.' });
  }

  const settings = getSettings();
  const schedule = insertSchedule({
    id: randomUUID(),
    label: label || industry,
    industry,
    context,
    field: field || '',
    location: location || '',
    provider: provider || settings.provider || 'gemini',
    treeSnapshot,
    intervalMinutes: Number(intervalMinutes),
    active: true,
    lastRun: null,
    createdAt: new Date().toISOString()
  });

  return res.status(201).json(schedule);
});

app.patch('/api/schedules/:id', (req, res) => {
  const updated = updateSchedule(req.params.id, req.body ?? {});
  if (!updated) return res.status(404).json({ error: 'Schedule not found.' });
  return res.json(updated);
});

app.delete('/api/schedules/:id', (req, res) => {
  deleteSchedule(req.params.id);
  return res.status(204).end();
});

/** Run one schedule headlessly and persist the result to history. */
async function runScheduledJob(schedule) {
  const settings = getSettings();
  const provider = schedule.provider || settings.provider || 'gemini';
  const apiKey = settings.apiKeys?.[provider] || null;
  const tavilyApiKey = settings.tavilyApiKey || null;

  console.log(`[scheduler] Running "${schedule.label}" (${schedule.industry})`);

  const { report, tree, analysis } = await runOrchestratorDetailed(
    schedule.industry,
    schedule.context,
    [],
    {
      apiKey,
      provider,
      activeTree: schedule.treeSnapshot,
      tavilyApiKey,
      goal: { industry: schedule.industry, field: schedule.field, location: schedule.location }
    }
  );

  insertHistoryRun({
    id: randomUUID(),
    industry: schedule.industry,
    context: schedule.context,
    date: new Date().toLocaleString(),
    report,
    providerUsed: apiKey ? `${provider} (scheduled)` : 'Mock Mode (scheduled)',
    treeSnapshot: tree,
    analysis,
    createdAt: new Date().toISOString()
  });

  updateSchedule(schedule.id, { lastRun: new Date().toISOString() });
}

let schedulerBusy = false;
async function schedulerTick() {
  if (schedulerBusy) return;
  schedulerBusy = true;
  try {
    const due = getDueSchedules();
    for (const schedule of due) {
      try {
        await runScheduledJob(schedule);
      } catch (err) {
        console.error(`[scheduler] Job "${schedule.label}" failed:`, err.message);
        // Stamp lastRun anyway so a broken job doesn't hot-loop every tick.
        updateSchedule(schedule.id, { lastRun: new Date().toISOString() });
      }
    }
  } finally {
    schedulerBusy = false;
  }
}

// Check for due schedules every 30s.
setInterval(schedulerTick, 30 * 1000).unref();

app.listen(port, () => {
  console.log(`Research Orchestrator API listening on http://localhost:${port}`);
});
