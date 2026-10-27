'use strict';
const { created, noContent } = require('../lib/router');
const { E } = require('../lib/errors');
const { validate, intParam } = require('../lib/validate');
const { toDb, parseDb } = require('../lib/dates');
const { dropView } = require('../services/drops');
const { productView, PRODUCT_SELECT } = require('../services/presenters');

const DROP = {
  number: { type: 'int', required: true, min: 1, max: 9999 },
  name: { type: 'string', required: true, min: 2, max: 80 },
  tagline: { type: 'string', max: 160, nullable: true },
  description: { type: 'string', max: 5000, nullable: true },
  starts_at: { type: 'datetime', required: true },
  ends_at: { type: 'datetime', required: true },
  min_level: { type: 'int', min: 1, max: 10, default: 1 },
  early_access_level: { type: 'int', min: 1, max: 10, nullable: true },
  early_access_hours: { type: 'int', min: 0, max: 720, default: 0 },
  max_per_user: { type: 'int', min: 1, max: 50, default: 2 },
};

const lvl = u => (u ? u.level_number : 0);

module.exports = router => {
  const withProducts = async (db, row, user) => {
    const view = await dropView(db, row, user, lvl(user));
    const prods = await db.all(`${PRODUCT_SELECT} WHERE p.drop_id = ? AND p.active = 1 ORDER BY p.id`, [row.id]);
    view.products = prods.map(productView);
    return view;
  };

  router.get('/api/drops', { auth: 'optional' }, async ({ db, user }) => {
    const rows = await db.all('SELECT * FROM drops ORDER BY starts_at DESC');
    return Promise.all(rows.map(r => dropView(db, r, user, lvl(user))));
  });

  router.get('/api/drops/current', { auth: 'optional' }, async ({ db, user }) => {
    const now = toDb(new Date());
    const row =
      await db.get('SELECT * FROM drops WHERE starts_at <= ? AND ends_at > ? ORDER BY starts_at DESC LIMIT 1', [now, now]) ||
      await db.get('SELECT * FROM drops WHERE starts_at > ? ORDER BY starts_at ASC LIMIT 1', [now]) ||
      await db.get('SELECT * FROM drops ORDER BY ends_at DESC LIMIT 1');
    if (!row) throw E.notFound('Drop');
    return withProducts(db, row, user);
  });

  router.get('/api/drops/:id', { auth: 'optional' }, async ({ db, user, params }) => {
    const row = await db.get('SELECT * FROM drops WHERE id = ?', [intParam(params.id, 'Drop')]);
    if (!row) throw E.notFound('Drop');
    return withProducts(db, row, user);
  });

  const check = d => {
    if (d.starts_at && d.ends_at && d.ends_at <= d.starts_at) throw E.invalid('Dados inválidos', { ends_at: 'deve ser depois do início' });
  };

  router.post('/api/drops', { auth: 'admin' }, async ({ db, user, body }) => {
    const d = validate(body, DROP);
    check(d);
    if (await db.get('SELECT id FROM drops WHERE number = ?', [d.number])) throw E.conflict('Já existe um drop com esse número', 'DROP_NUMBER_TAKEN');
    const { insertId } = await db.run(
      `INSERT INTO drops (number, name, tagline, description, starts_at, ends_at, min_level, early_access_level, early_access_hours, max_per_user, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [d.number, d.name, d.tagline ?? null, d.description ?? null, toDb(d.starts_at), toDb(d.ends_at), d.min_level, d.early_access_level ?? null, d.early_access_hours, d.max_per_user, toDb(new Date())]);
    return created(await withProducts(db, await db.get('SELECT * FROM drops WHERE id = ?', [insertId]), user));
  });

  router.put('/api/drops/:id', { auth: 'admin' }, async ({ db, user, params, body }) => {
    const id = intParam(params.id, 'Drop');
    const d = validate(body, DROP, { partial: true });
    const cur = await db.get('SELECT * FROM drops WHERE id = ?', [id]);
    if (!cur) throw E.notFound('Drop');
    check({ starts_at: d.starts_at || parseDb(cur.starts_at), ends_at: d.ends_at || parseDb(cur.ends_at) });
    if (d.number !== undefined && await db.get('SELECT id FROM drops WHERE number = ? AND id <> ?', [d.number, id])) {
      throw E.conflict('Já existe um drop com esse número', 'DROP_NUMBER_TAKEN');
    }
    const sets = []; const vals = [];
    for (const [k, v] of Object.entries(d)) { sets.push(`${k} = ?`); vals.push(v instanceof Date ? toDb(v) : v); }
    if (sets.length) await db.run(`UPDATE drops SET ${sets.join(', ')} WHERE id = ?`, [...vals, id]);
    return withProducts(db, await db.get('SELECT * FROM drops WHERE id = ?', [id]), user);
  });

  router.delete('/api/drops/:id', { auth: 'admin' }, async ({ db, params }) => {
    const id = intParam(params.id, 'Drop');
    if (!await db.get('SELECT id FROM drops WHERE id = ?', [id])) throw E.notFound('Drop');
    if ((await db.get('SELECT COUNT(*) AS n FROM orders WHERE drop_id = ?', [id])).n > 0) {
      throw E.conflict('Drop possui pedidos e não pode ser excluído', 'DROP_HAS_ORDERS');
    }
    await db.run('DELETE FROM drops WHERE id = ?', [id]);
    return noContent();
  });
};
