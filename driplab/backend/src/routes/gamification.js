'use strict';
const { created, noContent } = require('../lib/router');
const { E } = require('../lib/errors');
const { validate, intParam } = require('../lib/validate');
const { toDb, iso } = require('../lib/dates');
const { randomCode } = require('../lib/security');
const { RULES, getLevels, levelInfo } = require('../services/gamification');

const BADGE = {
  code: { type: 'string', required: true, min: 2, max: 40, pattern: /^[A-Z0-9_]+$/, patternMsg: 'use MAIÚSCULAS, números e _' },
  name: { type: 'string', required: true, min: 2, max: 80 },
  description: { type: 'string', required: true, min: 2, max: 255 },
  icon: { type: 'string', max: 10, default: '★' },
};
const REWARD = {
  name: { type: 'string', required: true, min: 2, max: 80 },
  description: { type: 'string', required: true, min: 2, max: 255 },
  min_level: { type: 'int', min: 1, max: 10, default: 1 },
  stock: { type: 'int', min: 0, max: 100000, nullable: true },
  active: { type: 'bool', default: true },
};

module.exports = router => {
  router.get('/api/gamification/levels', async ({ db }) => getLevels(db));
  router.get('/api/gamification/rules', async () => RULES);

  router.get('/api/gamification/me', { auth: 'user' }, async ({ db, user }) => {
    const levels = await getLevels(db);
    const badges = await db.all(
      `SELECT b.code, b.name, b.description, b.icon, ub.awarded_at FROM badges b
       LEFT JOIN user_badges ub ON ub.badge_id = b.id AND ub.user_id = ? ORDER BY b.id`, [user.id]);
    const history = await db.all('SELECT amount, reason, description, created_at FROM xp_transactions WHERE user_id = ? ORDER BY id DESC LIMIT 20', [user.id]);
    return {
      xp: user.xp, level: levelInfo(levels, user.xp),
      badges: badges.map(b => ({ code: b.code, name: b.name, description: b.description, icon: b.icon, earned: !!b.awarded_at, awarded_at: iso(b.awarded_at) })),
      history: history.map(h => ({ amount: h.amount, reason: h.reason, description: h.description, created_at: iso(h.created_at) })),
    };
  });

  // badges (CRUD)
  router.get('/api/badges', async ({ db }) => db.all('SELECT id, code, name, description, icon FROM badges ORDER BY id'));

  router.post('/api/badges', { auth: 'admin' }, async ({ db, body }) => {
    const d = validate(body, BADGE);
    if (await db.get('SELECT id FROM badges WHERE code = ?', [d.code])) throw E.conflict('Código de badge já existe', 'CODE_TAKEN');
    const { insertId } = await db.run('INSERT INTO badges (code, name, description, icon) VALUES (?,?,?,?)', [d.code, d.name, d.description, d.icon]);
    return created(await db.get('SELECT id, code, name, description, icon FROM badges WHERE id = ?', [insertId]));
  });

  router.put('/api/badges/:id', { auth: 'admin' }, async ({ db, params, body }) => {
    const id = intParam(params.id, 'Badge');
    const d = validate(body, BADGE, { partial: true });
    if (!await db.get('SELECT id FROM badges WHERE id = ?', [id])) throw E.notFound('Badge');
    if (d.code && await db.get('SELECT id FROM badges WHERE code = ? AND id <> ?', [d.code, id])) throw E.conflict('Código de badge já existe', 'CODE_TAKEN');
    const keys = Object.keys(d);
    if (keys.length) await db.run(`UPDATE badges SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE id = ?`, [...keys.map(k => d[k]), id]);
    return db.get('SELECT id, code, name, description, icon FROM badges WHERE id = ?', [id]);
  });

  router.delete('/api/badges/:id', { auth: 'admin' }, async ({ db, params }) => {
    const id = intParam(params.id, 'Badge');
    if (!await db.get('SELECT id FROM badges WHERE id = ?', [id])) throw E.notFound('Badge');
    await db.run('DELETE FROM badges WHERE id = ?', [id]);
    return noContent();
  });

  //    recompensas CRUD + resgate
  const rewardView = (r, level, claim) => ({
    id: r.id, name: r.name, description: r.description, min_level: r.min_level, stock: r.stock, active: !!r.active,
    unlocked: level >= r.min_level, claimed: !!claim, claim_code: claim ? claim.code : null,
    sold_out: r.stock !== null && r.stock <= 0,
  });

  router.get('/api/rewards', { auth: 'optional' }, async ({ db, user }) => {
    const showAll = user && user.role === 'admin';
    const rows = await db.all(`SELECT * FROM rewards ${showAll ? '' : 'WHERE active = 1'} ORDER BY min_level, id`);
    const claims = user ? await db.all('SELECT reward_id, code FROM user_rewards WHERE user_id = ?', [user.id]) : [];
    const byReward = new Map(claims.map(c => [c.reward_id, c]));
    return rows.map(r => rewardView(r, user ? user.level_number : 0, byReward.get(r.id)));
  });

  router.get('/api/rewards/mine', { auth: 'user' }, async ({ db, user }) => {
    const rows = await db.all(
      `SELECT r.id, r.name, r.description, ur.code, ur.claimed_at FROM user_rewards ur JOIN rewards r ON r.id = ur.reward_id WHERE ur.user_id = ? ORDER BY ur.id DESC`, [user.id]);
    return rows.map(r => ({ id: r.id, name: r.name, description: r.description, code: r.code, claimed_at: iso(r.claimed_at) }));
  });

  router.post('/api/rewards', { auth: 'admin' }, async ({ db, body }) => {
    const d = validate(body, REWARD);
    const { insertId } = await db.run('INSERT INTO rewards (name, description, min_level, stock, active) VALUES (?,?,?,?,?)',
      [d.name, d.description, d.min_level, d.stock ?? null, d.active ? 1 : 0]);
    return created(rewardView(await db.get('SELECT * FROM rewards WHERE id = ?', [insertId]), 0, null));
  });

  router.put('/api/rewards/:id', { auth: 'admin' }, async ({ db, params, body }) => {
    const id = intParam(params.id, 'Recompensa');
    const d = validate(body, REWARD, { partial: true });
    if (!await db.get('SELECT id FROM rewards WHERE id = ?', [id])) throw E.notFound('Recompensa');
    const sets = []; const vals = [];
    for (const [k, v] of Object.entries(d)) { sets.push(`${k} = ?`); vals.push(k === 'active' ? (v ? 1 : 0) : v); }
    if (sets.length) await db.run(`UPDATE rewards SET ${sets.join(', ')} WHERE id = ?`, [...vals, id]);
    return rewardView(await db.get('SELECT * FROM rewards WHERE id = ?', [id]), 0, null);
  });

  router.delete('/api/rewards/:id', { auth: 'admin' }, async ({ db, params }) => {
    const id = intParam(params.id, 'Recompensa');
    if (!await db.get('SELECT id FROM rewards WHERE id = ?', [id])) throw E.notFound('Recompensa');
    await db.run('DELETE FROM rewards WHERE id = ?', [id]);
    return noContent();
  });

  // pesgate exige nível mínimo, 1 por usuario
  router.post('/api/rewards/:id/claim', { auth: 'user' }, async ({ db, user, params }) => {
    const id = intParam(params.id, 'Recompensa');
    const code = await db.tx(async t => {
      const r = await t.get('SELECT * FROM rewards WHERE id = ? FOR UPDATE', [id]);
      if (!r || !r.active) throw E.notFound('Recompensa');
      const me = await t.get('SELECT xp FROM users WHERE id = ?', [user.id]);
      const level = levelInfo(await getLevels(t), me.xp).number;
      if (level < r.min_level) throw E.forbidden(`Recompensa liberada no nível ${r.min_level}. Você está no nível ${level}.`, 'LEVEL_TOO_LOW');
      if (await t.get('SELECT id FROM user_rewards WHERE user_id = ? AND reward_id = ?', [user.id, id])) throw E.conflict('Você já resgatou esta recompensa', 'ALREADY_CLAIMED');
      if (r.stock !== null) {
        const upd = await t.run('UPDATE rewards SET stock = stock - 1 WHERE id = ? AND stock > 0', [id]);
        if (upd.affectedRows !== 1) throw E.conflict('Recompensa esgotada', 'OUT_OF_STOCK');
      }
      const c = `DL-${randomCode(8)}`;
      await t.run('INSERT INTO user_rewards (user_id, reward_id, code, claimed_at) VALUES (?,?,?,?)', [user.id, id, c, toDb(new Date())]);
      return c;
    });
    return created({ reward_id: id, code });
  });
};
