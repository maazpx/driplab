'use strict';
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const { start } = require('./helpers');

let ctx, admin, demo;
before(async () => {
  ctx = await start();
  admin = await ctx.login('admin@driplab.com', 'Admin@123');
  demo = await ctx.login('demo@driplab.com', 'Demo@123');
});
after(async () => ctx.close());

const iso = ms => new Date(Date.now() + ms).toISOString();

describe('sistema e documentação', () => {
  test('health responde e testa o banco', async () => {
    const r = await ctx.call('GET', '/api/health');
    assert.equal(r.status, 200); assert.equal(r.body.status, 'ok');
  });
  test('openapi cobre todas as rotas registradas', () => {
    require('../src/openapi'); 
    assert.equal(require('../src/openapi').missing, undefined, 'rotas sem documentação: ' + require('../src/openapi').missing);
    assert.equal(Object.values(ctx.openapi.paths).reduce((n, p) => n + Object.keys(p).length, 0), ctx.router.routes.length);
  });
  test('/api/docs e /api/openapi.json respondem', async () => {
    assert.equal((await ctx.call('GET', '/api/docs')).status, 200);
    assert.equal((await ctx.call('GET', '/api/openapi.json')).body.openapi, '3.0.3');
  });
  test('rota inexistente = 404 JSON; método errado = 405', async () => {
    assert.equal((await ctx.call('GET', '/api/nada')).body.error.code, 'NOT_FOUND');
    assert.equal((await ctx.call('PATCH', '/api/health')).status, 405);
  });
  test('front-end estático é servido e path traversal é bloqueado', async () => {
    const r = await ctx.call('GET', '/');
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
    for (const p of ['/..%2f..%2fbackend%2f.env', '/%2e%2e/backend/package.json', '/../package.json']) {
      const t = await ctx.call('GET', p);
      assert.ok([400, 403, 404].includes(t.status), `${p} -> ${t.status}`);
      assert.doesNotMatch(t.text, /driplab-backend/);
    }
  });
});

