'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Router } = require('./lib/router');
const { HttpError, E } = require('./lib/errors');
const { verifyJwt } = require('./lib/security');
const { getLevels, levelInfo } = require('./services/gamification');

const MAX_BODY = 100 * 1024;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.webp': 'image/webp', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2',
};
const CSP = "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; " +
  "img-src 'self' data:; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";

function sendJson(res, status, body) {
  const data = body === null || body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; let tooBig = false; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY) { tooBig = true; chunks.length = 0; return; } // descarta o excesso, mas deixa a resposta 413 chegar
      if (!tooBig) chunks.push(c);
    });
    req.on('end', () => {
      if (tooBig) return reject(new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Corpo da requisição muito grande'));
      if (!chunks.length) return resolve(undefined);
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(E.badRequest('JSON inválido no corpo da requisição')); }
    });
    req.on('error', reject);
  });
}

function createApp({ db, config, router, openapi }) {
  const attempts = new Map();
  function rateLimited(key, max) {
    const now = Date.now();
    const list = (attempts.get(key) || []).filter(ts => now - ts < 60000);
    list.push(now); attempts.set(key, list);
    if (attempts.size > 5000) for (const [k, v] of attempts) if (!v.some(ts => now - ts < 60000)) attempts.delete(k);
    return list.length > max;
  }

  async function authenticate(req) {
    const h = req.headers.authorization || '';
    const m = /^Bearer (.+)$/.exec(h);
    if (!m) return null;
    const payload = verifyJwt(m[1], config.jwtSecret);
    if (!payload) return null;
    const user = await db.get('SELECT id, name, email, role, xp, referral_code, created_at FROM users WHERE id = ?', [payload.sub]);
    if (!user) return null;
    user.level_number = levelInfo(await getLevels(db), user.xp).number;
    return user;
  }

  function serveStatic(req, res, pathname) {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    let rel = pathname === '/' ? '/index.html' : pathname;
    let file;
    try { file = path.resolve(config.frontendDir, '.' + decodeURIComponent(rel)); } catch { res.writeHead(400); return res.end(); }
    if (file !== config.frontendDir && !file.startsWith(config.frontendDir + path.sep)) { res.writeHead(403); return res.end(); }
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Não encontrado'); }
      const ext = path.extname(file).toLowerCase();
      const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': st.size };
      if (ext === '.html') headers['Content-Security-Policy'] = CSP;
      headers['Cache-Control'] = ['.png', '.jpg', '.jpeg', '.webp', '.svg'].includes(ext) ? 'public, max-age=3600' : 'no-cache';
      res.writeHead(200, headers);
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(file).pipe(res);
    });
  }

  const docsHtml = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>DripLab API — Swagger</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui.css"></head>
<body><div id="swagger-ui"></div>
<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({ url: '/api/openapi.json', dom_id: '#swagger-ui', persistAuthorization: true });</script></body></html>`;

  async function handleApi(req, res, url) {
    const pathname = url.pathname.replace(/\/+$/, '') || '/';
    if (pathname === '/api/docs') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(docsHtml); }
    if (pathname === '/api/openapi.json') return sendJson(res, 200, openapi);

    const { route, params, pathMatched } = router.match(req.method, pathname);
    if (!route) throw pathMatched ? new HttpError(405, 'METHOD_NOT_ALLOWED', 'Método não permitido') : E.notFound('Rota');

    if (route.opts.rateLimit && rateLimited(`${req.socket.remoteAddress}|${route.opts.rateLimit}`, config.authRateMax)) {
      throw new HttpError(429, 'TOO_MANY_REQUESTS', 'Muitas tentativas. Aguarde um minuto e tente de novo.');
    }
    const auth = route.opts.auth;
    let user = null;
    if (auth) {
      user = await authenticate(req);
      if (!user && auth !== 'optional') throw E.unauthorized();
      if (auth === 'admin' && user.role !== 'admin') throw E.forbidden('Apenas administradores');
    }
    let body;
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) body = await readBody(req);
    const out = await route.handler({ req, res, db, config, params, query: url.searchParams, body, user });
    if (out && out.__status) return sendJson(res, out.__status, out.body);
    return sendJson(res, 200, out === undefined ? { ok: true } : out);
  }

  return async function handler(req, res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    try {
      const url = new URL(req.url, 'http://localhost');
      const origin = req.headers.origin;
      if (origin && config.corsOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
      }
      if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
      if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
      return serveStatic(req, res, url.pathname);
    } catch (err) {
      if (err instanceof HttpError) {
        return sendJson(res, err.status, { error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) } });
      }
      console.error('[erro 500]', err);
      return sendJson(res, 500, { error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' } });
    }
  };
}

function buildServer({ db, config }) {
  const router = new Router();
  for (const name of ['auth', 'users', 'catalog', 'drops', 'orders', 'polls', 'comments', 'gamification']) {
    require(`./routes/${name}`)(router);
  }
  router.get('/api/health', async ({ db }) => { await db.get('SELECT 1 AS ok'); return { status: 'ok', db: db.client, time: new Date().toISOString() }; });
  const openapi = require('./openapi')(router);
  const handler = createApp({ db, config, router, openapi });
  return { server: http.createServer(handler), router, openapi };
}

module.exports = { buildServer };
