'use strict';
/* DripLab — front-end. Conversa com a API REST em /api (mesma origem que serve esta página). */

const API = '/api';
const $ = id => document.getElementById(id);
const pad2 = n => String(n).padStart(2, '0');

/* ---------- armazenamento (nunca quebra se o navegador bloquear) ---------- */
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignora */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignora */ } },
};

/* ---------- estado ---------- */
const state = {
  token: store.get('dl_token'),
  user: null, me: null,
  drop: null, products: [], category: 'all', q: '',
  poll: null, rewards: [], comments: [],
  cart: [], offset: 0,
};
try { state.cart = JSON.parse(store.get('dl_cart') || '[]').filter(i => Number.isInteger(i.id) && Number.isInteger(i.qty) && i.qty > 0); } catch { state.cart = []; }

/* ---------- utilidades ---------- */
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'dataset') Object.assign(e.dataset, v);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined) e.append(kid);
  return e;
}
const clear = node => { while (node.firstChild) node.removeChild(node.firstChild); };
const money = n => 'R$ ' + (Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ','));
const nowMs = () => Date.now() + state.offset;
const syncClock = serverTime => { if (serverTime) state.offset = Date.parse(serverTime) - Date.now(); };

function fmtDuration(ms) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), hh = Math.floor((s % 86400) / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
  return `${d > 0 ? d + 'D ' : ''}${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;
}
function ago(iso) {
  const s = Math.max(0, (nowMs() - Date.parse(iso)) / 1000);
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  return `há ${Math.floor(s / 86400)} d`;
}
const fmtDateTime = iso => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/* ---------- toasts (fila, para mostrar XP + level up + badge em sequência) ---------- */
const toastEl = $('toast');
const toastQueue = []; let toastBusy = false;
function showToast(msg) { toastQueue.push(msg); if (!toastBusy) nextToast(); }
function nextToast() {
  const msg = toastQueue.shift();
  if (!msg) { toastBusy = false; return; }
  toastBusy = true;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => { toastEl.classList.remove('show'); setTimeout(nextToast, 250); }, 2400);
}
function announce(g) {
  if (!g) return;
  if (g.xp_gained > 0) showToast(`+${g.xp_gained} XP`);
  if (g.leveled_up) showToast(`LEVEL UP! Nível ${g.level.number} — ${g.level.name}`);
  (g.new_badges || []).forEach(b => showToast(`Badge desbloqueado: ${b.icon} ${b.name}`));
}

/* ---------- API ---------- */
class ApiError extends Error {
  constructor(status, code, message, details) { super(message); this.status = status; this.code = code; this.details = details; }
}
async function api(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (state.token) headers.Authorization = 'Bearer ' + state.token;
  let res;
  try { res = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }); }
  catch { throw new ApiError(0, 'NETWORK', 'Não foi possível falar com o servidor.'); }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const e = (data && data.error) || {};
    if (res.status === 401 && state.token) logout(true);
    throw new ApiError(res.status, e.code || 'ERROR', e.message || 'Algo deu errado.', e.details);
  }
  return data;
}
const FIELD = { name: 'Nome', email: 'E-mail', password: 'Senha', referral_code: 'Indicação', body: 'Comentário', current_password: 'Senha atual' };
const errText = e => e.details ? Object.entries(e.details).map(([k, v]) => `${FIELD[k] || k}: ${v}`).join(' · ') : e.message;

/* ---------- modais e gaveta ---------- */
let lastFocus = null;
function openModal(el) {
  lastFocus = document.activeElement;
  el.hidden = false; document.body.classList.add('no-scroll');
  const f = el.querySelector('input:not([hidden]), textarea, button:not([data-close])');
  if (f) f.focus();
}
function closeModal(el) {
  el.hidden = true;
  if (document.querySelectorAll('.modal:not([hidden])').length === 0 && !$('cartDrawer').classList.contains('open')) document.body.classList.remove('no-scroll');
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}
document.querySelectorAll('.modal').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m || e.target.hasAttribute('data-close')) closeModal(m); });
});
function openDrawer() { renderCart(); $('cartDrawer').classList.add('open'); $('cartDrawer').setAttribute('aria-hidden', 'false'); $('drawerBackdrop').hidden = false; document.body.classList.add('no-scroll'); }
function closeDrawer() { $('cartDrawer').classList.remove('open'); $('cartDrawer').setAttribute('aria-hidden', 'true'); $('drawerBackdrop').hidden = true; document.body.classList.remove('no-scroll'); }
$('drawerBackdrop').addEventListener('click', closeDrawer);
document.querySelector('[data-close-drawer]').addEventListener('click', closeDrawer);
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  document.querySelectorAll('.modal:not([hidden])').forEach(closeModal);
  closeDrawer();
});

/* ---------- navegação (menu mobile, filtros, busca) ---------- */
$('menuBtn').addEventListener('click', () => $('mainNav').classList.toggle('mobile-open'));
document.querySelectorAll('.nav a').forEach(a => a.addEventListener('click', () => $('mainNav').classList.remove('mobile-open')));
$('filterBtn').addEventListener('click', () => $('filters').classList.toggle('open'));
document.querySelectorAll('.filters button').forEach(btn => btn.addEventListener('click', () => {
  document.querySelector('.filters button.active').classList.remove('active');
  btn.classList.add('active');
  state.category = btn.dataset.filter;
  loadProducts();
}));
$('searchBtn').addEventListener('click', () => {
  const bar = $('searchBar'); bar.hidden = !bar.hidden;
  if (!bar.hidden) $('searchInput').focus();
});
$('searchBar').addEventListener('submit', e => {
  e.preventDefault();
  state.q = $('searchInput').value.trim();
  loadProducts().then(() => $('shop').scrollIntoView({ behavior: 'smooth' }));
});
$('searchClear').addEventListener('click', () => { $('searchInput').value = ''; state.q = ''; loadProducts(); });

/* ---------- drop ---------- */
async function loadDrop() {
  const drop = await api('/drops/current');
  state.drop = drop; syncClock(drop.server_time);
  renderDrop();
  await loadProducts();
}

function renderDrop() {
  const d = state.drop; if (!d) return;
  const num = pad2(d.number).padStart(3, '0');
  $('heroEyebrow').textContent = `DROP ${num} / LIMITED EDITION`;
  $('dropNumberTitle').textContent = num;
  $('dropNumber').textContent = num;
  const nameEl = $('dropName'); clear(nameEl);
  const parts = d.name.split(' ');
  parts.forEach((p, i) => { nameEl.append(p); if (i < parts.length - 1) nameEl.append(document.createElement('br')); });
  $('dropTagline').textContent = d.tagline || '';
  $('stock').textContent = d.stock_left;
  $('countdownLabel').textContent = d.status === 'live' ? 'DROP ENCERRA EM' : d.status === 'upcoming' ? 'DROP COMEÇA EM' : 'DROP ENCERRADO';

  const a = d.access;
  const limit = `LIMITE DE ${d.max_per_user} PEÇA(S) POR PESSOA` + (state.user ? ` · VOCÊ JÁ COMPROU ${d.my_purchased}` : '');
  let msg;
  if (d.status === 'ended') msg = 'ESTE DROP FOI ENCERRADO. FIQUE LIGADO NO PRÓXIMO.';
  else if (a.can_buy && a.early_access) msg = `ACESSO ANTECIPADO LIBERADO PARA VOCÊ · ${limit}`;
  else if (a.can_buy) msg = `VOCÊ TEM ACESSO · ${limit}`;
  else if (a.reason === 'login') msg = `ENTRE NA SUA CONTA PARA COMPRAR · ${limit}`;
  else if (a.reason === 'level') msg = `ESTE DROP EXIGE NÍVEL ${d.min_level}.`;
  else if (a.reason === 'not_started') {
    msg = d.early_access_level
      ? `NÍVEL ${d.early_access_level}+ ENTRA ${d.early_access_hours}H ANTES (A PARTIR DE ${fmtDateTime(a.early_access_opens_at)}).`
      : 'AINDA NÃO COMEÇOU.';
  }
  $('dropAccess').textContent = msg || '';
  tick();
}

async function loadProducts() {
  const box = $('products');
  if (!state.drop) return;
  const params = new URLSearchParams({ drop_id: state.drop.id });
  if (state.category !== 'all') params.set('category', state.category);
  if (state.q) params.set('q', state.q);
  try { state.products = await api('/products?' + params); }
  catch (e) { clear(box); box.append(h('p', { class: 'empty-note', text: e.message })); return; }
  renderProducts();
  reconcileCart();
}

function renderProducts() {
  const box = $('products'); clear(box);
  if (!state.products.length) { box.append(h('p', { class: 'empty-note', text: state.q ? `Nenhuma peça encontrada para "${state.q}".` : 'Nenhuma peça nesta categoria.' })); return; }
  state.products.forEach((p, i) => {
    const soldOut = p.sold_out;
    box.append(h('article', { class: 'product' + (soldOut ? ' sold-out' : ''), dataset: { category: p.category } },
      h('div', { class: `product-image product-${p.theme}`, onclick: () => openProduct(p.id) },
        h('span', { text: p.badge_text }), h('b', { text: pad2(i + 1) }),
        soldOut ? h('em', { class: 'sold-tag', text: 'ESGOTADO' }) : null),
      h('div', { class: 'product-info' },
        h('div', {}, h('button', { class: 'name-btn', type: 'button', onclick: () => openProduct(p.id) }, h('h3', { text: p.name })), h('p', { text: p.subtitle || '' })),
        h('strong', { text: money(p.price) })),
      h('button', { class: 'add-btn', type: 'button', disabled: soldOut, onclick: () => addToCart(p) }, soldOut ? 'ESGOTADO' : 'ADICIONAR +')));
  });
}

function openProduct(id) {
  const p = state.products.find(x => x.id === id); if (!p) return;
  $('pmImage').className = `product-image product-${p.theme}`;
  $('pmBadge').textContent = p.badge_text;
  $('pmMeta').textContent = `${p.category_name.toUpperCase()} / DROP ${pad2(p.drop_number).padStart(3, '0')}`;
  $('pmName').textContent = p.name;
  $('pmDesc').textContent = p.description || p.subtitle || '';
  $('pmPrice').textContent = money(p.price);
  $('pmStock').textContent = p.sold_out ? 'ESGOTADO' : `RESTAM ${p.stock} UNIDADE(S)`;
  const add = $('pmAdd'); add.disabled = p.sold_out; add.onclick = () => { addToCart(p); closeModal($('productModal')); };
  openModal($('productModal'));
}

/* ---------- contagens regressivas ---------- */
const fired = new Set();
function tick() {
  const d = state.drop;
  if (d && d.countdown_to) {
    const left = Date.parse(d.countdown_to) - nowMs();
    $('countdown').textContent = fmtDuration(left);
    if (left <= 0 && !fired.has('drop' + d.countdown_to)) { fired.add('drop' + d.countdown_to); loadDrop().catch(() => {}); }
  } else if (d) $('countdown').textContent = '00:00:00';
  const p = state.poll;
  if (p) {
    if (p.status === 'open') {
      const left = Date.parse(p.ends_at) - nowMs();
      $('voteTimer').textContent = 'ENDS IN ' + fmtDuration(left);
      if (left <= 0 && !fired.has('poll' + p.ends_at)) { fired.add('poll' + p.ends_at); loadPoll().catch(() => {}); }
    } else $('voteTimer').textContent = p.status === 'ended' ? 'ENCERRADA' : 'EM BREVE';
  }
}
setInterval(tick, 1000);

/* ---------- carrinho ---------- */
const saveCart = () => store.set('dl_cart', JSON.stringify(state.cart));
const cartQty = () => state.cart.reduce((s, i) => s + i.qty, 0);
const productById = id => state.products.find(p => p.id === id);
// quantas peças ainda posso colocar no carrinho neste drop (limite por pessoa menos o que já comprei)
const allowance = () => (state.drop ? Math.max(0, state.drop.max_per_user - (state.drop.my_purchased || 0)) : 0);

function updateCartBadge() { $('cartCount').textContent = cartQty(); }

function reconcileCart() {
  // só vale para a visão sem filtro: com filtro/busca a lista de produtos é parcial
  if (state.category !== 'all' || state.q) { updateCartBadge(); return; }
  state.cart = state.cart.filter(i => productById(i.id) && !productById(i.id).sold_out)
    .map(i => ({ id: i.id, qty: Math.min(i.qty, productById(i.id).stock) }));
  saveCart(); updateCartBadge();
  if ($('cartDrawer').classList.contains('open')) renderCart();
}

function addToCart(p) {
  const line = state.cart.find(i => i.id === p.id);
  const qty = (line ? line.qty : 0) + 1;
  if (qty > p.stock) return showToast(`Só restam ${p.stock} unidade(s) de ${p.name}.`);
  if (state.drop && cartQty() + 1 > allowance()) return showToast(`Limite de ${state.drop.max_per_user} peça(s) por pessoa neste drop (você já comprou ${state.drop.my_purchased || 0}).`);
  if (line) line.qty = qty; else state.cart.push({ id: p.id, qty: 1 });
  saveCart(); updateCartBadge();
  showToast(`${p.name} adicionado ao carrinho.`);
}

function renderCart() {
  const list = $('cartList'); clear(list);
  $('cartError').textContent = '';
  let total = 0;
  if (!state.cart.length) list.append(h('li', { class: 'empty-note', text: 'Seu carrinho está vazio.' }));
  state.cart.forEach(line => {
    const p = productById(line.id) || { name: `Produto ${line.id}`, price: 0, stock: line.qty, theme: 'black' };
    total += p.price * line.qty;
    const change = delta => {
      const q = line.qty + delta;
      if (q > p.stock) return showToast(`Só restam ${p.stock} unidade(s).`);
      if (delta > 0 && state.drop && cartQty() + 1 > allowance()) return showToast(`Limite de ${state.drop.max_per_user} peça(s) por pessoa neste drop.`);
      if (q <= 0) state.cart = state.cart.filter(i => i !== line); else line.qty = q;
      saveCart(); updateCartBadge(); renderCart();
    };
    list.append(h('li', { class: 'cart-line' },
      h('div', { class: `cart-thumb product-${p.theme}` }),
      h('div', { class: 'cart-meta' }, h('strong', { text: p.name }), h('span', { text: money(p.price) })),
      h('div', { class: 'qty' },
        h('button', { type: 'button', 'aria-label': 'Diminuir', onclick: () => change(-1) }, '−'),
        h('b', { text: line.qty }),
        h('button', { type: 'button', 'aria-label': 'Aumentar', onclick: () => change(1) }, '+'))));
  });
  $('cartTotal').textContent = money(Math.round(total * 100) / 100);
  $('checkoutBtn').disabled = !state.cart.length;
}
$('cartBtn').addEventListener('click', openDrawer);

$('checkoutBtn').addEventListener('click', async () => {
  if (!state.user) { closeDrawer(); showToast('Entre na sua conta para finalizar.'); return openAuth('login'); }
  const btn = $('checkoutBtn'); btn.disabled = true; $('cartError').textContent = '';
  try {
    const order = await api('/orders', { method: 'POST', body: { items: state.cart.map(i => ({ product_id: i.id, quantity: i.qty })) } });
    state.cart = []; saveCart(); updateCartBadge(); closeDrawer();
    showToast(`Pedido #${order.id} confirmado · ${money(order.total)}`);
    announce(order.gamification);
    await Promise.all([loadDrop(), refreshMe(), loadRewards()]);
  } catch (e) {
    $('cartError').textContent = errText(e);
    if (e.code === 'OUT_OF_STOCK') loadDrop().catch(() => {});
  } finally { btn.disabled = !state.cart.length; }
});

