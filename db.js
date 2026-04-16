const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'data.db'));

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS issues (
    id INTEGER PRIMARY KEY,
    desc TEXT NOT NULL,
    severity TEXT,
    sevClass TEXT,
    sevLabel TEXT,
    zone TEXT,
    author TEXT,
    timestamp TEXT,
    status TEXT DEFAULT 'open',
    tags TEXT,
    assignee TEXT,
    resolved_at TEXT,
    image TEXT
  );
`);

// Migration for existing tables
try { db.exec("ALTER TABLE issues ADD COLUMN resolved_at TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE issues ADD COLUMN image TEXT"); } catch(e) {}

db.exec(`

  CREATE TABLE IF NOT EXISTS feed (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    type TEXT,
    time TEXT
  );

  CREATE TABLE IF NOT EXISTS system_stats (
    key TEXT PRIMARY KEY,
    value INTEGER
  );
`);

// Seed initial data if empty
const issueCount = db.prepare('SELECT COUNT(*) as count FROM issues').get().count;

if (issueCount === 0) {
  const insertIssue = db.prepare(`
    INSERT INTO issues (id, desc, severity, sevClass, sevLabel, zone, author, timestamp, status, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const initialIssues = [
    { id: 1, severity: 'HIGH — Safety / structural', sevClass: 'high', sevLabel: 'HIGH', desc: 'Cable tray missing bracket — Panel Zone B', zone: 'Zone B', author: 'Ravi K.', timestamp: '08:22', status: 'open', tags: 'Safety, Structural' },
    { id: 2, severity: 'MED — Schedule risk', sevClass: 'med', sevLabel: 'MED', desc: 'Concrete pour ahead of BIM schedule', zone: 'Zone D', author: 'Auto-detected', timestamp: '07:54', status: 'open', tags: 'Schedule, Progress' },
    { id: 3, severity: 'HIGH — Safety / structural', sevClass: 'high', sevLabel: 'HIGH', desc: 'Zone C pipe alignment off-spec', zone: 'Zone C', author: 'Priya M.', timestamp: '09:05', status: 'open', tags: 'Structural, MEP' },
    { id: 4, severity: 'LOW — Minor observation', sevClass: 'ok', sevLabel: 'OK', desc: 'Structural column M-04 installed ✓', zone: 'Zone A', author: 'Priya M.', timestamp: '07:10', status: 'open', tags: 'Progress' }
  ];

  for (const issue of initialIssues) {
    insertIssue.run(issue.id, issue.desc, issue.severity, issue.sevClass, issue.sevLabel, issue.zone, issue.author, issue.timestamp, issue.status, issue.tags);
  }

  const insertFeed = db.prepare('INSERT INTO feed (text, type, time) VALUES (?, ?, ?)');
  const initialFeed = [
    { text: 'Zone A — Column M-04 progress logged & BIM synced', type: 'teal', time: '07:10' },
    { text: 'Zone D — Concrete pour ahead of schedule (auto-flagged)', type: 'amber', time: '07:54' },
    { text: 'Zone B — Cable tray bracket missing (voice captured)', type: 'red', time: '08:22' }
  ];

  for (const item of initialFeed) {
    insertFeed.run(item.text, item.type, item.time);
  }

  const insertStat = db.prepare('INSERT OR IGNORE INTO system_stats (key, value) VALUES (?, ?)');
  insertStat.run('total_captured', 23);
  insertStat.run('total_resolved', 19);
} else {
  // Migration for existing data without tags
  db.prepare("UPDATE issues SET tags = 'Safety, Structural' WHERE id = 1 AND (tags IS NULL OR tags = '')").run();
  db.prepare("UPDATE issues SET tags = 'Schedule, Progress' WHERE id = 2 AND (tags IS NULL OR tags = '')").run();
  db.prepare("UPDATE issues SET tags = 'Structural, MEP' WHERE id = 3 AND (tags IS NULL OR tags = '')").run();
  db.prepare("UPDATE issues SET tags = 'Progress' WHERE id = 4 AND (tags IS NULL OR tags = '')").run();
}



module.exports = db;