describe('autenticação e segurança', () => {
  test('cadastro válido dá +50 XP, nível 1, e não vaza hash', async () => {
    const { res } = await ctx.newUser();
    assert.equal(res.status, 201);
    assert.equal(res.body.user.xp, 50); assert.equal(res.body.user.level.number, 1);
    assert.ok(!JSON.stringify(res.body).includes('password'));
  });
  test('validações do cadastro', async () => {
    const r = await ctx.call('POST', '/api/auth/register', { body: { name: 'A', email: 'ruim', password: 'curta' } });
    assert.equal(r.status, 422); assert.ok(r.body.error.details.name && r.body.error.details.email && r.body.error.details.password);
    const w = await ctx.call('POST', '/api/auth/register', { body: { name: 'Fulano', email: 'f@x.com', password: 'somenteletras' } });
    assert.equal(w.status, 422);
  });
  test('e-mail duplicado = 409', async () => {
    const r = await ctx.call('POST', '/api/auth/register', { body: { name: 'Demo 2', email: 'DEMO@driplab.com', password: 'Senha123' } });
    assert.equal(r.status, 409); assert.equal(r.body.error.code, 'EMAIL_TAKEN');
  });
  test('login errado = 401 genérico (igual para e-mail inexistente)', async () => {
    const a = await ctx.call('POST', '/api/auth/login', { body: { email: 'demo@driplab.com', password: 'errada123' } });
    const b = await ctx.call('POST', '/api/auth/login', { body: { email: 'naoexiste@x.com', password: 'errada123' } });
    assert.equal(a.status, 401); assert.deepEqual(a.body, b.body);
  });
  test('JSON inválido = 400; corpo gigante = 413', async () => {
    assert.equal((await ctx.call('POST', '/api/auth/login', { body: '{ruim', raw: true })).status, 400);
    assert.equal((await ctx.call('POST', '/api/auth/login', { body: JSON.stringify({ email: 'a@a.com', password: 'x'.repeat(200000) }), raw: true })).status, 413);
  });
  test('rotas protegidas exigem token; token adulterado é recusado', async () => {
    assert.equal((await ctx.call('GET', '/api/auth/me')).status, 401);
    const bad = demo.slice(0, -3) + 'abc';
    assert.equal((await ctx.call('GET', '/api/auth/me', { token: bad })).status, 401);
    assert.equal((await ctx.call('GET', '/api/auth/me', { token: demo })).status, 200);
  });
  test('token "alg:none" é recusado', async () => {
    const h = Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url');
    const b = Buffer.from(JSON.stringify({ sub: 1, role: 'admin', exp: 9999999999 })).toString('base64url');
    assert.equal((await ctx.call('GET', '/api/auth/me', { token: `${h}.${b}.` })).status, 401);
  });
  test('usuário comum não acessa rotas de admin', async () => {
    assert.equal((await ctx.call('GET', '/api/users', { token: demo })).status, 403);
    assert.equal((await ctx.call('POST', '/api/products', { token: demo, body: {} })).status, 403);
    assert.equal((await ctx.call('DELETE', '/api/drops/1', { token: demo })).status, 403);
  });
  test('usuário não lê/edita outro usuário', async () => {
    const other = await ctx.newUser();
    assert.equal((await ctx.call('GET', `/api/users/${other.user.id}`, { token: demo })).status, 403);
    assert.equal((await ctx.call('PUT', `/api/users/${other.user.id}`, { token: demo, body: { name: 'Hack' } })).status, 403);
  });
  test('usuário comum não consegue se promover a admin', async () => {
    const u = await ctx.newUser();
    const r = await ctx.call('PUT', `/api/users/${u.user.id}`, { token: u.token, body: { role: 'admin' } });
    assert.equal(r.status, 403);
  });
  test('troca de senha exige a senha atual', async () => {
    const u = await ctx.newUser();
    assert.equal((await ctx.call('PUT', `/api/users/${u.user.id}`, { token: u.token, body: { password: 'Nova12345' } })).status, 422);
    assert.equal((await ctx.call('PUT', `/api/users/${u.user.id}`, { token: u.token, body: { password: 'Nova12345', current_password: 'Senha123' } })).status, 200);
    assert.ok(await ctx.login(u.user.email, 'Nova12345'));
  });
  test('SQL injection em login e busca não quebra nada', async () => {
    const r = await ctx.call('POST', '/api/auth/login', { body: { email: "' OR 1=1 --@x.com", password: "' OR '1'='1" } });
    assert.ok([401, 422].includes(r.status));
    const s = await ctx.call('GET', "/api/products?q=" + encodeURIComponent("'; DROP TABLE products; --"));
    assert.equal(s.status, 200); assert.deepEqual(s.body, []);
    assert.ok((await ctx.call('GET', '/api/products')).body.length > 0);
  });
  test('indicação: indicador ganha +200 XP e badge Recrutador; código inválido = 422', async () => {
    const a = await ctx.newUser();
    const b = await ctx.newUser({ referral_code: a.user.referral_code });
    assert.equal(b.res.status, 201);
    const me = await ctx.call('GET', '/api/gamification/me', { token: a.token });
    assert.equal(me.body.xp, 250); 
    assert.ok(me.body.badges.find(x => x.code === 'RECRUITER').earned);
    const bad = await ctx.newUser({ referral_code: 'ZZZZZZZZ' });
    assert.equal(bad.res.status, 422);
  });
  test('rate limit de login (429)', async () => {
    const limited = await start({ authRateMax: 3 });
    try {
      const codes = [];
      for (let i = 0; i < 5; i++) codes.push((await limited.call('POST', '/api/auth/login', { body: { email: 'x@x.com', password: 'abc12345' } })).status);
      assert.deepEqual(codes, [401, 401, 401, 429, 429]);
    } finally { await limited.close(); }
  });
});

