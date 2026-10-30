'use strict';
const { created, noContent } = require('../lib/router');
const { E } = require('../lib/errors');
const { validate, intParam } = require('../lib/validate');
const { toDb } = require('../lib/dates');
const { productView, PRODUCT_SELECT } = require('../services/presenters');

const THEMES = ['black', 'green', 'purple', 'white'];
const CATEGORY = {
  slug: { type: 'string', required: true, min: 2, max: 40, pattern: /^[a-z0-9-]+$/, patternMsg: 'use minúsculas, números e hífen' },
  name: { type: 'string', required: true, min: 2, max: 60 },
};
const PRODUCT = {
  drop_id: { type: 'int', required: true, min: 1 },
  category_id: { type: 'int', required: true, min: 1 },
  name: { type: 'string', required: true, min: 2, max: 100 },
  subtitle: { type: 'string', max: 100, nullable: true },
  description: { type: 'string', max: 2000, nullable: true },
  price: { type: 'number', required: true, min: 0, max: 99999 },
  stock: { type: 'int', required: true, min: 0, max: 100000 },
  theme: { type: 'enum', values: THEMES, default: 'black' },
  badge_text: { type: 'string', max: 10, default: 'DL' },
  image_url: { type: 'string', max: 255, nullable: true },
  image_back_url: { type: 'string', max: 255, nullable: true },
  active: { type: 'bool', default: true },
};

module.exports = router => {
  //  categorias
  router.get('/api/categories', async ({ db }) => db.all('SELECT id, slug, name FROM categories ORDER BY id'));

  router.post('/api/categories', { auth: 'admin' }, async ({ db, body }) => {
    const d = validate(body, CATEGORY);
    if (await db.get('SELECT id FROM categories WHERE slug = ?', [d.slug])) throw E.conflict('Slug já existe', 'SLUG_TAKEN');
    const { insertId } = await db.run('INSERT INTO categories (slug, name) VALUES (?,?)', [d.slug, d.name]);
    return created(await db.get('SELECT id, slug, name FROM categories WHERE id = ?', [insertId]));
  });

  router.put('/api/categories/:id', { auth: 'admin' }, async ({ db, params, body }) => {
    const id = intParam(params.id, 'Categoria');
    const d = validate(body, CATEGORY, { partial: true });
    if (!await db.get('SELECT id FROM categories WHERE id = ?', [id])) throw E.notFound('Categoria');
    if (d.slug && await db.get('SELECT id FROM categories WHERE slug = ? AND id <> ?', [d.slug, id])) throw E.conflict('Slug já existe', 'SLUG_TAKEN');
    const keys = Object.keys(d);
    if (keys.length) await db.run(`UPDATE categories SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE id = ?`, [...keys.map(k => d[k]), id]);
    return db.get('SELECT id, slug, name FROM categories WHERE id = ?', [id]);
  });

  router.delete('/api/categories/:id', { auth: 'admin' }, async ({ db, params }) => {
    const id = intParam(params.id, 'Categoria');
    if (!await db.get('SELECT id FROM categories WHERE id = ?', [id])) throw E.notFound('Categoria');
    if ((await db.get('SELECT COUNT(*) AS n FROM products WHERE category_id = ?', [id])).n > 0) {
      throw E.conflict('Categoria possui produtos', 'CATEGORY_IN_USE');
    }
    await db.run('DELETE FROM categories WHERE id = ?', [id]);
    return noContent();
  });

  // produtos 
  router.get('/api/products', { auth: 'optional' }, async ({ db, user, query }) => {
    const where = []; const p = [];
    const showAll = user && user.role === 'admin' && query.get('include_inactive') === '1';
    if (!showAll) where.push('p.active = 1');
    const dropId = query.get('drop_id');
    if (dropId) { where.push('p.drop_id = ?'); p.push(intParam(dropId, 'drop_id')); }
    const cat = query.get('category');
    if (cat && cat !== 'all') { where.push('c.slug = ?'); p.push(cat); }
    const q = (query.get('q') || '').trim().slice(0, 60);
    if (q) { where.push('(p.name LIKE ? OR p.subtitle LIKE ?)'); p.push(`%${q}%`, `%${q}%`); }
    const rows = await db.all(`${PRODUCT_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY p.drop_id DESC, p.id`, p);
    return rows.map(productView);
  });

  router.get('/api/products/:id', async ({ db, params }) => {
    const row = await db.get(`${PRODUCT_SELECT} WHERE p.id = ?`, [intParam(params.id, 'Produto')]);
    if (!row) throw E.notFound('Produto');
    return productView(row);
  });

  async function checkRefs(db, d) {
    if (d.drop_id !== undefined && !await db.get('SELECT id FROM drops WHERE id = ?', [d.drop_id])) throw E.invalid('Dados inválidos', { drop_id: 'drop não existe' });
    if (d.category_id !== undefined && !await db.get('SELECT id FROM categories WHERE id = ?', [d.category_id])) throw E.invalid('Dados inválidos', { category_id: 'categoria não existe' });
  }

  router.post('/api/products', { auth: 'admin' }, async ({ db, body }) => {
    const d = validate(body, PRODUCT);
    await checkRefs(db, d);
    const { insertId } = await db.run(
            `INSERT INTO products (drop_id, category_id, name, subtitle, description, price, stock_initial, stock, theme, badge_text, image_url, image_back_url, active, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [d.drop_id, d.category_id, d.name, d.subtitle ?? null, d.description ?? null, d.price, d.stock, d.stock, d.theme, d.badge_text, d.image_url ?? null, d.image_back_url ?? null, d.active ? 1 : 0, toDb(new Date())]);
    return created(productView(await db.get(`${PRODUCT_SELECT} WHERE p.id = ?`, [insertId])));
  });

  router.put('/api/products/:id', { auth: 'admin' }, async ({ db, params, body }) => {
    const id = intParam(params.id, 'Produto');
    const d = validate(body, PRODUCT, { partial: true });
    const cur = await db.get('SELECT * FROM products WHERE id = ?', [id]);
    if (!cur) throw E.notFound('Produto');
    await checkRefs(db, d);
    const sets = []; const vals = [];
    for (const k of ['drop_id', 'category_id', 'name', 'subtitle', 'description', 'price', 'theme', 'badge_text', 'image_url', 'image_back_url']) {
      if (d[k] !== undefined) { sets.push(`${k} = ?`); vals.push(d[k]); }
    }
    if (d.active !== undefined) { sets.push('active = ?'); vals.push(d.active ? 1 : 0); }
    if (d.stock !== undefined) {
      sets.push('stock = ?'); vals.push(d.stock);
      if (d.stock > cur.stock_initial) { sets.push('stock_initial = ?'); vals.push(d.stock); }
    }
    if (sets.length) await db.run(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`, [...vals, id]);
    return productView(await db.get(`${PRODUCT_SELECT} WHERE p.id = ?`, [id]));
  });

  router.delete('/api/products/:id', { auth: 'admin' }, async ({ db, params }) => {
    const id = intParam(params.id, 'Produto');
    if (!await db.get('SELECT id FROM products WHERE id = ?', [id])) throw E.notFound('Produto');
    if ((await db.get('SELECT COUNT(*) AS n FROM order_items WHERE product_id = ?', [id])).n > 0) {
      throw E.conflict('Produto já foi vendido; desative-o (active=false) em vez de excluir', 'PRODUCT_HAS_ORDERS');
    }
    await db.run('DELETE FROM products WHERE id = ?', [id]);
    return noContent();
  });
};