/* ---------- autenticação ---------- */
let authMode = 'login';
function setAuthMode(mode) {
  authMode = mode;
  document.querySelectorAll('[data-auth-tab]').forEach(b => b.classList.toggle('active', b.dataset.authTab === mode));
  document.querySelectorAll('#authForm [data-only]').forEach(n => { n.hidden = n.dataset.only !== mode; });
  $('authTitle').textContent = mode === 'login' ? 'ENTRAR NO LAB' : 'CRIAR CONTA';
  $('authSubmit').textContent = mode === 'login' ? 'ENTRAR' : 'CRIAR CONTA';
  $('authForm').elements.password.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  $('authError').textContent = '';
}
function openAuth(mode = 'login') { setAuthMode(mode); openModal($('authModal')); }
document.querySelectorAll('[data-auth-tab]').forEach(b => b.addEventListener('click', () => setAuthMode(b.dataset.authTab)));

$('authForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target.elements; const err = $('authError'); err.textContent = '';
  const body = { email: f.email.value.trim(), password: f.password.value };
  if (!body.email || !body.password) { err.textContent = 'Preencha e-mail e senha.'; return; }
  if (authMode === 'register') {
    body.name = f.name.value.trim();
    if (f.referral_code.value.trim()) body.referral_code = f.referral_code.value.trim();
  }
  const btn = $('authSubmit'); btn.disabled = true;
  try {
    const out = await api(authMode === 'login' ? '/auth/login' : '/auth/register', { method: 'POST', body });
    state.token = out.token; store.set('dl_token', out.token);
    e.target.reset(); closeModal($('authModal'));
    showToast(authMode === 'login' ? `Bem-vindo de volta, ${out.user.name.split(' ')[0]}!` : 'Conta criada! Bem-vindo ao Lab.');
    if (out.gamification) announce(out.gamification);
    await afterAuthChange();
  } catch (ex) { err.textContent = errText(ex); }
  finally { btn.disabled = false; }
});