describe('drops e catálogo', () => {
  test('drop atual: no ar, 4 produtos, estoque somado = 37', async () => {
    const r = await ctx.call('GET', '/api/drops/current');
    assert.equal(r.body.number, 4); assert.equal(r.body.status, 'live');
    assert.equal(r.body.stock_left, 37); assert.equal(r.body.products.length, 4);
    assert.ok(new Date(r.body.countdown_to) > new Date());
    assert.equal(r.body.access.reason, 'login');
  });
  test('filtros de produtos por categoria e busca', async () => {
    const tees = await ctx.call('GET', '/api/products?category=tee&drop_id=2');
    assert.deepEqual(tees.body.map(p => p.name).sort(), ['Digital Core Tee', 'Error Tee']);
    const q = await ctx.call('GET', '/api/products?q=cap');
    assert.deepEqual(q.body.map(p => p.name), ['Lab Cap']);
  });
  test('CRUD de categoria', async () => {
    const c = await ctx.call('POST', '/api/categories', { token: admin, body: { slug: 'sticker', name: 'Stickers' } });
    assert.equal(c.status, 201);
    assert.equal((await ctx.call('POST', '/api/categories', { token: admin, body: { slug: 'sticker', name: 'XX' } })).status, 409);
    assert.equal((await ctx.call('PUT', `/api/categories/${c.body.id}`, { token: admin, body: { name: 'Adesivos' } })).body.name, 'Adesivos');
    assert.equal((await ctx.call('DELETE', `/api/categories/${c.body.id}`, { token: admin })).status, 204);
    assert.equal((await ctx.call('DELETE', '/api/categories/1', { token: admin })).status, 409); 
  });
  test('CRUD de drop e produto (admin) + validações', async () => {
    const bad = await ctx.call('POST', '/api/drops', { token: admin, body: { number: 90, name: 'X', starts_at: iso(1000), ends_at: iso(-1000) } });
    assert.equal(bad.status, 422);
    const d = await ctx.call('POST', '/api/drops', { token: admin, body: { number: 90, name: 'Drop Teste', starts_at: iso(-1000), ends_at: iso(3600e3) } });
    assert.equal(d.status, 201); assert.equal(d.body.status, 'live');
    assert.equal((await ctx.call('POST', '/api/drops', { token: admin, body: { number: 90, name: 'Dup', starts_at: iso(-1000), ends_at: iso(3600e3) } })).status, 409);
    const p = await ctx.call('POST', '/api/products', { token: admin, body: { drop_id: d.body.id, category_id: 1, name: 'Peça Teste', price: 99.9, stock: 5 } });
    assert.equal(p.status, 201); assert.equal(p.body.stock, 5); assert.equal(p.body.price, 99.9);
    assert.equal((await ctx.call('POST', '/api/products', { token: admin, body: { drop_id: 9999, category_id: 1, name: 'Peça', price: 1, stock: 1 } })).status, 422);
    assert.equal((await ctx.call('POST', '/api/products', { token: admin, body: { drop_id: d.body.id, category_id: 1, name: 'Peça', price: -5, stock: 1 } })).status, 422);
    const up = await ctx.call('PUT', `/api/products/${p.body.id}`, { token: admin, body: { price: 120, stock: 8 } });
    assert.equal(up.body.price, 120); assert.equal(up.body.stock, 8); assert.equal(up.body.stock_initial, 8);
    const dd = await ctx.call('PUT', `/api/drops/${d.body.id}`, { token: admin, body: { name: 'Renomeado' } });
    assert.equal(dd.body.name, 'Renomeado');
    assert.equal((await ctx.call('DELETE', `/api/products/${p.body.id}`, { token: admin })).status, 204);
    assert.equal((await ctx.call('GET', `/api/products/${p.body.id}`)).status, 404);
    assert.equal((await ctx.call('DELETE', `/api/drops/${d.body.id}`, { token: admin })).status, 204);
  });
});

