'use strict';
const { created, noContent } = require('../lib/router');
const { E } = require('../lib/errors');
const { validate, intParam, queryInt } = require('../lib/validate');
const { toDb, iso } = require('../lib/dates');
const { award, XP, getLevels, levelInfo } = require('../services/gamification');
const { dropAccess, dropStatus } = require('../services/drops');

async function orderView(db, row) {
  const items = await db.all(
    `SELECT i.product_id, p.name, i.quantity, i.unit_price FROM order_items i JOIN products p ON p.id = i.product_id WHERE i.order_id = ? ORDER BY i.id`, [row.id]);
  const drop = await db.get('SELECT id, number, name FROM drops WHERE id = ?', [row.drop_id]);
  return {
    id: row.id, user_id: row.user_id, status: row.status, total: Number(row.total), created_at: iso(row.created_at),
    drop, items: items.map(i => ({ product_id: i.product_id, name: i.name, quantity: i.quantity, unit_price: Number(i.unit_price) })),
  };
}

const MAX_LINES = 20;
const MAX_QTY = 10;

module.exports = router => {
  router.post('/api/orders', { auth: 'user' }, async ({ db, user, body }) => {
    if (!body || !Array.isArray(body.items) || body.items.length === 0) throw E.invalid('Dados inválidos', { items: 'envie ao menos um item' });
    if (body.items.length > MAX_LINES) throw E.invalid('Dados inválidos', { items: `máximo de ${MAX_LINES} linhas` });
    const wanted = new Map(); 
    body.items.forEach((it, i) => {
      const x = validate(it, { product_id: { type: 'int', required: true, min: 1 }, quantity: { type: 'int', required: true, min: 1, max: MAX_QTY } });
      wanted.set(x.product_id, (wanted.get(x.product_id) || 0) + x.quantity);
    });
    const ids = [...wanted.keys()].sort((a, b) => a - b); 

    const result = await db.tx(async t => {
      const products = [];
      for (const id of ids) { 
        const p = await t.get('SELECT * FROM products WHERE id = ? FOR UPDATE', [id]);
        if (!p || !p.active) throw E.invalid('Dados inválidos', { items: `produto ${id} não está disponível` });
        products.push(p);
      }
      const dropId = products[0].drop_id;
      if (products.some(p => p.drop_id !== dropId)) throw E.rule('Cada pedido deve conter peças de um único drop', 'MIXED_DROPS');
      const drop = await t.get('SELECT * FROM drops WHERE id = ?', [dropId]);
      const me = await t.get('SELECT xp FROM users WHERE id = ?', [user.id]);
      const level = levelInfo(await getLevels(t), me.xp).number;

      const access = dropAccess(drop, user, level);
      if (!access.can_buy) {
        const msg = {
          level: [`Este drop exige nível ${drop.min_level}. Você está no nível ${level}.`, 'LEVEL_TOO_LOW'],
          ended: ['Este drop já foi encerrado.', 'DROP_ENDED'],
          not_started: [dropStatus(drop) === 'upcoming' && drop.early_access_level
            ? `Este drop ainda não começou. Acesso antecipado a partir do nível ${drop.early_access_level}.` : 'Este drop ainda não começou.', 'DROP_NOT_STARTED'],
        }[access.reason] || ['Compra não permitida', 'FORBIDDEN'];
        throw E.rule(msg[0], msg[1]);
      }

      const already = await t.get(
        `SELECT COALESCE(SUM(i.quantity),0) AS n FROM order_items i JOIN orders o ON o.id = i.order_id
         WHERE o.user_id = ? AND o.drop_id = ? AND o.status = 'confirmed'`, [user.id, dropId]);
      const requested = [...wanted.values()].reduce((a, b) => a + b, 0);
      if (Number(already.n) + requested > drop.max_per_user) {
        throw E.rule(`Limite de ${drop.max_per_user} peça(s) por pessoa neste drop (você já comprou ${Number(already.n)}).`, 'LIMIT_PER_USER');
      }
      for (const p of products) {
        if (p.stock < wanted.get(p.id)) {
          throw E.conflict(p.stock === 0 ? `${p.name} esgotou.` : `Só restam ${p.stock} unidade(s) de ${p.name}.`, 'OUT_OF_STOCK');
        }
      }

      const total = Math.round(products.reduce((s, p) => s + Number(p.price) * wanted.get(p.id), 0) * 100) / 100;
      const { insertId: orderId } = await t.run('INSERT INTO orders (user_id, drop_id, status, total, created_at) VALUES (?,?,?,?,?)',
        [user.id, dropId, 'confirmed', total, toDb(new Date())]);
      for (const p of products) {
        const qty = wanted.get(p.id);
        const upd = await t.run('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?', [qty, p.id, qty]);
        if (upd.affectedRows !== 1) throw E.conflict(`${p.name} esgotou.`, 'OUT_OF_STOCK');
        await t.run('INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?,?,?,?)', [orderId, p.id, qty, p.price]);
      }
      const gamification = await award(t, user.id, XP.PURCHASE_ITEM * requested, 'purchase', `Pedido #${orderId}`, orderId);
      return { orderId, gamification };
    });
    const row = await db.get('SELECT * FROM orders WHERE id = ?', [result.orderId]);
    return created({ ...(await orderView(db, row)), gamification: result.gamification });
  });

  router.get('/api/orders', { auth: 'user' }, async ({ db, user, query }) => {
    const limit = queryInt(query, 'limit', 50, { max: 200 });
    const all = user.role === 'admin' && query.get('scope') === 'all';
    const rows = all
      ? await db.all('SELECT * FROM orders ORDER BY id DESC LIMIT ?', [limit])
      : await db.all('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT ?', [user.id, limit]);
    return Promise.all(rows.map(r => orderView(db, r)));
  });

  const load = async (db, user, idParam) => {
    const row = await db.get('SELECT * FROM orders WHERE id = ?', [intParam(idParam, 'Pedido')]);
    if (!row || (row.user_id !== user.id && user.role !== 'admin')) throw E.notFound('Pedido'); 
    return row;
  };

  router.get('/api/orders/:id', { auth: 'user' }, async ({ db, user, params }) => orderView(db, await load(db, user, params.id)));

  // cancelar devolve o estoque e o xp
  router.post('/api/orders/:id/cancel', { auth: 'user' }, async ({ db, user, params }) => {
    const first = await load(db, user, params.id);
    await db.tx(async t => {
      const order = await t.get('SELECT * FROM orders WHERE id = ? FOR UPDATE', [first.id]);
      if (order.status !== 'confirmed') throw E.rule('Pedido já está cancelado', 'ALREADY_CANCELLED');
      const drop = await t.get('SELECT * FROM drops WHERE id = ?', [order.drop_id]);
      if (dropStatus(drop) === 'ended') throw E.rule('Não é possível cancelar após o encerramento do drop', 'DROP_ENDED');
      const items = await t.all('SELECT product_id, quantity FROM order_items WHERE order_id = ? ORDER BY product_id', [order.id]);
      for (const it of items) await t.run('UPDATE products SET stock = stock + ? WHERE id = ?', [it.quantity, it.product_id]);
      await t.run("UPDATE orders SET status = 'cancelled' WHERE id = ?", [order.id]);
      const qty = items.reduce((s, i) => s + i.quantity, 0);
      await award(t, order.user_id, -XP.PURCHASE_ITEM * qty, 'order_cancelled', `Pedido #${order.id} cancelado`, order.id);
    });
    return orderView(db, await db.get('SELECT * FROM orders WHERE id = ?', [first.id]));
  });

  router.delete('/api/orders/:id', { auth: 'admin' }, async ({ db, params }) => {
    const row = await db.get('SELECT * FROM orders WHERE id = ?', [intParam(params.id, 'Pedido')]);
    if (!row) throw E.notFound('Pedido');
    if (row.status !== 'cancelled') throw E.conflict('Cancele o pedido antes de excluí-lo', 'ORDER_NOT_CANCELLED');
    await db.run('DELETE FROM orders WHERE id = ?', [row.id]);
    return noContent();
  });
};
