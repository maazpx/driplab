'use strict';
const { toDb } = require('../lib/dates');
const { hashPassword, randomCode } = require('../lib/security');

const H = 3600e3, D = 24 * H;

const LEVELS = [
  [1, 'ROOKIE', 0], [2, 'SKATER', 100], [3, 'SNEAKERHEAD', 250], [4, 'HYPEBEAST', 500], [5, 'TRENDSETTER', 900],
  [6, 'PLUG', 1400], [7, 'STREET RUNNER', 2000], [8, 'CULTURE KING', 3000], [9, 'LEGEND', 4500], [10, 'DRIPLORD', 6500],
];
const CATEGORIES = [['hoodie', 'Hoodies'], ['tee', 'T-Shirts'], ['accessory', 'Acessórios']];
const BADGES = [
  ['FIRST_DRIP', 'Primeiro Drip', 'Fez a primeira compra na DripLab', '🛍'],
  ['COLLECTOR', 'Colecionador', 'Comprou 5 peças ou mais', '🧥'],
  ['VOTER', 'Voz da Comunidade', 'Votou em uma coleção', '🗳'],
  ['SOCIAL', 'Papo Reto', 'Fez 5 comentários na comunidade', '💬'],
  ['RECRUITER', 'Recrutador', 'Indicou um amigo que criou conta', '🤝'],
  ['LEVEL_5', 'Trendsetter', 'Chegou ao nível 5', '⚡'],
  ['DRIPLORD', 'DripLord', 'Chegou ao nível máximo', '👑'],
];
const REWARDS = [
  ['Sticker Pack Lab', 'Kit de stickers holográficos enviado com seu próximo pedido', 2, 200],
  ['Cupom 10% OFF', 'Cupom de 10% para usar no próximo drop', 3, null],
  ['Acesso antecipado', 'Entre 24h antes nos drops com acesso antecipado', 5, null],
  ['Hoodie DripLord', 'Hoodie numerado exclusivo para quem chegou ao topo', 10, 10],
];

