'use strict';
function createDb(cfg) {
  if (cfg.client === 'sqlite') return require('./sqlite').createSqlite(cfg.sqliteFile);
  return require('./mysql').createMysql(cfg);
}
module.exports = { createDb };
