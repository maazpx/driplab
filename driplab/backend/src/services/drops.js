'use strict';
const { iso, parseDb } = require('../lib/dates');

function dropStatus(drop, now = new Date()) {
  if (now < parseDb(drop.starts_at)) return 'upcoming';
  if (now >= parseDb(drop.ends_at)) return 'ended';
  return 'live';
}

function dropAccess(drop, user, levelNumber, now = new Date()) {
  const status = dropStatus(drop, now);
  const starts = parseDb(drop.starts_at);
  const earlyOpensAt = drop.early_access_level && drop.early_access_hours > 0
    ? new Date(starts.getTime() - drop.early_access_hours * 3600e3) : null;
  const res = { can_buy: false, reason: null, early_access: false, early_access_opens_at: earlyOpensAt ? earlyOpensAt.toISOString() : null };
  if (!user) { res.reason = 'login'; return res; }
  if (levelNumber < drop.min_level) { res.reason = 'level'; return res; }
  if (status === 'ended') { res.reason = 'ended'; return res; }
  if (status === 'live') { res.can_buy = true; return res; }
  
  if (earlyOpensAt && levelNumber >= drop.early_access_level && now >= earlyOpensAt) {
    res.can_buy = true; res.early_access = true; return res;
  }
  res.reason = 'not_started';
  return res;
}

async function dropView(db, row, user, levelNumber) {
  const s = await db.get('SELECT stock_initial, stock_left FROM v_drop_stock WHERE drop_id = ?', [row.id]);
  const status = dropStatus(row);
  let myPurchased = 0;
  if (user) {
    const r = await db.get(
      `SELECT COALESCE(SUM(i.quantity),0) AS n FROM order_items i JOIN orders o ON o.id = i.order_id
       WHERE o.user_id = ? AND o.drop_id = ? AND o.status = 'confirmed'`, [user.id, row.id]);
    myPurchased = Number(r.n);
  }
  return {
    id: row.id, number: row.number, name: row.name, tagline: row.tagline, description: row.description,
    starts_at: iso(row.starts_at), ends_at: iso(row.ends_at),
    min_level: row.min_level, early_access_level: row.early_access_level, early_access_hours: row.early_access_hours,
    max_per_user: row.max_per_user, my_purchased: myPurchased,
    status,
    countdown_to: status === 'live' ? iso(row.ends_at) : status === 'upcoming' ? iso(row.starts_at) : null,
    stock_initial: Number(s.stock_initial), stock_left: Number(s.stock_left),
    access: dropAccess(row, user, levelNumber),
    server_time: new Date().toISOString(),
  };
}

module.exports = { dropStatus, dropAccess, dropView };
