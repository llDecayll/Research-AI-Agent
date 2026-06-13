import express from 'express';
import { randomUUID } from 'node:crypto';
import {
  getDatabaseInfo,
  getSettings,
  insertHistoryRun,
  listHistory,
  saveSettings
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
  const { industry, context, activeTree, provider } = req.body ?? {};

  if (!industry || !context || !activeTree) {
    return res.status(400).json({ error: 'industry, context, and activeTree are required.' });
  }

  const settings = getSettings();
  const selectedProvider = provider || settings.provider || 'gemini';
  const apiKey = settings.apiKeys?.[selectedProvider] || null;
  const job = createJob();

  const pushEvent = (event) => {
    job.events.push({
      ...event,
      timestamp: new Date().toISOString()
    });
  };

  void (async () => {
    try {
      const { report, tree } = await runOrchestratorDetailed(industry, context, [], {
        apiKey,
        provider: selectedProvider,
        activeTree,
        onProgress: pushEvent
      });

      const historyItem = insertHistoryRun({
        id: randomUUID(),
        industry,
        context,
        date: new Date().toLocaleString(),
        report,
        providerUsed: apiKey ? selectedProvider : 'Mock Mode',
        treeSnapshot: tree,
        createdAt: new Date().toISOString()
      });

      job.status = 'complete';
      job.result = {
        report,
        treeSnapshot: tree,
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

app.listen(port, () => {
  console.log(`Research Orchestrator API listening on http://localhost:${port}`);
});
