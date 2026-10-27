'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvFile(path.resolve(__dirname, '..', '.env'));

const env = process.env;
const isProd = env.NODE_ENV === 'production';

let jwtSecret = env.JWT_SECRET;
const weak = !jwtSecret || jwtSecret.length < 32 || jwtSecret.startsWith('troque-esta-chave');
if (weak) {
  if (isProd) throw new Error('Defina JWT_SECRET (32+ caracteres) no .env antes de rodar em produção.');
  jwtSecret = crypto.randomBytes(48).toString('hex');
  console.warn('[aviso] JWT_SECRET ausente/fraca: usando chave temporária (logins caem ao reiniciar). Defina uma no .env.');
}

module.exports = {
  env: env.NODE_ENV || 'development',
  isProd,
  port: Number(env.PORT) || 3000,
  jwtSecret,
  jwtExpiresSeconds: (Number(env.JWT_EXPIRES_HOURS) || 168) * 3600,
  corsOrigins: (env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
  authRateMax: Number(env.AUTH_RATE_MAX) || 20, 
  frontendDir: path.resolve(__dirname, '..', '..', 'frontend'),
  migrationsDir: path.resolve(__dirname, '..', '..', 'database', 'migrations'),
  db: {
    client: env.DB_CLIENT || 'mysql', 
    host: env.DB_HOST || '127.0.0.1',
    port: Number(env.DB_PORT) || 3306,
    user: env.DB_USER || 'root',
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME || 'driplab',
    sqliteFile: env.SQLITE_FILE || ':memory:',
  },
};