async function seed(db, { log = () => {} } = {}) {
  if ((await db.get('SELECT COUNT(*) AS n FROM levels')).n > 0) { log('Seed ignorado: o banco já tem dados.'); return false; }
  const now = Date.now();
  const at = ms => toDb(new Date(now + ms));

  await db.tx(async t => {
    for (const [n, name, xp] of LEVELS) await t.run('INSERT INTO levels (number, name, min_xp) VALUES (?,?,?)', [n, name, xp]);
    for (const [slug, name] of CATEGORIES) await t.run('INSERT INTO categories (slug, name) VALUES (?,?)', [slug, name]);
    for (const [code, name, desc, icon] of BADGES) await t.run('INSERT INTO badges (code, name, description, icon) VALUES (?,?,?,?)', [code, name, desc, icon]);
    for (const [name, desc, lvl, stock] of REWARDS) await t.run('INSERT INTO rewards (name, description, min_level, stock, active) VALUES (?,?,?,?,1)', [name, desc, lvl, stock]);

    //usuáruos
    const mk = async (name, email, pass, role, xp) => {
      const { insertId } = await t.run(
        'INSERT INTO users (name, email, password_hash, role, xp, referral_code, created_at) VALUES (?,?,?,?,?,?,?)',
        [name, email, await hashPassword(pass), role, xp, randomCode(8), at(-20 * D)]);
      if (xp > 0) await t.run('INSERT INTO xp_transactions (user_id, amount, reason, description, created_at) VALUES (?,?,?,?,?)', [insertId, xp, 'seed', 'XP inicial de demonstração', at(-20 * D)]);
      return insertId;
    };
    const admin = await mk('Admin DripLab', 'admin@driplab.com', 'Admin@123', 'admin', 0);
    const demo = await mk('Demo Runner', 'demo@driplab.com', 'Demo@123', 'user', 240);
    const crew = [];
    for (const [name, xp] of [['Kaue Street', 1650], ['Luna Glitch', 980], ['Pedro Neon', 420], ['Maya Static', 310], ['Bruno Ghost', 160], ['Sol Pixel', 60]]) {
      crew.push(await mk(name, `${name.split(' ')[0].toLowerCase()}@driplab.com`, 'Demo@123', 'user', xp));
    }

    // drops 
    const drop = async d => (await t.run(
      `INSERT INTO drops (number, name, tagline, description, starts_at, ends_at, min_level, early_access_level, early_access_hours, max_per_user, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [...d, at(-30 * D)])).insertId;
    const d3 = await drop([3, 'NEON RAIN', 'Chuva de neon na cidade.', 'Drop anterior, já encerrado.', at(-14 * D), at(-7 * D), 1, null, 0, 3]);
    const d4 = await drop([4, 'URBAN GLITCH', 'Peças limitadas. Identidade ilimitada.', 'A coleção que mistura erro digital e rua. Quantidade limitada, sem reposição.', at(-2 * D), at(3 * D + 8 * H + 24 * 60e3 + 17e3), 1, null, 0, 3]);
    const d5 = await drop([5, 'DIGITAL GHOST', 'Quem vê, vê. Quem perde, perdeu.', 'Próximo drop. Nível 5+ entra 24h antes.', at(7 * D), at(10 * D), 1, 5, 24, 2]);

    const cat = Object.fromEntries((await t.all('SELECT id, slug FROM categories')).map(c => [c.slug, c.id]));
    const prod = async (dropId, c, name, sub, desc, price, stock, theme, badge, sold = 0) => (await t.run(
      `INSERT INTO products (drop_id, category_id, name, subtitle, description, price, stock_initial, stock, theme, badge_text, active, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,1,?)`, [dropId, cat[c], name, sub, desc, price, stock + sold, stock, theme, badge, at(-3 * D)])).insertId;
    await prod(d3, 'hoodie', 'Rain Hoodie', 'Deep Blue / Sold out', 'Moletom do drop 003.', 329, 0, 'purple', 'RAIN', 15);
    await prod(d3, 'tee', 'Neon Tee', 'Acid / Sold out', 'Camiseta do drop 003.', 179, 0, 'green', 'NEO', 20);
    await prod(d4, 'hoodie', 'Glitch Hoodie', 'Black / Limited', 'Moletom oversized 100% algodão com estampa glitch em puff.', 349, 12, 'black', 'DRIP');
    await prod(d4, 'tee', 'Digital Core Tee', 'Acid Orange / Limited', 'Camiseta boxy fit, algodão pesado, estampa frontal.', 189, 10, 'green', 'DL');
    await prod(d4, 'tee', 'Error Tee', 'Deep Blue / Limited', 'Camiseta com a estampa 404, caimento solto.', 219, 8, 'purple', '404');
    await prod(d4, 'accessory', 'Lab Cap', 'Off White / Limited', 'Boné 6 painéis com bordado frontal.', 129, 7, 'white', 'LAB');
    await prod(d5, 'hoodie', 'Ghost Hoodie', 'Grey / Limited', 'Moletom refletivo do drop 005.', 389, 20, 'black', 'GST');
    await prod(d5, 'accessory', 'Ghost Beanie', 'Black / Limited', 'Gorro com bordado fantasma.', 99, 15, 'white', 'GH');

    // votação
    const poll = (await t.run('INSERT INTO polls (title, description, starts_at, ends_at, min_level, created_at) VALUES (?,?,?,?,?,?)',
      ['Qual estampa deve vir no Drop 005?', 'Sua escolha define a próxima coleção.', at(-1 * D), at(2 * D + 41 * 60e3 + 9e3), 1, at(-1 * D)])).insertId;
    const opts = [];
    for (const [l, desc] of [['NEON CHAOS', 'Cores saturadas e caos visual'], ['CITY STATIC', 'Ruído de TV e concreto'], ['DIGITAL GHOST', 'Silhuetas refletivas']]) {
      opts.push((await t.run('INSERT INTO poll_options (poll_id, label, description) VALUES (?,?,?)', [poll, l, desc])).insertId);
    }
    const picks = [0, 0, 0, 1, 1, 2];
    for (let i = 0; i < crew.length; i++) {
      await t.run('INSERT INTO votes (poll_id, option_id, user_id, created_at) VALUES (?,?,?,?)', [poll, opts[picks[i]], crew[i], at(-20 * H)]);
    }

    // comentários 
    const comments = [
      [0, 'Esse Glitch Hoodie é outro nível. Garanti o meu!'], [1, 'Quem mais tá de olho no Drop 005?'],
      [2, 'A Error Tee vai esgotar primeiro, podem anotar.'], [3, 'Votei em CITY STATIC, bora lá.'],
    ];
    for (const [i, [who, body]] of comments.entries()) {
      await t.run('INSERT INTO comments (user_id, drop_id, body, created_at) VALUES (?,?,?,?)', [crew[who], d4, body, at(-(10 - i) * H)]);
    }
    // badges iniciais 
    const badge = Object.fromEntries((await t.all('SELECT id, code FROM badges')).map(b => [b.code, b.id]));
    await t.run('INSERT INTO user_badges (user_id, badge_id, awarded_at) VALUES (?,?,?)', [crew[0], badge.VOTER, at(-20 * H)]);
    await t.run('INSERT INTO user_badges (user_id, badge_id, awarded_at) VALUES (?,?,?)', [crew[1], badge.LEVEL_5, at(-3 * D)]);
    void admin; void demo;
  });
  log('Seed aplicado: admin@driplab.com / Admin@123  •  demo@driplab.com / Demo@123');
  return true;
}
module.exports = { seed };
