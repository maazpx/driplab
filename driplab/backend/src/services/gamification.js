'use strict';
const { toDb } = require('../lib/dates');

const XP = { REGISTER: 50, PURCHASE_ITEM: 100, VOTE: 50, COMMENT: 10, REFERRAL: 200 };
const COMMENT_XP_DAILY_CAP = 5; // soos 5 primeiros comentarios do dia rendem xp

const RULES = [
  { action: 'register', xp: XP.REGISTER, text: 'Criar sua conta' },
  { action: 'purchase', xp: XP.PURCHASE_ITEM, text: 'Comprar um item do drop' },
  { action: 'vote', xp: XP.VOTE, text: 'Votar em uma coleção' },
  { action: 'comment', xp: XP.COMMENT, text: `Comentar num drop (até ${COMMENT_XP_DAILY_CAP}/dia)` },
  { action: 'referral', xp: XP.REFERRAL, text: 'Indicar um amigo' },
];

async function getLevels(t) { return t.all('SELECT id, number, name, min_xp FROM levels ORDER BY number'); }

function levelInfo(levels, xp) {
  let cur = levels[0];
  for (const l of levels) if (xp >= l.min_xp) cur = l;
  const next = levels.find(l => l.number === cur.number + 1) || null;
  const span = next ? next.min_xp - cur.min_xp : 0;
  return {
    number: cur.number, name: cur.name, min_xp: cur.min_xp,
    next: next ? { number: next.number, name: next.name, min_xp: next.min_xp } : null,
    xp_to_next: next ? next.min_xp - xp : 0,
    progress: next ? Math.min(1, (xp - cur.min_xp) / span) : 1,
  };
}

async function award(t, userId, amount, reason, description = null, refId = null) {
  const u = await t.get('SELECT xp FROM users WHERE id = ? FOR UPDATE', [userId]);
  const levels = await getLevels(t);
  const before = levelInfo(levels, u.xp);
  const newXp = Math.max(0, u.xp + amount);
  const applied = newXp - u.xp;
  if (applied !== 0) {
    await t.run('UPDATE users SET xp = ? WHERE id = ?', [newXp, userId]);
    await t.run('INSERT INTO xp_transactions (user_id, amount, reason, description, ref_id, created_at) VALUES (?,?,?,?,?,?)',
      [userId, applied, reason, description, refId, toDb(new Date())]);
  }
  const after = levelInfo(levels, newXp);
  const new_badges = await evaluateBadges(t, userId, after.number);
  return { xp_gained: applied, xp: newXp, level: after, leveled_up: after.number > before.number, new_badges };
}

const BADGE_CHECKS = {
  FIRST_DRIP: async (t, id) => (await t.get("SELECT COUNT(*) AS n FROM orders WHERE user_id = ? AND status = 'confirmed'", [id])).n >= 1,
  COLLECTOR: async (t, id) => Number((await t.get(
    "SELECT COALESCE(SUM(i.quantity),0) AS n FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.user_id = ? AND o.status = 'confirmed'", [id])).n) >= 5,
  VOTER: async (t, id) => (await t.get('SELECT COUNT(*) AS n FROM votes WHERE user_id = ?', [id])).n >= 1,
  SOCIAL: async (t, id) => (await t.get('SELECT COUNT(*) AS n FROM comments WHERE user_id = ?', [id])).n >= 5,
  RECRUITER: async (t, id) => (await t.get('SELECT COUNT(*) AS n FROM users WHERE referred_by = ?', [id])).n >= 1,
  LEVEL_5: async (t, id, level) => level >= 5,
  DRIPLORD: async (t, id, level) => level >= 10,
};

async function evaluateBadges(t, userId, level) {
  const missing = await t.all(
    'SELECT b.id, b.code, b.name, b.icon, b.description FROM badges b WHERE b.id NOT IN (SELECT badge_id FROM user_badges WHERE user_id = ?)', [userId]);
  const won = [];
  for (const b of missing) {
    const check = BADGE_CHECKS[b.code];
    if (check && await check(t, userId, level)) {
      await t.run('INSERT INTO user_badges (user_id, badge_id, awarded_at) VALUES (?,?,?)', [userId, b.id, toDb(new Date())]);
      won.push({ code: b.code, name: b.name, icon: b.icon, description: b.description });
    }
  }
  return won;
}

module.exports = { XP, RULES, COMMENT_XP_DAILY_CAP, getLevels, levelInfo, award, evaluateBadges };
