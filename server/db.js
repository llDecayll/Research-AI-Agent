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

const defaultSettings = {
  provider: 'gemini',
  apiKeys: {
    gemini: '',
    openai: '',
    anthropic: '',
    openrouter: ''
  }
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
    apiKeys: readSetting('apiKeys') ?? defaultSettings.apiKeys
  };
}

export function saveSettings(settings) {
  const merged = {
    provider: settings.provider ?? defaultSettings.provider,
    apiKeys: {
      ...defaultSettings.apiKeys,
      ...(settings.apiKeys ?? {})
    }
  };

  writeSetting('provider', merged.provider);
  writeSetting('apiKeys', merged.apiKeys);
  return merged;
}

export function listHistory() {
  const rows = db.prepare(`
    SELECT id, industry, context, date, report, provider_used, tree_snapshot, created_at
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
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    item.id,
    item.industry,
    item.context,
    item.date,
    item.report,
    item.providerUsed,
    JSON.stringify(item.treeSnapshot),
    item.createdAt
  );

  return item;
}

export function getDatabaseInfo() {
  return { path: dbPath };
}
