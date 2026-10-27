'use strict';
const { created, noContent } = require('../lib/router');
const { E } = require('../lib/errors');
const { validate, intParam, queryInt } = require('../lib/validate');
const { hashPassword, verifyPassword, randomCode } = require('../lib/security');
const { toDb } = require('../lib/dates');
const { userView } = require('../services/presenters');
const { getLevels, levelInfo } = require('../services/gamification');

const PASSWORD_RULE = { type: 'string', required: true, min: 8, max: 72, pattern: /^(?=.*[A-Za-z])(?=.*\d).+$/, patternMsg: 'use letras e números' };

module.exports = router => {
  // ranking nome, xp e nível
  router.get('/api/users/ranking', async ({ db, query }) => {
    const limit = queryInt(query, 'limit', 10, { max: 50 });
    const rows = await db.all("SELECT name, xp FROM users WHERE role = 'user' ORDER BY xp DESC, id ASC LIMIT ?", [limit]);
    const levels = await getLevels(db);
    return rows.map((r, i) => ({ position: i + 1, name: r.name, xp: r.xp, level: levelInfo(levels, r.xp).number }));
  });

  router.get('/api/users', { auth: 'admin' }, async ({ db, query }) => {
    const limit = queryInt(query, 'limit', 50, { max: 200 });
    const offset = queryInt(query, 'offset', 0, { min: 0, max: 1e6 });
    const q = (query.get('q') || '').trim();
    const rows = q
      ? await db.all('SELECT * FROM users WHERE name LIKE ? OR email LIKE ? ORDER BY id LIMIT ? OFFSET ?', [`%${q}%`, `%${q}%`, limit, offset])
      : await db.all('SELECT * FROM users ORDER BY id LIMIT ? OFFSET ?', [limit, offset]);
    return Promise.all(rows.map(r => userView(db, r)));
  });

  router.post('/api/users', { auth: 'admin' }, async ({ db, body }) => {
    const d = validate(body, {
      name: { type: 'string', required: true, min: 2, max: 100 },
      email: { type: 'email', required: true, max: 160 },
      password: PASSWORD_RULE,
      role: { type: 'enum', values: ['user', 'admin'], default: 'user' },
    });
    if (await db.get('SELECT id FROM users WHERE email = ?', [d.email])) throw E.conflict('Este e-mail já está cadastrado', 'EMAIL_TAKEN');
    const { insertId } = await db.run(
      'INSERT INTO users (name, email, password_hash, role, xp, referral_code, created_at) VALUES (?,?,?,?,?,?,?)',
      [d.name, d.email, await hashPassword(d.password), d.role, 0, randomCode(8), toDb(new Date())]);
    return created(await userView(db, await db.get('SELECT * FROM users WHERE id = ?', [insertId])));
  });

  const loadTarget = async (db, user, idParam) => {
    const id = intParam(idParam, 'Usuário');
    if (user.id !== id && user.role !== 'admin') throw E.forbidden();
    const row = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!row) throw E.notFound('Usuário');
    return row;
  };

  router.get('/api/users/:id', { auth: 'user' }, async ({ db, user, params }) => userView(db, await loadTarget(db, user, params.id)));

  router.put('/api/users/:id', { auth: 'user' }, async ({ db, user, params, body }) => {
    const target = await loadTarget(db, user, params.id);
    const isAdmin = user.role === 'admin';
    const d = validate(body, {
      name: { type: 'string', min: 2, max: 100 },
      email: { type: 'email', max: 160 },
      password: { ...PASSWORD_RULE, required: false },
      current_password: { type: 'string', max: 200 },
      role: { type: 'enum', values: ['user', 'admin'] },
    }, { partial: true });
    if ((d.role !== undefined || d.email !== undefined) && !isAdmin) throw E.forbidden('Apenas administradores alteram e-mail ou perfil');
    if (d.role && target.id === user.id && d.role !== 'admin') throw E.rule('Você não pode remover seu próprio perfil de administrador', 'SELF_DEMOTE');
    if (d.password !== undefined && !isAdmin) {
      if (!d.current_password || !(await verifyPassword(d.current_password, target.password_hash))) {
        throw E.invalid('Dados inválidos', { current_password: 'senha atual incorreta' });
      }
    }
    if (d.email && d.email !== target.email && await db.get('SELECT id FROM users WHERE email = ?', [d.email])) {
      throw E.conflict('Este e-mail já está cadastrado', 'EMAIL_TAKEN');
    }
    const sets = []; const vals = [];
    for (const k of ['name', 'email', 'role']) if (d[k] !== undefined) { sets.push(`${k} = ?`); vals.push(d[k]); }
    if (d.password !== undefined) { sets.push('password_hash = ?'); vals.push(await hashPassword(d.password)); }
    if (sets.length) await db.run(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...vals, target.id]);
    return userView(db, await db.get('SELECT * FROM users WHERE id = ?', [target.id]));
  });

  router.delete('/api/users/:id', { auth: 'user' }, async ({ db, user, params }) => {
    const target = await loadTarget(db, user, params.id);
    if (target.role === 'admin') {
      const admins = await db.get("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'");
      if (admins.n <= 1) throw E.rule('Não é possível excluir o último administrador', 'LAST_ADMIN');
    }
    const orders = await db.get('SELECT COUNT(*) AS n FROM orders WHERE user_id = ?', [target.id]);
    if (orders.n > 0) throw E.conflict('Usuário possui pedidos e não pode ser excluído', 'USER_HAS_ORDERS');
    await db.run('DELETE FROM users WHERE id = ?', [target.id]);
    return noContent();
  });
};
