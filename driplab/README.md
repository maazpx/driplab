# DripLab — plataforma de streetwear digital-first

Projeto Integrador (Desenvolvimento de Sistemas): front-end + API REST + banco de dados integrados.

Front-end | HTML, CSS e JavaScript puro (a base do driplabfront, agora ligada à API) |
Back-end | Node.js (módulo http nativo, sem framework) + mysql2 |
Banco | MySQL 8 (scripts SQL versionados em database/migrations) |
Documentação da API | OpenAPI/Swagger em /api/docs |

Pré-requisitos:

-Node.js 20 ou superior
-MySQL 8
-E a senha do usuário root (ou outro usuário com permissão de criar bancos).


Configurar Terminal:
  cd backend 
  npm install
  cp .env.example .env

Abra o arquivo *backend/.env* e ajuste:
- DB_PASSWORD → a senha do seu MySQL
- DB_PORT → 3306 (padrão) ou a porta que o seu MySQL usa
- JWT_SECRET → uma frase longa e aleatória (32+ caracteres).

Criar o banco e os dados de demonstração:
  npm run db:setup
-Cria o banco driplab, cria as tabelas (migration 001_init.sql) e insere os dados de exemplo
(níveis, drops, produtos, votação, comentários, badges, recompensas e usuários).
Para apagar tudo e recomeçar: 
  npm run db:reset

Subir o servidor:
  npm start


Abra *http://localhost:3000* no navegador. A documentação interativa da API está em
*http://localhost:3000/api/docs*

Contas de demonstração
| Perfil | E-mail | Senha |
| Cliente | demo@driplab.com | Demo@123 |
| Administrador | admin@driplab.com | Admin@123 |


O que o site faz
*Login e cadastro* (senha com hash scrypt, sessão por token JWT), com código de indicação.
-*Drop da vez* com contagem regressiva real (vinda do servidor), estoque somado e aviso de acesso.
-*Catálogo* com filtro por categoria, busca e detalhe do produto.
-*Carrinho e compra* (pagamento simulado): baixa de estoque, limite de peças por pessoa, XP.
-*Gamificação*: XP, 10 níveis, badges, ranking e recompensas por nível.
-*Votação* de coleção (1 voto por pessoa) e *mural de comentários*.
-*Minha conta*: pedidos (com cancelamento), badges, código de indicação e recompensas resgatadas.
- Layout *responsivo* (desktop, tablet e celular).


Estrutura do repositório

driplab/
├── backend/
│   ├── src/
│   │   ├── server.js            # ponto de entrada
│   │   ├── app.js               # HTTP, roteamento, auth, CORS, arquivos estáticos
│   │   ├── config.js            # leitura do .env
│   │   ├── openapi.js           # gera a documentação Swagger
│   │   ├── db/                  # conexão MySQL, migrator, seed
│   │   ├── lib/                 # validação, segurança (scrypt/JWT), datas, roteador
│   │   ├── routes/              # auth, users, catalog, drops, orders, polls, comments, gamification
│   │   └── services/            # regras: gamificação (XP/níveis/badges), acesso aos drops
│   ├── scripts/                 # migrate.js, seed.js
│   └── test/                    # testes automatizados para garantia de funcionamento
├── database/
│   ├── migrations/001_init.sql  # modelo físico (DDL)
│   
├── docs/MODELAGEM.md            # modelo conceitual, lógico e físico + regras de negócio
└── frontend/                    # index.html, style.css, script.js, img/


