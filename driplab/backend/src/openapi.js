'use strict';

const obj = (props, required = []) => ({ type: 'object', properties: props, ...(required.length ? { required } : {}) });
const S = { string: { type: 'string' }, int: { type: 'integer' }, num: { type: 'number' }, bool: { type: 'boolean' }, dt: { type: 'string', format: 'date-time' } };

const BODY = {
  register: obj({ name: S.string, email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 8, description: 'Letras e números' }, referral_code: S.string }, ['name', 'email', 'password']),
  login: obj({ email: { type: 'string', format: 'email' }, password: S.string }, ['email', 'password']),
  userCreate: obj({ name: S.string, email: S.string, password: S.string, role: { type: 'string', enum: ['user', 'admin'] } }, ['name', 'email', 'password']),
  userUpdate: obj({ name: S.string, email: S.string, password: S.string, current_password: S.string, role: { type: 'string', enum: ['user', 'admin'] } }),
  category: obj({ slug: S.string, name: S.string }, ['slug', 'name']),
  product: obj({ drop_id: S.int, category_id: S.int, name: S.string, subtitle: S.string, description: S.string, price: S.num, stock: S.int, theme: { type: 'string', enum: ['black', 'green', 'purple', 'white'] }, badge_text: S.string, image_url: { type: 'string', description: 'Foto da frente' }, image_back_url: { type: 'string', description: 'Foto do verso (opcional)' } }, ['drop_id', 'category_id', 'name', 'price', 'stock']),
  drop: obj({ number: S.int, name: S.string, tagline: S.string, description: S.string, starts_at: S.dt, ends_at: S.dt, min_level: S.int, early_access_level: S.int, early_access_hours: S.int, max_per_user: S.int }, ['number', 'name', 'starts_at', 'ends_at']),
  order: obj({ items: { type: 'array', items: obj({ product_id: S.int, quantity: S.int }, ['product_id', 'quantity']) } }, ['items']),
  poll: obj({ title: S.string, description: S.string, starts_at: S.dt, ends_at: S.dt, min_level: S.int, options: { type: 'array', items: obj({ label: S.string, description: S.string }, ['label']) } }, ['title', 'starts_at', 'ends_at', 'options']),
  pollUpdate: obj({ title: S.string, description: S.string, starts_at: S.dt, ends_at: S.dt, min_level: S.int }),
  option: obj({ label: S.string, description: S.string }, ['label']),
  vote: obj({ option_id: S.int }, ['option_id']),
  comment: obj({ body: { type: 'string', maxLength: 500 } }, ['body']),
  badge: obj({ code: S.string, name: S.string, description: S.string, icon: S.string }, ['code', 'name', 'description']),
  reward: obj({ name: S.string, description: S.string, min_level: S.int, stock: S.int, active: S.bool }, ['name', 'description']),
};

