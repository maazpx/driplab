'use strict';
const mysql = require('mysql2/promise');

function wrap(runner) {
  return {
    async all(sql, params = []) { const [rows] = await runner.query(sql, params); return rows; },
    async get(sql, params = []) { const [rows] = await runner.query(sql, params); return rows[0] || null; },
    async run(sql, params = []) {
      const [res] = await runner.query(sql, params);
      return { insertId: res.insertId, affectedRows: res.affectedRows };
    },
  };
}

function normalize(err) {
  if (err && err.code === 'ER_DUP_ENTRY') err.isDuplicate = true;
  return err;
}

function createMysql(cfg) {
  const pool = mysql.createPool({
    host: cfg.host, port: cfg.port, user: cfg.user, password: cfg.password, database: cfg.database,
    waitForConnections: true, connectionLimit: 10,
    dateStrings: true,      
    decimalNumbers: true,   
  });
  pool.pool.on('connection', c => c.query("SET time_zone = '+00:00'"));
  const base = wrap(pool);
  const guard = fn => async (...a) => { try { return await fn(...a); } catch (e) { throw normalize(e); } };

  async function tx(fn) {
    for (let attempt = 1; ; attempt++) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const t = wrap(conn);
        const t2 = { all: guard(t.all), get: guard(t.get), run: guard(t.run) };
        const result = await fn(t2);
        await conn.commit();
        return result;
      } catch (e) {
        try { await conn.rollback(); } catch {  }
        if (e && e.errno === 1213 && attempt < 3) continue; 
      } finally { conn.release(); }
    }
  }
  return { client: 'mysql', all: guard(base.all), get: guard(base.get), run: guard(base.run), tx, close: () => pool.end(), raw: pool };
}
module.exports = { createMysql };