describe('pedidos e regras do drop', () => {
  const productByName = async name => (await ctx.call('GET', '/api/products?drop_id=2')).body.find(p => p.name === name);

  test('compra baixa estoque, dá +100 XP/peça, sobe de nível e libera badge', async () => {
    const u = await ctx.newUser();          
    const cap = await productByName('Lab Cap');
    const before = (await ctx.call('GET', '/api/drops/current')).body.stock_left;
    const r = await ctx.call('POST', '/api/orders', { token: u.token, body: { items: [{ product_id: cap.id, quantity: 2 }] } });
    assert.equal(r.status, 201);
    assert.equal(r.body.total, 258); assert.equal(r.body.items[0].quantity, 2);
    assert.equal(r.body.gamification.xp_gained, 200); assert.equal(r.body.gamification.xp, 250);
    assert.equal(r.body.gamification.level.number, 3); assert.equal(r.body.gamification.leveled_up, true);
    assert.deepEqual(r.body.gamification.new_badges.map(b => b.code), ['FIRST_DRIP']);
    assert.equal((await ctx.call('GET', '/api/drops/current')).body.stock_left, before - 2);
    assert.equal((await productByName('Lab Cap')).stock, cap.stock - 2);
  });
  test('limite de peças por usuário no drop (max 3)', async () => {
    const u = await ctx.newUser();
    const tee = await productByName('Digital Core Tee');
    assert.equal((await ctx.call('POST', '/api/orders', { token: u.token, body: { items: [{ product_id: tee.id, quantity: 2 }] } })).status, 201);
    assert.equal((await ctx.call('GET', '/api/drops/2', { token: u.token })).body.my_purchased, 2);
    const r = await ctx.call('POST', '/api/orders', { token: u.token, body: { items: [{ product_id: tee.id, quantity: 2 }] } });
    assert.equal(r.status, 422); assert.equal(r.body.error.code, 'LIMIT_PER_USER');
  });
  test('linhas repetidas do mesmo produto são somadas para o limite', async () => {
    const u = await ctx.newUser();
    const tee = await productByName('Error Tee');
    const r = await ctx.call('POST', '/api/orders', { token: u.token, body: { items: [{ product_id: tee.id, quantity: 2 }, { product_id: tee.id, quantity: 2 }] } });
    assert.equal(r.body.error.code, 'LIMIT_PER_USER');
    const d = await ctx.call('GET', '/api/drops/2', { token: u.token });
    assert.equal(d.body.my_purchased, 0);
  });
  test('quantidade inválida / carrinho vazio / produto inexistente', async () => {
    const u = await ctx.newUser();
    const tee = await productByName('Error Tee');
    for (const items of [[], [{ product_id: tee.id, quantity: 0 }], [{ product_id: tee.id, quantity: -1 }], [{ product_id: tee.id, quantity: 1.5 }], [{ product_id: 99999, quantity: 1 }], 'x']) {
      const r = await ctx.call('POST', '/api/orders', { token: u.token, body: { items } });
      assert.equal(r.status, 422, JSON.stringify(items));
    }
  });
  test('sem login = 401', async () => {
    assert.equal((await ctx.call('POST', '/api/orders', { body: { items: [{ product_id: 1, quantity: 1 }] } })).status, 401);
  });
  test('estoque esgotado = 409 e nada é gravado', async () => {
    const d = await ctx.call('POST', '/api/drops', { token: admin, body: { number: 91, name: 'Estoque', starts_at: iso(-1000), ends_at: iso(3600e3), max_per_user: 10 } });
    const p = await ctx.call('POST', '/api/products', { token: admin, body: { drop_id: d.body.id, category_id: 1, name: 'Raro', price: 10, stock: 2 } });
    const u = await ctx.newUser();
    const r = await ctx.call('POST', '/api/orders', { token: u.token, body: { items: [{ product_id: p.body.id, quantity: 3 }] } });
    assert.equal(r.status, 409); assert.equal(r.body.error.code, 'OUT_OF_STOCK');
    assert.equal((await ctx.call('GET', `/api/products/${p.body.id}`)).body.stock, 2);
    assert.equal((await ctx.call('GET', '/api/orders', { token: u.token })).body.length, 0);
    assert.equal((await ctx.call('GET', '/api/gamification/me', { token: u.token })).body.xp, 50);
  });
  test('CONCORRÊNCIA: 8 compradores disputando 3 peças — vendem exatamente 3', async () => {
    const d = await ctx.call('POST', '/api/drops', { token: admin, body: { number: 92, name: 'Corrida', starts_at: iso(-1000), ends_at: iso(3600e3), max_per_user: 5 } });
    const p = await ctx.call('POST', '/api/products', { token: admin, body: { drop_id: d.body.id, category_id: 1, name: 'Disputada', price: 50, stock: 3 } });
    const users = await Promise.all(Array.from({ length: 8 }, () => ctx.newUser()));
    const rs = await Promise.all(users.map(u => ctx.call('POST', '/api/orders', { token: u.token, body: { items: [{ product_id: p.body.id, quantity: 1 }] } })));
    assert.equal(rs.filter(r => r.status === 201).length, 3);
    assert.equal(rs.filter(r => r.status === 409).length, 5);
    assert.equal((await ctx.call('GET', `/api/products/${p.body.id}`)).body.stock, 0);
    assert.equal((await ctx.call('GET', `/api/products/${p.body.id}`)).body.sold_out, true);
  });
  test('misturar drops no mesmo pedido é recusado', async () => {
    const u = await ctx.newUser();
    const cap = await productByName('Lab Cap');
    const old = (await ctx.call('GET', '/api/products?drop_id=1')).body[0];
    const r = await ctx.call('POST', '/api/orders', { token: u.token, body: { items: [{ product_id: cap.id, quantity: 1 }, { product_id: old.id, quantity: 1 }] } });
    assert.equal(r.body.error.code, 'MIXED_DROPS');
  });
  test('drop encerrado: compra recusada', async () => {
    const u = await ctx.newUser();
    const old = (await ctx.call('GET', '/api/products?drop_id=1')).body[0];
    const r = await ctx.call('POST', '/api/orders', { token: u.token, body: { items: [{ product_id: old.id, quantity: 1 }] } });
    assert.equal(r.body.error.code, 'DROP_ENDED');
  });
  test('drop futuro: só entra antes quem tem nível de acesso antecipado', async () => {
    const d5 = (await ctx.call('GET', '/api/drops')).body.find(d => d.number === 5);
    assert.equal(d5.status, 'upcoming');
    const prod = (await ctx.call('GET', `/api/products?drop_id=${d5.id}`)).body[0];
    const low = await ctx.newUser();
    const r1 = await ctx.call('POST', '/api/orders', { token: low.token, body: { items: [{ product_id: prod.id, quantity: 1 }] } });
    assert.equal(r1.body.error.code, 'DROP_NOT_STARTED');
    await ctx.db.run('UPDATE drops SET starts_at = ? WHERE id = ?', [new Date(Date.now() + 20 * 3600e3).toISOString().slice(0, 19).replace('T', ' '), d5.id]);
    const vip = await ctx.newUser(); await ctx.addXp(vip.user.id, 900);
    const r2 = await ctx.call('POST', '/api/orders', { token: vip.token, body: { items: [{ product_id: prod.id, quantity: 1 }] } });
    assert.equal(r2.status, 201);
    const r3 = await ctx.call('POST', '/api/orders', { token: low.token, body: { items: [{ product_id: prod.id, quantity: 1 }] } });
    assert.equal(r3.body.error.code, 'DROP_NOT_STARTED');
    const view = (await ctx.call('GET', `/api/drops/${d5.id}`, { token: vip.token })).body;
    assert.equal(view.access.can_buy, true); assert.equal(view.access.early_access, true);
  });
  test('nível mínimo do drop', async () => {
    const d = await ctx.call('POST', '/api/drops', { token: admin, body: { number: 93, name: 'Elite', starts_at: iso(-1000), ends_at: iso(3600e3), min_level: 4 } });
    const p = await ctx.call('POST', '/api/products', { token: admin, body: { drop_id: d.body.id, category_id: 1, name: 'Elite Tee', price: 10, stock: 5 } });
    const u = await ctx.newUser();
    const r = await ctx.call('POST', '/api/orders', { token: u.token, body: { items: [{ product_id: p.body.id, quantity: 1 }] } });
    assert.equal(r.body.error.code, 'LEVEL_TOO_LOW');
    await ctx.addXp(u.user.id, 500);
    assert.equal((await ctx.call('POST', '/api/orders', { token: u.token, body: { items: [{ product_id: p.body.id, quantity: 1 }] } })).status, 201);
  });
  test('cancelamento devolve estoque e desfaz XP; não cancela duas vezes; não cancela pedido alheio', async () => {
    const u = await ctx.newUser();
    const hood = await productByName('Glitch Hoodie');
    const o = await ctx.call('POST', '/api/orders', { token: u.token, body: { items: [{ product_id: hood.id, quantity: 1 }] } });
    assert.equal((await productByName('Glitch Hoodie')).stock, hood.stock - 1);
    const other = await ctx.newUser();
    assert.equal((await ctx.call('POST', `/api/orders/${o.body.id}/cancel`, { token: other.token })).status, 404);
    assert.equal((await ctx.call('GET', `/api/orders/${o.body.id}`, { token: other.token })).status, 404);
    const c = await ctx.call('POST', `/api/orders/${o.body.id}/cancel`, { token: u.token });
    assert.equal(c.body.status, 'cancelled');
    assert.equal((await productByName('Glitch Hoodie')).stock, hood.stock);
    assert.equal((await ctx.call('GET', '/api/gamification/me', { token: u.token })).body.xp, 50);
    assert.equal((await ctx.call('POST', `/api/orders/${o.body.id}/cancel`, { token: u.token })).body.error.code, 'ALREADY_CANCELLED');
    assert.equal((await ctx.call('POST', '/api/orders', { token: u.token, body: { items: [{ product_id: hood.id, quantity: 3 }] } })).status, 201);
  });
  test('admin lista todos os pedidos e só exclui cancelados', async () => {
    const all = await ctx.call('GET', '/api/orders?scope=all', { token: admin });
    assert.ok(all.body.length > 3);
    const confirmed = all.body.find(o => o.status === 'confirmed');
    assert.equal((await ctx.call('DELETE', `/api/orders/${confirmed.id}`, { token: admin })).status, 409);
    const cancelled = all.body.find(o => o.status === 'cancelled');
    assert.equal((await ctx.call('DELETE', `/api/orders/${cancelled.id}`, { token: admin })).status, 204);
  });
  test('usuário com pedidos não pode ser excluído', async () => {
    const all = await ctx.call('GET', '/api/orders?scope=all', { token: admin });
    const uid = all.body[0].user_id;
    assert.equal((await ctx.call('DELETE', `/api/users/${uid}`, { token: admin })).body.error.code, 'USER_HAS_ORDERS');
  });
});

