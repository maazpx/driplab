'use strict';
const config = require('../src/config');
const { createDb } = require('../src/db');
const { seed } = require('../src/db/seed');

(async () => {
  const db = createDb(config.db);
  try { await seed(db, { log: console.log }); } finally { await db.close(); }
})().catch(e => { console.error('Erro no seed:', e.message); process.exit(1); });
