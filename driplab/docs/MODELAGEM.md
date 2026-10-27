# Modelagem do banco de dados — DripLab

Nível físico:
[`database/migrations/001_init.sql`](../database/migrations/001_init.sql).

#1. Modelo conceitual (entidades e relacionamentos)
| Entidade | O que representa |
|---|---|
| **Usuário | Pessoa cadastrada (cliente ou administrador). Acumula XP. Pode indicar outros usuários. |
| **Nível | Faixas de XP (ROOKIE … DRIPLORD). Define acesso exclusivo e recompensas. |
| **Drop | Lançamento limitado, com janela de tempo, nível mínimo, acesso antecipado e limite por pessoa. |
| **Categoria | Hoodies, T-shirts, acessórios… |
| **Produto | Peça vendida dentro de um drop, com estoque próprio. |
| **Pedido / Item do pedido| Compra de um usuário num drop (pagamento simulado). |
| **Votação / Opção / Voto | Comunidade escolhe a próxima coleção. 1 voto por usuário por votação. |
| *Comentário | Mural da comunidade em cada drop. |
| **Badge / Badge do usuário | Conquistas. |
| *Transação de XP | Histórico (ledger) de todos os pontos ganhos/perdidos. |
| **Recompensa / Recompensa resgatada | Benefícios liberados por nível. |

Relacionamentos principais: Drop 1—N Produto · Categoria 1—N Produto · Usuário 1—N Pedido · Pedido 1—N Item ·
Produto 1—N Item · Votação 1—N Opção · Opção 1—N Voto · Usuário 1—N Voto · Usuário N—M Badge · Usuário N—M Recompensa ·
Usuário 1—N Comentário · Drop 1—N Comentário · Usuário 1—N Usuário (indicação).


#2. Modelo lógico (tabelas, chaves e atributos)
PK = chave primária · FK = chave estrangeira · UQ = único
| Tabela | Colunas principais | Chaves |
|---|---|---|
| `levels` | id, number, name, min_xp | PK id · UQ number |
| `users` | id, name, email, password_hash, role, xp, referral_code, referred_by, created_at | PK id · UQ email, referral_code · FK referred_by→users |
| `badges` | id, code, name, description, icon | PK id · UQ code |
| `user_badges` | user_id, badge_id, awarded_at | PK (user_id, badge_id) · FK users, badges |
| `xp_transactions` | id, user_id, amount, reason, description, ref_id, created_at | PK id · FK users |
| `rewards` | id, name, description, min_level, stock, active | PK id |
| `user_rewards` | id, user_id, reward_id, code, claimed_at | PK id · UQ (user_id, reward_id), code · FK users, rewards |
| `categories` | id, slug, name | PK id · UQ slug |
| `drops` | id, number, name, tagline, description, starts_at, ends_at, min_level, early_access_level, early_access_hours, max_per_user | PK id · UQ number |
| `products` | id, drop_id, category_id, name, subtitle, description, price, stock_initial, stock, theme, badge_text, image_url, active | PK id · FK drops, categories |
| `orders` | id, user_id, drop_id, status, total, created_at | PK id · FK users, drops |
| `order_items` | id, order_id, product_id, quantity, unit_price | PK id · FK orders (cascade), products |
| `polls` | id, title, description, starts_at, ends_at, min_level | PK id |
| `poll_options` | id, poll_id, label, description | PK id · UQ (poll_id, id) · FK polls (cascade) |
| `votes` | id, poll_id, option_id, user_id, created_at | PK id · **UQ (poll_id, user_id) · FK composta (poll_id, option_id)→poll_options · FK users |
| `comments` | id, user_id, drop_id, body, created_at | PK id · FK users, drops (cascade) |

**Normalização (até a 3FN):
- O **nível do usuário não é gravado: é calculado a partir de `users.xp` e da tabela `levels` (evita dado derivado inconsistente).
- `order_items.unit_price` guarda o preço **no momento da compra(é histórico, não redundância).
- `xp_transactions` é a fonte de verdade do histórico; `users.xp` é o saldo atual (atualizado na mesma transação).
- Categorias, níveis, badges e recompensas são tabelas próprias (sem textos repetidos).
- A FK composta em `votes` garante que a opção escolhida pertence mesmo àquela votação.

**Integridade extra (CHECK): estoque ≥ 0, preço ≥ 0, quantidade > 0, `ends_at > starts_at`, perfil ∈ {user, admin},
tema ∈ {black, green, purple, white}, status do pedido ∈ {confirmed, cancelled}.

**Views (JOINs/agregações): `v_poll_results` (votos por opção) e `v_drop_stock` (estoque total do drop).
**Extras opcionais (trigger de auditoria de estoque, procedure de ranking): `database/extras/extras.sql`.

#Modelo físico
Implementado em MySQL 8 (InnoDB, utf8mb4) em [`database/migrations/001_init.sql`](../database/migrations/001_init.sql).
O back-end aplica as migrations com controle de versão (`schema_migrations`): `npm run db:migrate`.

#Regras de negócio (onde estão no código)
| Regra | Implementação |
|---|---|
| Drop com contagem regressiva | `GET /api/drops/current` devolve `countdown_to` + `server_time`; o front corrige o relógio do navegador |
| Limite de peças do drop | `products.stock` com `CHECK >= 0` + `UPDATE … WHERE stock >= ?` dentro de transação com `SELECT … FOR UPDATE` |
| Limite por pessoa | `drops.max_per_user` × soma de itens confirmados do usuário no drop (`LIMIT_PER_USER`) |
| Acesso exclusivo por nível | `drops.min_level` (compra) e `early_access_level`/`early_access_hours` (entra antes) — `services/drops.js` |
| Votação | 1 voto por usuário (UQ no banco + checagem), só com a votação aberta e nível suficiente |
| XP | cadastro +50 · item comprado +100 · voto +50 · comentário +10 (5/dia) · indicação +200 — `services/gamification.js` |
| Níveis | 10 níveis em `levels`; subir de nível é detectado em cada ganho de XP |
| Badges | avaliadas automaticamente após cada ação (`FIRST_DRIP`, `COLLECTOR`, `VOTER`, `SOCIAL`, `RECRUITER`, `LEVEL_5`, `DRIPLORD`) |
| Recompensas | liberadas por nível, 1 resgate por usuário, estoque opcional |
| Cancelamento | devolve estoque e desfaz o XP da compra, só enquanto o drop não encerrou |