function logout(expired = false) {
  state.token = null; state.user = null; state.me = null; store.del('dl_token');
  renderAccountButton(); renderLevelCard(); renderBadges();
  if (expired) showToast('Sua sessão expirou. Entre novamente.');
  if (!expired) afterAuthChange();
}
async function afterAuthChange() {
  await refreshMe();
  await Promise.all([loadDrop().catch(() => {}), loadPoll().catch(() => {}), loadRewards().catch(() => {})]);
}

async function refreshMe() {
  if (!state.token) { state.user = null; state.me = null; renderAccountButton(); renderLevelCard(); renderBadges(); return; }
  try {
    const [user, me] = await Promise.all([api('/auth/me'), api('/gamification/me')]);
    state.user = user; state.me = me;
  } catch { state.user = null; state.me = null; }
  renderAccountButton(); renderLevelCard(); renderBadges(); renderComments();
}

function renderAccountButton() {
  const b = $('accountBtn');
  b.textContent = state.user ? `${state.user.name.split(' ')[0].toUpperCase()} · LV${pad2(state.user.level.number)}` : 'ENTRAR';
  b.classList.toggle('logged', !!state.user);
}
$('accountBtn').addEventListener('click', () => { if (state.user) openAccount(); else openAuth('login'); });

/* ---------- nível, XP e badges ---------- */
function renderLevelCard() {
  const u = state.user;
  if (!u) {
    $('levelName').textContent = 'ENTRE PARA VER SEU NÍVEL';
    $('levelXp').textContent = ''; $('levelBar').style.width = '0%';
    return;
  }
  const l = u.level;
  $('levelName').textContent = `NÍVEL ${pad2(l.number)} — ${l.name}`;
  $('levelXp').textContent = `${u.xp.toLocaleString('pt-BR')} / ${l.next ? l.next.min_xp.toLocaleString('pt-BR') : 'MAX'} XP`;
  $('levelBar').style.width = Math.round(l.progress * 100) + '%';
}
function badgeNodes(list) {
  return list.map(b => h('span', { class: 'badge' + (b.earned ? ' earned' : ''), title: `${b.name} — ${b.description}${b.earned ? '' : ' (bloqueado)'}` },
    h('i', { text: b.icon }), h('em', { text: b.name })));
}
function renderBadges() {
  const box = $('badges'); clear(box);
  if (state.me) box.append(...badgeNodes(state.me.badges));
}

