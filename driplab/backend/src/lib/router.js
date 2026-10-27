'use strict';
class Router {
  constructor() { this.routes = []; }
  add(method, pattern, opts, handler) {
    if (typeof opts === 'function') { handler = opts; opts = {}; }
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:([a-zA-Z_]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
    this.routes.push({ method, pattern, re, keys, opts, handler });
  }
  get(...a) { this.add('GET', ...a); }
  post(...a) { this.add('POST', ...a); }
  put(...a) { this.add('PUT', ...a); }
  delete(...a) { this.add('DELETE', ...a); }
  match(method, path) {
    let pathMatched = false;
    for (const r of this.routes) {
      const m = r.re.exec(path);
      if (!m) continue;
      pathMatched = true;
      if (r.method !== method) continue;
      const params = {};
      r.keys.forEach((k, i) => { try { params[k] = decodeURIComponent(m[i + 1]); } catch { params[k] = m[i + 1]; } });
      return { route: r, params };
    }
    return { route: null, pathMatched };
  }
}
const created = body => ({ __status: 201, body });
const noContent = () => ({ __status: 204, body: null });
module.exports = { Router, created, noContent };
