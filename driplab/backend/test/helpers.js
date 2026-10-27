'use strict';
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_FILE = ':memory:';
process.env.AUTH_RATE_MAX = '100000';
process.env.JWT_SECRET = 'segredo-de-teste-com-mais-de-trinta-e-dois-caracteres-ok';

const config = require('../src/config');
const { createDb } = require('../src/db');
const { applyMigrations } = require('../src/db/migrator');
const { seed } = require('../src/db/seed');
const { buildServer } = require('../src/app');

async function start(opts = {}) {
  const cfg = { ...config, ...opts };
  const db = createDb(cfg.db);
  await applyMigrations(db, cfg.migrationsDir);
  await seed(db);
  const { server, openapi, router } = buildServer({ db, config: cfg });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  async function call(method, url, { token, body, raw } = {}) {
    const res = await fetch(base + url, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : (raw ? body : JSON.stringify(body)),
    });
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch { }
    return { status: res.status, body: json, text, headers: res.headers };
  }
  const login = async (email, password) => (await call('POST', '/api/auth/login', { body: { email, password } })).body.token;
  let n = 0;
  const newUser = async (extra = {}) => {
    n++;
    const r = await call('POST', '/api/auth/register', { body: { name: `Tester ${n}`, email: `t${n}_${Date.now()}@x.com`, password: 'Senha123', ...extra } });
    return { token: r.body.token, user: r.body.user, res: r };
  };
  const addXp = (userId, xp) => db.run('UPDATE users SET xp = ? WHERE id = ?', [xp, userId]);
  return { db, server, base, call, login, newUser, addXp, openapi, router, close: async () => { server.close(); server.closeAllConnections?.(); await db.close(); } };
}
module.exports = { start };