const META = {
  'GET /api/health': ['Sistema', 'Verifica se API e banco estão no ar'],
  'POST /api/auth/register': ['Autenticação', 'Cria conta (+50 XP; código de indicação opcional dá +200 XP ao indicador)', 'register', 201],
  'POST /api/auth/login': ['Autenticação', 'Login — devolve token JWT', 'login'],
  'GET /api/auth/me': ['Autenticação', 'Dados do usuário logado, com nível e XP'],
  'GET /api/users/ranking': ['Usuários', 'Ranking público por XP'],
  'GET /api/users': ['Usuários', 'Lista usuários (admin). Query: q, limit, offset'],
  'POST /api/users': ['Usuários', 'Cria usuário (admin)', 'userCreate', 201],
  'GET /api/users/{id}': ['Usuários', 'Busca usuário (próprio ou admin)'],
  'PUT /api/users/{id}': ['Usuários', 'Atualiza usuário (nome/senha; e-mail e perfil só admin)', 'userUpdate'],
  'DELETE /api/users/{id}': ['Usuários', 'Exclui usuário sem pedidos (próprio ou admin)', null, 204],
  'GET /api/categories': ['Catálogo', 'Lista categorias'],
  'POST /api/categories': ['Catálogo', 'Cria categoria (admin)', 'category', 201],
  'PUT /api/categories/{id}': ['Catálogo', 'Atualiza categoria (admin)', 'category'],
  'DELETE /api/categories/{id}': ['Catálogo', 'Exclui categoria sem produtos (admin)', null, 204],
  'GET /api/products': ['Catálogo', 'Lista produtos. Query: drop_id, category (slug), q, include_inactive=1 (admin)'],
  'GET /api/products/{id}': ['Catálogo', 'Detalhe do produto'],
  'POST /api/products': ['Catálogo', 'Cria produto (admin)', 'product', 201],
  'PUT /api/products/{id}': ['Catálogo', 'Atualiza produto (admin)', 'product'],
  'DELETE /api/products/{id}': ['Catálogo', 'Exclui produto nunca vendido (admin)', null, 204],
  'GET /api/drops': ['Drops', 'Lista drops com status, estoque e acesso do usuário'],
  'GET /api/drops/current': ['Drops', 'Drop da vez (no ar → próximo → último) com produtos'],
  'GET /api/drops/{id}': ['Drops', 'Detalhe do drop com produtos'],
  'POST /api/drops': ['Drops', 'Cria drop (admin)', 'drop', 201],
  'PUT /api/drops/{id}': ['Drops', 'Atualiza drop (admin)', 'drop'],
  'DELETE /api/drops/{id}': ['Drops', 'Exclui drop sem pedidos (admin)', null, 204],
  'GET /api/drops/{id}/comments': ['Comunidade', 'Comentários do drop (mais recentes primeiro)'],
  'POST /api/drops/{id}/comments': ['Comunidade', 'Comenta no drop (+10 XP, até 5/dia)', 'comment', 201],
  'PUT /api/comments/{id}': ['Comunidade', 'Edita o próprio comentário', 'comment'],
  'DELETE /api/comments/{id}': ['Comunidade', 'Exclui comentário (autor ou admin)', null, 204],
  'POST /api/orders': ['Pedidos', 'Checkout: valida drop/nível/limite/estoque, baixa estoque e dá +100 XP por peça', 'order', 201],
  'GET /api/orders': ['Pedidos', 'Meus pedidos (admin: ?scope=all)'],
  'GET /api/orders/{id}': ['Pedidos', 'Detalhe do pedido'],
  'POST /api/orders/{id}/cancel': ['Pedidos', 'Cancela pedido (devolve estoque e XP) enquanto o drop não encerrou'],
  'DELETE /api/orders/{id}': ['Pedidos', 'Exclui pedido já cancelado (admin)', null, 204],
  'GET /api/polls': ['Votações', 'Lista votações (?status=open|upcoming|ended)'],
  'GET /api/polls/current': ['Votações', 'Votação aberta que encerra primeiro (ou a última)'],
  'GET /api/polls/{id}': ['Votações', 'Detalhe com resultados parciais'],
  'POST /api/polls': ['Votações', 'Cria votação com opções (admin)', 'poll', 201],
  'PUT /api/polls/{id}': ['Votações', 'Atualiza votação (admin)', 'pollUpdate'],
  'DELETE /api/polls/{id}': ['Votações', 'Exclui votação (admin)', null, 204],
  'POST /api/polls/{id}/options': ['Votações', 'Adiciona opção (admin)', 'option', 201],
  'PUT /api/polls/{id}/options/{optionId}': ['Votações', 'Edita opção (admin)', 'option'],
  'DELETE /api/polls/{id}/options/{optionId}': ['Votações', 'Remove opção sem votos (admin)', null, 204],
  'POST /api/polls/{id}/vote': ['Votações', 'Vota (1 por usuário; +50 XP)', 'vote'],
  'GET /api/gamification/levels': ['Gamificação', 'Tabela de níveis'],
  'GET /api/gamification/rules': ['Gamificação', 'Regras de XP'],
  'GET /api/gamification/me': ['Gamificação', 'Meu XP, nível, badges e histórico'],
  'GET /api/badges': ['Gamificação', 'Lista badges'],
  'POST /api/badges': ['Gamificação', 'Cria badge (admin)', 'badge', 201],
  'PUT /api/badges/{id}': ['Gamificação', 'Atualiza badge (admin)', 'badge'],
  'DELETE /api/badges/{id}': ['Gamificação', 'Exclui badge (admin)', null, 204],
  'GET /api/rewards': ['Gamificação', 'Lista recompensas com status de desbloqueio/resgate'],
  'GET /api/rewards/mine': ['Gamificação', 'Recompensas que resgatei'],
  'POST /api/rewards': ['Gamificação', 'Cria recompensa (admin)', 'reward', 201],
  'PUT /api/rewards/{id}': ['Gamificação', 'Atualiza recompensa (admin)', 'reward'],
  'DELETE /api/rewards/{id}': ['Gamificação', 'Exclui recompensa (admin)', null, 204],
  'POST /api/rewards/{id}/claim': ['Gamificação', 'Resgata recompensa (exige nível mínimo; 1 por usuário)', null, 201],
};

module.exports = router => {
  const paths = {};
  for (const r of router.routes) {
    const p = r.pattern.replace(/:([a-zA-Z_]+)/g, '{$1}');
    const key = `${r.method} ${p}`;
    const meta = META[key];
    if (!meta) { (module.exports.missing = module.exports.missing || []).push(key); continue; }
    const [tag, summary, body, status] = meta;
    const op = { tags: [tag], summary, responses: {} };
    const params = [...p.matchAll(/\{(\w+)\}/g)].map(m => ({ name: m[1], in: 'path', required: true, schema: { type: 'integer' } }));
    if (params.length) op.parameters = params;
    if (body) op.requestBody = { required: true, content: { 'application/json': { schema: BODY[body] } } };
    if (r.opts.auth === 'user' || r.opts.auth === 'admin') op.security = [{ bearerAuth: [] }];
    if (r.opts.auth === 'optional') op.security = [{}, { bearerAuth: [] }];
    op.responses[String(status || 200)] = { description: status === 204 ? 'Sem conteúdo' : 'Sucesso' };
    op.responses['4XX'] = { description: 'Erro do cliente', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } };
    (paths[p] = paths[p] || {})[r.method.toLowerCase()] = op;
  }
  return {
    openapi: '3.0.3',
    info: {
      title: 'DripLab API', version: '1.0.0',
      description: 'API REST da plataforma DripLab (streetwear digital-first).\n\n**Como autenticar:** faça `POST /api/auth/login`, copie o `token` e clique em *Authorize*.\n\nContas de demonstração: `admin@driplab.com / Admin@123` e `demo@driplab.com / Demo@123`.\n\nErros seguem o formato `{ "error": { "code", "message", "details" } }`.',
    },
    servers: [{ url: '/' }],
    tags: ['Sistema', 'Autenticação', 'Usuários', 'Catálogo', 'Drops', 'Pedidos', 'Votações', 'Comunidade', 'Gamificação'].map(name => ({ name })),
    paths,
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas: { Error: obj({ error: obj({ code: S.string, message: S.string, details: { type: 'object' } }) }) },
    },
  };
};
