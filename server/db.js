import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dataDir = path.resolve(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'research-orchestrator.db');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS history_runs (
    id TEXT PRIMARY KEY,
    industry TEXT NOT NULL,
    context TEXT NOT NULL,
    date TEXT NOT NULL,
    report TEXT NOT NULL,
    provider_used TEXT NOT NULL,
    tree_snapshot TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

// Migration: add the analysis column to pre-existing databases.
const historyColumns = db.prepare(`PRAGMA table_info(history_runs)`).all();
if (!historyColumns.some((c) => c.name === 'analysis')) {
  db.exec(`ALTER TABLE history_runs ADD COLUMN analysis TEXT`);
}

// Phase 5 — scheduled recurring research jobs.
db.exec(`
  CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    industry TEXT NOT NULL,
    context TEXT NOT NULL,
    field TEXT,
    location TEXT,
    provider TEXT NOT NULL,
    tree_snapshot TEXT NOT NULL,
    interval_minutes INTEGER NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    last_run TEXT,
    created_at TEXT NOT NULL
  );
`);

const defaultSettings = {
  provider: 'gemini',
  apiKeys: {
    gemini: '',
    openai: '',
    anthropic: '',
    openrouter: ''
  },
  tavilyApiKey: ''
};

function readSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? JSON.parse(row.value) : null;
}

function writeSetting(key, value) {
  db.prepare(`
    INSERT INTO settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, JSON.stringify(value));
}

export function getSettings() {
  return {
    provider: readSetting('provider') ?? defaultSettings.provider,
    apiKeys: readSetting('apiKeys') ?? defaultSettings.apiKeys,
    tavilyApiKey: readSetting('tavilyApiKey') ?? defaultSettings.tavilyApiKey
  };
}

export function saveSettings(settings) {
  const merged = {
    provider: settings.provider ?? defaultSettings.provider,
    apiKeys: {
      ...defaultSettings.apiKeys,
      ...(settings.apiKeys ?? {})
    },
    tavilyApiKey: settings.tavilyApiKey ?? defaultSettings.tavilyApiKey
  };

  writeSetting('provider', merged.provider);
  writeSetting('apiKeys', merged.apiKeys);
  writeSetting('tavilyApiKey', merged.tavilyApiKey);
  return merged;
}

export function listHistory() {
  const rows = db.prepare(`
    SELECT id, industry, context, date, report, provider_used, tree_snapshot, analysis, created_at
    FROM history_runs
    ORDER BY datetime(created_at) DESC
  `).all();

  return rows.map((row) => ({
    id: row.id,
    industry: row.industry,
    context: row.context,
    date: row.date,
    report: row.report,
    providerUsed: row.provider_used,
    treeSnapshot: JSON.parse(row.tree_snapshot),
    analysis: row.analysis ? JSON.parse(row.analysis) : null,
    createdAt: row.created_at
  }));
}

export function insertHistoryRun(item) {
  db.prepare(`
    INSERT INTO history_runs (
      id,
      industry,
      context,
      date,
      report,
      provider_used,
      tree_snapshot,
      analysis,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    item.id,
    item.industry,
    item.context,
    item.date,
    item.report,
    item.providerUsed,
    JSON.stringify(item.treeSnapshot),
    item.analysis ? JSON.stringify(item.analysis) : null,
    item.createdAt
  );

  return item;
}

function mapSchedule(row) {
  return {
    id: row.id,
    label: row.label,
    industry: row.industry,
    context: row.context,
    field: row.field || '',
    location: row.location || '',
    provider: row.provider,
    treeSnapshot: JSON.parse(row.tree_snapshot),
    intervalMinutes: row.interval_minutes,
    active: Boolean(row.active),
    lastRun: row.last_run,
    createdAt: row.created_at
  };
}

export function listSchedules() {
  const rows = db.prepare(`SELECT * FROM schedules ORDER BY datetime(created_at) DESC`).all();
  return rows.map(mapSchedule);
}

export function insertSchedule(item) {
  db.prepare(`
    INSERT INTO schedules (
      id, label, industry, context, field, location, provider,
      tree_snapshot, interval_minutes, active, last_run, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    item.id,
    item.label,
    item.industry,
    item.context,
    item.field || '',
    item.location || '',
    item.provider,
    JSON.stringify(item.treeSnapshot),
    item.intervalMinutes,
    item.active ? 1 : 0,
    item.lastRun || null,
    item.createdAt
  );
  return item;
}

export function updateSchedule(id, patch) {
  const existing = db.prepare(`SELECT * FROM schedules WHERE id = ?`).get(id);
  if (!existing) return null;

  const next = {
    active: patch.active !== undefined ? (patch.active ? 1 : 0) : existing.active,
    interval_minutes: patch.intervalMinutes ?? existing.interval_minutes,
    last_run: patch.lastRun !== undefined ? patch.lastRun : existing.last_run
  };

  db.prepare(`
    UPDATE schedules
    SET active = ?, interval_minutes = ?, last_run = ?
    WHERE id = ?
  `).run(next.active, next.interval_minutes, next.last_run, id);

  return mapSchedule(db.prepare(`SELECT * FROM schedules WHERE id = ?`).get(id));
}

export function deleteSchedule(id) {
  db.prepare(`DELETE FROM schedules WHERE id = ?`).run(id);
}

/** Schedules that are active and due to run now. */
export function getDueSchedules(nowMs = Date.now()) {
  return listSchedules().filter((s) => {
    if (!s.active) return false;
    if (!s.lastRun) return true;
    const last = new Date(s.lastRun).getTime();
    return nowMs - last >= s.intervalMinutes * 60 * 1000;
  });
}

export function getDatabaseInfo() {
  return { path: dbPath };
}