describe('votação', () => {
  test('votar dá +50 XP, badge, soma o resultado; segundo voto = 409', async () => {
    const u = await ctx.newUser();
    const poll = (await ctx.call('GET', '/api/polls/current', { token: u.token })).body;
    assert.equal(poll.status, 'open'); assert.equal(poll.my_vote, null);
    const before = poll.total_votes;
    const r = await ctx.call('POST', `/api/polls/${poll.id}/vote`, { token: u.token, body: { option_id: poll.options[1].id } });
    assert.equal(r.status, 200);
    assert.equal(r.body.gamification.xp_gained, 50); assert.deepEqual(r.body.gamification.new_badges.map(b => b.code), ['VOTER']);
    assert.equal(r.body.poll.total_votes, before + 1); assert.equal(r.body.poll.my_vote, poll.options[1].id);
    assert.equal(r.body.poll.options.reduce((s, o) => s + o.percent, 0) >= 99, true);
    const again = await ctx.call('POST', `/api/polls/${poll.id}/vote`, { token: u.token, body: { option_id: poll.options[0].id } });
    assert.equal(again.status, 409); assert.equal(again.body.error.code, 'ALREADY_VOTED');
    assert.equal((await ctx.call('GET', '/api/gamification/me', { token: u.token })).body.xp, 100);
  });
  test('votos simultâneos do mesmo usuário contam só um', async () => {
    const u = await ctx.newUser();
    const poll = (await ctx.call('GET', '/api/polls/current')).body;
    const rs = await Promise.all([0, 1, 2, 0, 1].map(i => ctx.call('POST', `/api/polls/${poll.id}/vote`, { token: u.token, body: { option_id: poll.options[i].id } })));
    assert.equal(rs.filter(r => r.status === 200).length, 1);
    assert.equal((await ctx.call('GET', '/api/gamification/me', { token: u.token })).body.xp, 100);
  });
  test('opção de outra votação / sem login / votação encerrada', async () => {
    const u = await ctx.newUser();
    const poll = (await ctx.call('GET', '/api/polls/current')).body;
    const mk = await ctx.call('POST', '/api/polls', { token: admin, body: { title: 'Outra', starts_at: iso(-7200e3), ends_at: iso(-3600e3), options: [{ label: 'A' }, { label: 'B' }] } });
    assert.equal(mk.status, 201); assert.equal(mk.body.status, 'ended');
    assert.equal((await ctx.call('POST', `/api/polls/${poll.id}/vote`, { token: u.token, body: { option_id: mk.body.options[0].id } })).status, 422);
    assert.equal((await ctx.call('POST', `/api/polls/${poll.id}/vote`, { body: { option_id: 1 } })).status, 401);
    assert.equal((await ctx.call('POST', `/api/polls/${mk.body.id}/vote`, { token: u.token, body: { option_id: mk.body.options[0].id } })).body.error.code, 'POLL_ENDED');
  });
  test('CRUD de votação (admin): exige 2+ opções, não remove opção com voto', async () => {
    const bad = await ctx.call('POST', '/api/polls', { token: admin, body: { title: 'Sem opções', starts_at: iso(0), ends_at: iso(1e6), options: [{ label: 'A' }] } });
    assert.equal(bad.status, 422);
    const p = await ctx.call('POST', '/api/polls', { token: admin, body: { title: 'Nova', starts_at: iso(-1000), ends_at: iso(1e7), options: [{ label: 'X' }, { label: 'Y' }] } });
    const add = await ctx.call('POST', `/api/polls/${p.body.id}/options`, { token: admin, body: { label: 'Z' } });
    assert.equal(add.body.options.length, 3);
    const u = await ctx.newUser();
    await ctx.call('POST', `/api/polls/${p.body.id}/vote`, { token: u.token, body: { option_id: add.body.options[0].id } });
    assert.equal((await ctx.call('DELETE', `/api/polls/${p.body.id}/options/${add.body.options[0].id}`, { token: admin })).body.error.code, 'OPTION_HAS_VOTES');
    assert.equal((await ctx.call('DELETE', `/api/polls/${p.body.id}/options/${add.body.options[2].id}`, { token: admin })).status, 204);
    assert.equal((await ctx.call('PUT', `/api/polls/${p.body.id}`, { token: admin, body: { title: 'Renomeada' } })).body.title, 'Renomeada');
    assert.equal((await ctx.call('DELETE', `/api/polls/${p.body.id}`, { token: admin })).status, 204);
    assert.equal((await ctx.call('GET', `/api/polls/${p.body.id}`)).status, 404);
  });
});

