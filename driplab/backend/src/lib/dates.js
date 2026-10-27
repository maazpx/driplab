'use strict';
const pad = n => String(n).padStart(2, '0');
const toDb = d =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
const parseDb = s => (s == null ? null : s instanceof Date ? s : new Date(String(s).replace(' ', 'T') + 'Z'));
const iso = s => (s == null ? null : parseDb(s).toISOString());
module.exports = { toDb, parseDb, iso };