/* ---------- conta ---------- */
async function openAccount() {
  const u = state.user; if (!u) return;
  $('acName').textContent = u.name; $('acEmail').textContent = u.email.toUpperCase();
  $('acLevel').textContent = `NÍVEL ${pad2(u.level.number)} — ${u.level.name}`;
  $('acXp').textContent = `${u.xp.toLocaleString('pt-BR')} / ${u.level.next ? u.level.next.min_xp.toLocaleString('pt-BR') : 'MAX'} XP`;
  $('acBar').style.width = Math.round(u.level.progress * 100) + '%';
  $('acRef').textContent = u.referral_code;
  const bd = $('acBadges'); clear(bd); if (state.me) bd.append(...badgeNodes(state.me.badges));
  openModal($('accountModal'));
  await renderOrders();
  try {
    const mine = await api('/rewards/mine'); const ul = $('acRewards'); clear(ul);
    if (!mine.length) ul.append(h('li', { class: 'empty-note', text: 'Nenhuma ainda.' }));
    mine.forEach(r => ul.append(h('li', {}, h('span', { text: r.name }), h('b', { class: 'code', text: r.code }))));
  } catch { /* ignora */ }
}
async function renderOrders() {
  const ul = $('acOrders'); clear(ul);
  try {
    const orders = await api('/orders');
    if (!orders.length) ul.append(h('li', { class: 'empty-note', text: 'Você ainda não comprou nada.' }));
    orders.forEach(o => {
      const items = o.items.map(i => `${i.quantity}× ${i.name}`).join(', ');
      ul.append(h('li', { class: o.status === 'cancelled' ? 'cancelled' : '' },
        h('div', {}, h('strong', { text: `#${o.id} · DROP ${pad2(o.drop.number).padStart(3, '0')} · ${money(o.total)}` }), h('small', { text: `${items} — ${o.status === 'cancelled' ? 'cancelado' : 'confirmado'}` })),
        o.status === 'confirmed' ? h('button', { class: 'mini-btn', type: 'button', onclick: () => cancelOrder(o.id) }, 'CANCELAR') : null));
    });
  } catch (e) { ul.append(h('li', { class: 'empty-note', text: e.message })); }
}
async function cancelOrder(id) {
  if (!confirm(`Cancelar o pedido #${id}? O XP ganho nessa compra será devolvido.`)) return;
  try {
    await api(`/orders/${id}/cancel`, { method: 'POST' });
    showToast(`Pedido #${id} cancelado.`);
    await Promise.all([renderOrders(), refreshMe(), loadDrop()]);
  } catch (e) { showToast(errText(e)); }
}
$('logoutBtn').addEventListener('click', () => { closeModal($('accountModal')); logout(); showToast('Você saiu da conta.'); });