describe('comunidade', () => {
  test('comentar rende XP até o teto diário; badge Papo Reto no 5º', async () => {
    const u = await ctx.newUser();
    const xps = [];
    let last;
    for (let i = 0; i < 6; i++) {
      last = await ctx.call('POST', '/api/drops/2/comments', { token: u.token, body: { body: `comentário ${i}` } });
      assert.equal(last.status, 201);
      xps.push(last.body.gamification.xp_gained);
      if (i === 4) assert.ok(last.body.gamification.new_badges.some(b => b.code === 'SOCIAL'));
    }
    assert.deepEqual(xps, [10, 10, 10, 10, 10, 0]);
  });
  test('validação, listagem, edição e exclusão com permissões', async () => {
    const a = await ctx.newUser(); const b = await ctx.newUser();
    assert.equal((await ctx.call('POST', '/api/drops/2/comments', { token: a.token, body: { body: '   ' } })).status, 422);
    assert.equal((await ctx.call('POST', '/api/drops/2/comments', { token: a.token, body: { body: 'x'.repeat(501) } })).status, 422);
    assert.equal((await ctx.call('POST', '/api/drops/999/comments', { token: a.token, body: { body: 'oi' } })).status, 404);
    assert.equal((await ctx.call('POST', '/api/drops/2/comments', { body: { body: 'oi' } })).status, 401);
    const c = await ctx.call('POST', '/api/drops/2/comments', { token: a.token, body: { body: '<script>alert(1)</script>' } });
    const list = await ctx.call('GET', '/api/drops/2/comments');
    assert.equal(list.body[0].body, '<script>alert(1)</script>');
    assert.equal((await ctx.call('PUT', `/api/comments/${c.body.id}`, { token: b.token, body: { body: 'invadido' } })).status, 403);
    assert.equal((await ctx.call('PUT', `/api/comments/${c.body.id}`, { token: a.token, body: { body: 'editado' } })).body.body, 'editado');
    assert.equal((await ctx.call('DELETE', `/api/comments/${c.body.id}`, { token: b.token })).status, 403);
    assert.equal((await ctx.call('DELETE', `/api/comments/${c.body.id}`, { token: admin })).status, 204);
  });
});

