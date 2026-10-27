'use strict';
const { created, noContent } = require('../lib/router');
const { E } = require('../lib/errors');
const { validate, intParam, queryInt } = require('../lib/validate');
const { toDb, iso } = require('../lib/dates');
const { award, XP, COMMENT_XP_DAILY_CAP } = require('../services/gamification');

const view = r => ({ id: r.id, drop_id: r.drop_id, user_id: r.user_id, author: r.author, body: r.body, created_at: iso(r.created_at) });
const SELECT = 'SELECT c.id, c.drop_id, c.user_id, c.body, c.created_at, u.name AS author FROM comments c JOIN users u ON u.id = c.user_id';
const BODY = { body: { type: 'string', required: true, min: 1, max: 500 } };

module.exports = router => {
  router.get('/api/drops/:id/comments', async ({ db, params, query }) => {
    const dropId = intParam(params.id, 'Drop');
    if (!await db.get('SELECT id FROM drops WHERE id = ?', [dropId])) throw E.notFound('Drop');
    const limit = queryInt(query, 'limit', 30, { max: 100 });
    const rows = await db.all(`${SELECT} WHERE c.drop_id = ? ORDER BY c.created_at DESC, c.id DESC LIMIT ?`, [dropId, limit]);
    return rows.map(view);
  });

  router.post('/api/drops/:id/comments', { auth: 'user' }, async ({ db, user, params, body }) => {
    const dropId = intParam(params.id, 'Drop');
    const d = validate(body, BODY);
    if (!await db.get('SELECT id FROM drops WHERE id = ?', [dropId])) throw E.notFound('Drop');
    const out = await db.tx(async t => {
      const now = new Date();
      const { insertId } = await t.run('INSERT INTO comments (user_id, drop_id, body, created_at) VALUES (?,?,?,?)', [user.id, dropId, d.body, toDb(now)]);
      const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const today = await t.get("SELECT COUNT(*) AS n FROM xp_transactions WHERE user_id = ? AND reason = 'comment' AND created_at >= ?", [user.id, toDb(startOfDay)]);
      const gamification = today.n < COMMENT_XP_DAILY_CAP
        ? await award(t, user.id, XP.COMMENT, 'comment', 'Comentário na comunidade', insertId)
        : await award(t, user.id, 0, 'comment'); // sem XP (limite diário), mas ainda avalia badges
      return { id: insertId, gamification };
    });
    return created({ ...view(await db.get(`${SELECT} WHERE c.id = ?`, [out.id])), gamification: out.gamification });
  });

  const load = async (db, user, idParam) => {
    const row = await db.get(`${SELECT} WHERE c.id = ?`, [intParam(idParam, 'Comentário')]);
    if (!row) throw E.notFound('Comentário');
    if (row.user_id !== user.id && user.role !== 'admin') throw E.forbidden();
    return row;
  };

  router.put('/api/comments/:id', { auth: 'user' }, async ({ db, user, params, body }) => {
    const row = await load(db, user, params.id);
    if (row.user_id !== user.id) throw E.forbidden('Só o autor edita o comentário');
    const d = validate(body, BODY);
    await db.run('UPDATE comments SET body = ? WHERE id = ?', [d.body, row.id]);
    return view(await db.get(`${SELECT} WHERE c.id = ?`, [row.id]));
  });

  router.delete('/api/comments/:id', { auth: 'user' }, async ({ db, user, params }) => {
    const row = await load(db, user, params.id);
    await db.run('DELETE FROM comments WHERE id = ?', [row.id]);
    return noContent();
  });
};