/* ---------- votação ---------- */
async function loadPoll() {
  try { state.poll = await api('/polls/current'); } catch (e) { if (e.status === 404) { state.poll = null; $('voteCard').hidden = true; } return; }
  $('voteCard').hidden = false; syncClock(state.poll.server_time);
  renderPoll(); tick();
}
function renderPoll() {
  const p = state.poll; if (!p) return;
  const t = $('voteTitle'); clear(t);
  const mid = Math.ceil(p.title.length / 2); const sp = p.title.indexOf(' ', mid);
  if (sp > 0) { t.append(p.title.slice(0, sp).toUpperCase(), document.createElement('br'), p.title.slice(sp + 1).toUpperCase()); } else t.textContent = p.title.toUpperCase();
  const box = $('voteOptions'); clear(box);
  const closed = p.status !== 'open'; const voted = p.my_vote !== null;
  p.options.forEach((o, i) => {
    box.append(h('button', { class: 'vote-option' + (o.id === p.my_vote ? ' selected' : ''), type: 'button', disabled: closed || voted, dataset: { id: o.id }, onclick: () => vote(o.id) },
      h('span', { text: String.fromCharCode(65 + i) }), ' ' + o.label + ' ', h('b', { text: `${o.percent}%` })));
  });
  const mine = p.options.find(o => o.id === p.my_vote);
  $('voteMessage').textContent =
    mine ? `Voto registrado: ${mine.label}. Total de votos: ${p.total_votes}.` :
    p.status === 'ended' ? 'Votação encerrada.' :
    p.status === 'upcoming' ? 'Esta votação ainda não começou.' :
    state.user ? `Seu voto vale +50 XP e ajuda a construir o próximo drop. (${p.total_votes} votos)` :
    'Entre na sua conta para votar e ganhar +50 XP.';
}
async function vote(optionId) {
  if (!state.user) { showToast('Entre na sua conta para votar.'); return openAuth('login'); }
  try {
    const out = await api(`/polls/${state.poll.id}/vote`, { method: 'POST', body: { option_id: optionId } });
    state.poll = out.poll; renderPoll();
    announce(out.gamification);
    refreshMe();
  } catch (e) { showToast(errText(e)); loadPoll(); }
}

