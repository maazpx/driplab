'use strict';
const { DatabaseSync } = require('node:sqlite');

const bind = params => params.map(p => (p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : p));
const adapt = sql => sql.replace(/\s+FOR UPDATE\b/gi, '');

function createSqlite(file = ':memory:') {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON');
  let chain = Promise.resolve();
  const exec = {
    all: async (sql, p = []) => db.prepare(adapt(sql)).all(...bind(p)).map(r => ({ ...r })),
    get: async (sql, p = []) => { const r = db.prepare(adapt(sql)).get(...bind(p)); return r ? { ...r } : null; },
    run: async (sql, p = []) => {
      const r = db.prepare(adapt(sql)).run(...bind(p));
      return { insertId: Number(r.lastInsertRowid), affectedRows: Number(r.changes) };
    },
  };
  const norm = e => { if (e && /UNIQUE constraint failed/i.test(e.message)) e.isDuplicate = true; return e; };
  const locked = fn => (...a) => {
    const p = chain.then(() => fn(...a));
    chain = p.catch(() => {});
    return p.catch(e => { throw norm(e); });
  };
  async function tx(fn) {
    return locked(async () => {
      db.exec('BEGIN');
      try { const r = await fn(exec); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
    })();
  }
  return { client: 'sqlite', all: locked(exec.all), get: locked(exec.get), run: locked(exec.run), tx, close: async () => db.close(), raw: db };
}
module.exports = { createSqlite };
