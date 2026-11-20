# Instalação e uso — DripLab

## Requisitos
- **Node.js 20+** (`node -v`)
- **MySQL 8** (ou MariaDB 10.5+) rodando, com usuário que possa criar bancos

## Opção A — pelo back-end (recomendada)
```bash
cd backend
npm install
copy .env.example .env      # Linux/Mac: cp .env.example .env
```
Edite `backend/.env`: `DB_PASSWORD` (senha do MySQL), `DB_PORT` (3306) e `JWT_SECRET` (frase longa e aleatória).
```bash
npm run db:setup            # cria o banco, as tabelas e os dados de exemplo
npm start                   # sobe em http://localhost:3000
```
Recomeçar do zero: `npm run db:reset`.

## Opção B — só pelos scripts SQL
Nesta pasta:
```bash
mysql -u root -p < 01_criar_banco.sql      # cria o banco `driplab` e as 16 tabelas + views
mysql -u root -p < 02_inserir_dados.sql    # insere níveis, drops, produtos, votação, usuários...
```
Depois configure o `.env` como na opção A e rode `npm start` (sem `db:setup`).
No MySQL Workbench: abra cada arquivo e execute com o raio ⚡, na ordem 01 → 02.

> Os dados de exemplo usam datas relativas ao momento da execução: o drop atual aparece sempre "aberto".

## Como usar o sistema
1. Abra **http://localhost:3000** (não abra o `index.html` com duplo clique).
2. Entre com uma conta de demonstração ou crie a sua em **ENTRAR → Criar conta**:

| Perfil | E-mail | Senha |
|---|---|---|
| Cliente | demo@driplab.com | Demo@123 |
| Administrador | admin@driplab.com | Admin@123 |

3. **Início**: drop da vez com contagem regressiva. **Shop**: filtre, veja frente/verso das peças e adicione ao carrinho.
4. **Carrinho**: finalize a compra (pagamento simulado) — ganha XP e pode subir de nível.
5. **Comunidade**: vote na próxima coleção (1 voto por pessoa) e comente.
6. **Minha conta**: pedidos (com cancelamento), badges, código de indicação e recompensas.
7. Documentação da API: **http://localhost:3000/api/docs**.

## Testes automatizados (opcional)
```bash
cd backend && npm test      # Node 22.5+; não precisa de MySQL
```

## Problemas comuns
| Mensagem | O que fazer |
|---|---|
| `ECONNREFUSED 127.0.0.1:3306` | MySQL desligado ou `DB_PORT` errada |
| `ER_ACCESS_DENIED_ERROR` | `DB_USER`/`DB_PASSWORD` do `.env` incorretos |
| `EADDRINUSE :::3000` | Porta ocupada: mude `PORT` no `.env` |
| Site sem produtos | Faltou `npm run db:setup` (ou os scripts 01 e 02) |