/* ---------- comentários ---------- */
async function loadComments() {
  if (!state.drop) return;
  try { state.comments = await api(`/drops/${state.drop.id}/comments`); } catch { state.comments = []; }
  renderComments();
}
function renderComments() {
  const ul = $('comments'); clear(ul);
  $('wallCount').textContent = state.comments.length ? `${state.comments.length} ÚLTIMOS` : '';
  if (!state.comments.length) ul.append(h('li', { class: 'empty-note', text: 'Seja o primeiro a comentar neste drop.' }));
  state.comments.forEach(c => {
    const mine = state.user && (state.user.id === c.user_id || state.user.role === 'admin');
    ul.append(h('li', { class: 'comment' },
      h('div', { class: 'comment-head' }, h('b', { text: c.author }), h('time', { text: ago(c.created_at) }),
        mine ? h('button', { class: 'mini-btn', type: 'button', 'aria-label': 'Excluir comentário', onclick: () => deleteComment(c.id) }, '✕') : null),
      h('p', { text: c.body })));
  });
}
async function deleteComment(id) {
  try { await api(`/comments/${id}`, { method: 'DELETE' }); await loadComments(); } catch (e) { showToast(errText(e)); }
}
$('commentForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (!state.user) { showToast('Entre na sua conta para comentar.'); return openAuth('login'); }
  const ta = $('commentBody'); const body = ta.value.trim();
  if (!body) return;
  const btn = e.target.querySelector('button'); btn.disabled = true;
  try {
    const out = await api(`/drops/${state.drop.id}/comments`, { method: 'POST', body: { body } });
    ta.value = ''; announce(out.gamification);
    await Promise.all([loadComments(), refreshMe()]);
  } catch (ex) { showToast(errText(ex)); }
  finally { btn.disabled = false; }
});

