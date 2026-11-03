-- =====================================================================
-- DripLab — novos produtos do Shop (Drop 004) com fotos de frente e verso
-- Antes: "npm run db:setup" (ou db:migrate) já rodado.
-- Rode no MySQL com o banco selecionado:   USE driplab;
-- Pode rodar de novo sem duplicar: produto que já existe (mesmo nome) é ignorado.
-- Para mudar preço/estoque/nome, edite os valores abaixo ANTES de rodar.
-- =====================================================================

-- 1) Nova categoria "Shorts" (a categoria é criada só se ainda não existir)
INSERT INTO categories (slug, name)
SELECT 'short', 'Shorts' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'short');

-- 2) Fotos dos 4 produtos que já existiam
UPDATE products SET image_url = 'img/produtos/moletom2.png', image_back_url = 'img/produtos/moletom2verso.png' WHERE name = 'Glitch Hoodie';   -- moletom preto
UPDATE products SET image_url = 'img/produtos/camisa1.png',  image_back_url = 'img/produtos/camisa1verso.png'  WHERE name = 'Digital Core Tee';  -- camiseta preta
UPDATE products SET image_url = 'img/produtos/camisa3.png',  image_back_url = 'img/produtos/camisa3verso.png'  WHERE name = 'Error Tee';         -- camiseta azul
UPDATE products SET image_url = 'img/produtos/bone2.png',    image_back_url = 'img/produtos/bone2lado.png'     WHERE name = 'Lab Cap';           -- boné off white

-- 3) Produtos novos.  Colunas: categoria, nome, subtítulo, descrição, preço, estoque, tema, selo, foto frente, foto verso
INSERT INTO products (drop_id, category_id, name, subtitle, description, price, stock_initial, stock, theme, badge_text, image_url, image_back_url, active, created_at)
SELECT d.id, c.id, v.name, v.subtitle, v.description, v.price, v.stock, v.stock, v.theme, v.badge, v.img, v.img_back, 1, UTC_TIMESTAMP()
FROM (
  SELECT 'hoodie' AS cat, 'Ice Hoodie' AS name, 'Off White / Limited' AS subtitle, 'Moletom canguru off white com logo bordado e globo na manga.' AS description, 339.00 AS price, 10 AS stock, 'white' AS theme, 'ICE' AS badge, 'img/produtos/moletom1.png' AS img, 'img/produtos/moletom1verso.png' AS img_back
  UNION ALL SELECT 'hoodie', 'Cobalt Hoodie', 'Cobalt Blue / Limited', 'Moletom azul cobalto com logo laranja e estampa vertical na manga.', 359.00, 8, 'purple', 'COBT', 'img/produtos/moletom3.png', 'img/produtos/moletom3verso.png'
  UNION ALL SELECT 'tee', 'Bone Tee', 'Off White / Limited', 'Camiseta boxy fit off white, algodão pesado, etiqueta laranja.', 189.00, 12, 'white', 'BONE', 'img/produtos/camisa2.png', 'img/produtos/camisa2verso.png'
  UNION ALL SELECT 'short', 'Denim Short', 'Blue Denim / Limited', 'Bermuda jeans larga com logo bordado na barra.', 249.00, 10, 'purple', 'DNM', 'img/produtos/short1.png', 'img/produtos/short1verso.png'
  UNION ALL SELECT 'short', 'Black Cargo Denim', 'Black / Limited', 'Bermuda jeans preta cargo com bolsos laterais.', 269.00, 8, 'black', 'CRGO', 'img/produtos/short2.png', 'img/produtos/short2verso.png'
  UNION ALL SELECT 'short', 'Utility Cargo Short', 'Black / Limited', 'Bermuda cargo em sarja com cordão e bolsos utilitários.', 259.00, 9, 'black', 'UTIL', 'img/produtos/short3.png', 'img/produtos/short3verso.png'
  UNION ALL SELECT 'accessory', 'Night Cap', 'Black / Limited', 'Boné preto com logo bordado em laranja.', 129.00, 15, 'black', 'NITE', 'img/produtos/bone1.png', 'img/produtos/bone1lado.png'
  UNION ALL SELECT 'accessory', 'Cobalt Cap', 'Cobalt Blue / Limited', 'Boné azul cobalto com logo bordado em laranja.', 129.00, 15, 'purple', 'COBT', 'img/produtos/bone3.png', 'img/produtos/bone3lado.png'
  UNION ALL SELECT 'accessory', 'Drip Bottle', 'Black / Limited', 'Garrafa térmica preta com alça e logo DripLab.', 119.00, 20, 'black', 'BTL', 'img/produtos/garrafadriplab.png', NULL
  UNION ALL SELECT 'accessory', 'Drip Tumbler', 'Black / Limited', 'Copo térmico de aço inox com logo DripLab.', 89.00, 20, 'black', 'CUP', 'img/produtos/copodriplab.png', NULL
  UNION ALL SELECT 'accessory', 'Drip Pouch', 'Black / Limited', 'Necessaire neoprene com patch DripLab e puxador.', 79.00, 25, 'black', 'BAG', 'img/produtos/bagdriplab.png', NULL
) AS v
JOIN categories c ON c.slug = v.cat
JOIN drops d ON d.number = 4
WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.name = v.name);

-- Conferir:
--   SELECT p.id, p.name, c.name AS categoria, p.price, p.stock, p.image_url, p.image_back_url
--   FROM products p JOIN categories c ON c.id = p.category_id ORDER BY p.id;
