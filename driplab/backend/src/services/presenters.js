'use strict';
const { iso } = require('../lib/dates');
const { getLevels, levelInfo } = require('./gamification');

async function userView(db, row) {
  const levels = await getLevels(db);
  return {
    id: row.id, name: row.name, email: row.email, role: row.role, xp: row.xp,
    referral_code: row.referral_code, created_at: iso(row.created_at),
    level: levelInfo(levels, row.xp),
  };
}

const productView = r => ({
  id: r.id, drop_id: r.drop_id, drop_number: r.drop_number, category_id: r.category_id,
  category: r.category_slug, category_name: r.category_name,
  name: r.name, subtitle: r.subtitle, description: r.description, price: Number(r.price),
  stock_initial: r.stock_initial, stock: r.stock, sold_out: r.stock <= 0,
  theme: r.theme, badge_text: r.badge_text, image_url: r.image_url, active: !!r.active,
});

const PRODUCT_SELECT = `SELECT p.*, c.slug AS category_slug, c.name AS category_name, d.number AS drop_number
  FROM products p JOIN categories c ON c.id = p.category_id JOIN drops d ON d.id = p.drop_id`;

module.exports = { userView, productView, PRODUCT_SELECT };
