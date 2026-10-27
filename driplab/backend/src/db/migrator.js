'use strict';
const fs = require('fs');
const path = require('path');

function statements(sql) {
  return sql.split(/\r?\n/).filter(l => !l.trim().startsWith('--')).join('\n')
    .split(/;[ \t]*(?:\r?\n|$)/).map(s => s.trim()).filter(Boolean);
}

function toSqlite(stmt) {
  return stmt
    .replace(/INT AUTO_INCREMENT PRIMARY KEY/g, 'INTEGER PRIMARY KEY AUTOINCREMENT')
    .replace(/\)\s*ENGINE=InnoDB[^;]*$/g, ')');
}

async function applyMigrations(db, dir, log = () => {}) {
  await db.run('CREATE TABLE IF NOT EXISTS schema_migrations (filename VARCHAR(100) PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  const done = new Set((await db.all('SELECT filename FROM schema_migrations')).map(r => r.filename));
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  let n = 0;
  for (const f of files) {
    if (done.has(f)) { log(`  = ${f} (já aplicada)`); continue; }
    for (const st of statements(fs.readFileSync(path.join(dir, f), 'utf8'))) {
      await db.run(db.client === 'sqlite' ? toSqlite(st) : st);
    }
    await db.run('INSERT INTO schema_migrations (filename) VALUES (?)', [f]);
    log(`  + ${f}`); n++;
  }
  return n;
}
module.exports = { applyMigrations, statements };
