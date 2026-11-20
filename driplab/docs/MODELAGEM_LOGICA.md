# Modelagem lógica — DripLab


Diagrama completo com todos os atributos, tipos, PK/FK/UQ e relacionamentos (gerado a partir do próprio script do banco):
[`DER-DripLab.png`](DER-DripLab.png) · [`DER-DripLab.svg`](DER-DripLab.svg).
Notação: pé de galinha = lado "muitos". `levels` aparece sem ligações de propósito (o nível é derivado de `users.xp`).
O relacionamento `votes → poll_options` é uma FK composta (`poll_id`, `option_id`), por isso aparece como uma única linha.

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
| `products` | id, drop_id, category_id, name, subtitle, description, price, stock_initial, stock, theme, badge_text, image_url (frente), image_back_url (verso, migration 002), active | PK id · FK drops, categories |
| `orders` | id, user_id, drop_id, status, total, created_at | PK id · FK users, drops |
| `order_items` | id, order_id, product_id, quantity, unit_price | PK id · FK orders (cascade), products |
| `polls` | id, title, description, starts_at, ends_at, min_level | PK id |
| `poll_options` | id, poll_id, label, description | PK id · UQ (poll_id, id) · FK polls (cascade) |
| `votes` | id, poll_id, option_id, user_id, created_at | PK id · **UQ (poll_id, user_id)** · FK composta (poll_id, option_id)→poll_options · FK users |
| `comments` | id, user_id, drop_id, body, created_at | PK id · FK users, drops (cascade) |

**Normalização (até a 3FN):**
- O **nível do usuário não é gravado**: é calculado a partir de `users.xp` e da tabela `levels` (evita dado derivado inconsistente).
- `order_items.unit_price` guarda o preço **no momento da compra** (é histórico, não redundância).
- `xp_transactions` é a fonte de verdade do histórico; `users.xp` é o saldo atual (atualizado na mesma transação).
- Categorias, níveis, badges e recompensas são tabelas próprias (sem textos repetidos).
- A FK composta em `votes` garante que a opção escolhida pertence mesmo àquela votação.

**Integridade extra (CHECK):** estoque ≥ 0, preço ≥ 0, quantidade > 0, `ends_at > starts_at`, perfil ∈ {user, admin},
tema ∈ {black, green, purple, white}, status do pedido ∈ {confirmed, cancelled}.

**Views (JOINs/agregações):** `v_poll_results` (votos por opção) e `v_drop_stock` (estoque total do drop).
**Extras opcionais** (trigger de auditoria de estoque, procedure de ranking): `database/extras/extras.sql`.