describe('gamificação e recompensas', () => {
  test('níveis, regras e badges públicos', async () => {
    assert.equal((await ctx.call('GET', '/api/gamification/levels')).body.length, 10);
    assert.ok((await ctx.call('GET', '/api/gamification/rules')).body.length >= 4);
    assert.ok((await ctx.call('GET', '/api/badges')).body.length >= 7);
  });
  test('ranking público não expõe e-mail', async () => {
    const r = await ctx.call('GET', '/api/users/ranking?limit=3');
    assert.equal(r.body.length, 3); assert.ok(r.body[0].xp >= r.body[1].xp);
    assert.ok(!JSON.stringify(r.body).includes('@'));
  });
  test('resgate de recompensa: nível, duplicidade e estoque', async () => {
    const u = await ctx.newUser();
    const rewards = (await ctx.call('GET', '/api/rewards', { token: u.token })).body;
    const sticker = rewards.find(r => r.name.startsWith('Sticker'));
    assert.equal(sticker.unlocked, false);
    assert.equal((await ctx.call('POST', `/api/rewards/${sticker.id}/claim`, { token: u.token })).body.error.code, 'LEVEL_TOO_LOW');
    await ctx.addXp(u.user.id, 120);
    const ok = await ctx.call('POST', `/api/rewards/${sticker.id}/claim`, { token: u.token });
    assert.equal(ok.status, 201); assert.match(ok.body.code, /^DL-/);
    assert.equal((await ctx.call('POST', `/api/rewards/${sticker.id}/claim`, { token: u.token })).body.error.code, 'ALREADY_CLAIMED');
    const mine = await ctx.call('GET', '/api/rewards/mine', { token: u.token });
    assert.equal(mine.body.length, 1);
    const after = (await ctx.call('GET', '/api/rewards', { token: u.token })).body.find(r => r.id === sticker.id);
    assert.equal(after.claimed, true); assert.equal(after.stock, sticker.stock - 1);
    const rw = await ctx.call('POST', '/api/rewards', { token: admin, body: { name: 'Raridade', description: 'única', min_level: 1, stock: 1 } });
    const [a, b] = await Promise.all([ctx.newUser(), ctx.newUser()]);
    const rs = await Promise.all([a, b].map(x => ctx.call('POST', `/api/rewards/${rw.body.id}/claim`, { token: x.token })));
    assert.deepEqual(rs.map(r => r.status).sort(), [201, 409]);
  });
  test('CRUD de badge e recompensa (admin)', async () => {
    const b = await ctx.call('POST', '/api/badges', { token: admin, body: { code: 'TESTE_1', name: 'Teste', description: 'badge de teste' } });
    assert.equal(b.status, 201);
    assert.equal((await ctx.call('POST', '/api/badges', { token: admin, body: { code: 'minusculo', name: 'x', description: 'yy' } })).status, 422);
    assert.equal((await ctx.call('PUT', `/api/badges/${b.body.id}`, { token: admin, body: { name: 'Novo' } })).body.name, 'Novo');
    assert.equal((await ctx.call('DELETE', `/api/badges/${b.body.id}`, { token: admin })).status, 204);
    const r = await ctx.call('POST', '/api/rewards', { token: admin, body: { name: 'Rr', description: 'desc', min_level: 2 } });
    assert.equal(r.status, 201);
    assert.equal((await ctx.call('PUT', `/api/rewards/${r.body.id}`, { token: admin, body: { min_level: 3 } })).body.min_level, 3);
    assert.equal((await ctx.call('DELETE', `/api/rewards/${r.body.id}`, { token: admin })).status, 204);
  });
  test('CRUD de usuário (admin); não exclui o último admin nem se rebaixa', async () => {
    const c = await ctx.call('POST', '/api/users', { token: admin, body: { name: 'Novo Admin', email: `na${Date.now()}@x.com`, password: 'Senha123', role: 'admin' } });
    assert.equal(c.status, 201); assert.equal(c.body.role, 'admin');
    assert.equal((await ctx.call('PUT', `/api/users/${c.body.id}`, { token: admin, body: { name: 'Renomeado' } })).body.name, 'Renomeado');
    assert.equal((await ctx.call('DELETE', `/api/users/${c.body.id}`, { token: admin })).status, 204);
    const me = (await ctx.call('GET', '/api/auth/me', { token: admin })).body;
    assert.equal((await ctx.call('PUT', `/api/users/${me.id}`, { token: admin, body: { role: 'user' } })).body.error.code, 'SELF_DEMOTE');
    assert.equal((await ctx.call('DELETE', `/api/users/${me.id}`, { token: admin })).body.error.code, 'LAST_ADMIN');
  });
});