/* ---------- recompensas e regras de XP ---------- */
async function loadRewards() {
  try { state.rewards = await api('/rewards'); } catch { state.rewards = []; }
  renderRewards();
}
function renderRewards() {
  const grid = $('rewardGrid'); clear(grid);
  state.rewards.forEach((r, i) => {
    const locked = !r.unlocked && !r.claimed;
    let action;
    if (r.claimed) action = h('b', { class: 'code', text: r.claim_code });
    else if (r.sold_out) action = h('small', { text: 'ESGOTADO' });
    else if (!state.user) action = h('small', { text: `NÍVEL ${r.min_level}` });
    else if (!r.unlocked) action = h('small', { text: `ALCANCE O NÍVEL ${r.min_level}` });
    else action = h('button', { class: 'mini-btn claim', type: 'button', onclick: () => claim(r.id) }, 'RESGATAR');
    grid.append(h('div', { class: 'reward' + (locked ? ' locked' : '') },
      h('span', { text: pad2(i + 1) }),
      h('strong', { text: locked ? 'LOCKED' : r.name.toUpperCase() }),
      h('p', { text: locked ? `Alcance o nível ${r.min_level}` : r.description }),
      action));
  });
}
async function claim(id) {
  try {
    const out = await api(`/rewards/${id}/claim`, { method: 'POST' });
    showToast(`Resgatado! Código: ${out.code}`);
    await loadRewards();
  } catch (e) { showToast(errText(e)); }
}
async function loadRules() {
  try {
    const rules = await api('/gamification/rules'); const ul = $('xpRules'); clear(ul);
    rules.forEach(r => ul.append(h('li', {}, h('b', { text: `+${r.xp} XP` }), ' ' + r.text)));
  } catch { /* ignora */ }
}

/* ---------- inicialização ---------- */
async function init() {
  updateCartBadge(); renderAccountButton(); setAuthMode('login');
  if (location.protocol === 'file:') {
    $('products').replaceChildren(h('p', { class: 'empty-note', text: 'Abra o site pelo servidor: http://localhost:3000 (veja o README). Abrir o arquivo direto não conecta à API.' }));
    return;
  }
  try {
    await refreshMe();
    await loadDrop();
  } catch (e) {
    $('products').replaceChildren(h('p', { class: 'empty-note', text: e.status === 404 ? 'Nenhum drop cadastrado ainda.' : `Não foi possível carregar o drop: ${e.message}` }));
  }
  await Promise.all([loadPoll(), loadRewards(), loadRules(), loadComments()]);
}
init();
