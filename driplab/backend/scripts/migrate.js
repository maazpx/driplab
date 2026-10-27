'use strict';
const config = require('../src/config');
const { createDb } = require('../src/db');
const { applyMigrations } = require('../src/db/migrator');

(async () => {
  const { database, host, port, user, password } = config.db;
  if (config.db.client === 'mysql') {
    const mysql = require('mysql2/promise');
    const conn = await mysql.createConnection({ host, port, user, password });
    if (process.argv.includes('--reset')) {
      console.log(`! Recriando o banco "${database}"...`);
      await conn.query(`DROP DATABASE IF EXISTS \`${database}\``);
    }
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.end();
  }
  const db = createDb(config.db);
  try {
    const n = await applyMigrations(db, config.migrationsDir, console.log);
    console.log(n ? `\nOK: ${n} migration(s) aplicada(s).` : '\nBanco já está atualizado.');
  } finally { await db.close(); }
})().catch(e => { console.error('Erro na migration:', e.message); process.exit(1); });
