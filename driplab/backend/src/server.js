'use strict';
const config = require('./config');
const { createDb } = require('./db');
const { buildServer } = require('./app');

(async () => {
  const db = createDb(config.db);
  try { await db.get('SELECT 1 AS ok'); }
  catch (e) {
    console.error(`\nNão foi possível conectar ao banco (${config.db.host}:${config.db.port}, banco "${config.db.database}").`);
    console.error(`Motivo: ${e.message}\nConfira o .env e rode "npm run db:setup".\n`);
    process.exit(1);
  }
  const { server } = buildServer({ db, config });
  server.listen(config.port, () => {
    console.log(`DripLab rodando em http://localhost:${config.port}`);
    console.log(`Documentação da API:  http://localhost:${config.port}/api/docs`);
  });
  const stop = () => { server.close(() => db.close().then(() => process.exit(0))); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
})();
