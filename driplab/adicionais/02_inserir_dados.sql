-- ============================================================
-- DripLab — Dados de demonstração (INSERTs)
-- Rode DEPOIS de 01_criar_banco.sql, com o banco `driplab` selecionado.
-- Datas são relativas a UTC_TIMESTAMP(): o drop atual sempre aparece "aberto".
-- Contas: demo@driplab.com / Demo@123  ·  admin@driplab.com / Admin@123
-- ============================================================
USE driplab;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- levels (10)
INSERT INTO `levels` (`id`, `number`, `name`, `min_xp`) VALUES
  (1, 1, 'ROOKIE', 0),
  (2, 2, 'SKATER', 100),
  (3, 3, 'SNEAKERHEAD', 250),
  (4, 4, 'HYPEBEAST', 500),
  (5, 5, 'TRENDSETTER', 900),
  (6, 6, 'PLUG', 1400),
  (7, 7, 'STREET RUNNER', 2000),
  (8, 8, 'CULTURE KING', 3000),
  (9, 9, 'LEGEND', 4500),
  (10, 10, 'DRIPLORD', 6500);

-- categories (5)
INSERT INTO `categories` (`id`, `slug`, `name`) VALUES
  (1, 'hoodie', 'Hoodies'),
  (2, 'tee', 'T-Shirts'),
  (3, 'short', 'Shorts'),
  (4, 'cap', 'Bonés'),
  (5, 'accessory', 'Acessórios');

-- badges (7)
INSERT INTO `badges` (`id`, `code`, `name`, `description`, `icon`) VALUES
  (1, 'FIRST_DRIP', 'Primeiro Drip', 'Fez a primeira compra na DripLab', '🛍'),
  (2, 'COLLECTOR', 'Colecionador', 'Comprou 5 peças ou mais', '🧥'),
  (3, 'VOTER', 'Voz da Comunidade', 'Votou em uma coleção', '🗳'),
  (4, 'SOCIAL', 'Papo Reto', 'Fez 5 comentários na comunidade', '💬'),
  (5, 'RECRUITER', 'Recrutador', 'Indicou um amigo que criou conta', '🤝'),
  (6, 'LEVEL_5', 'Trendsetter', 'Chegou ao nível 5', '⚡'),
  (7, 'DRIPLORD', 'DripLord', 'Chegou ao nível máximo', '👑');

-- rewards (4)
INSERT INTO `rewards` (`id`, `name`, `description`, `min_level`, `stock`, `active`) VALUES
  (1, 'Sticker Pack Lab', 'Kit de stickers holográficos enviado com seu próximo pedido', 2, 200, 1),
  (2, 'Cupom 10% OFF', 'Cupom de 10% para usar no próximo drop', 3, NULL, 1),
  (3, 'Acesso antecipado', 'Entre 24h antes nos drops com acesso antecipado', 5, NULL, 1),
  (4, 'Hoodie DripLord', 'Hoodie numerado exclusivo para quem chegou ao topo', 10, 10, 1);

-- users (8)
INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `xp`, `referral_code`, `referred_by`, `created_at`) VALUES
  (1, 'Admin DripLab', 'admin@driplab.com', 'scrypt$16384$03b1db51e2cdbb6f111f5fbe1049f2d4$90158ca6ae6592d006ec18b4cc5aab8f05a75362f5aae289c84f19da4485ef951a873a53b9fb51249906b2bea7bb8ae0d642ef85aec240fdd21d7dd2dd8f01a4', 'admin', 0, 'M924F383', NULL, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -1728001 SECOND)),
  (2, 'Demo Runner', 'demo@driplab.com', 'scrypt$16384$34563a86236ba7d71c2bf6073b519794$c1a3d7e81fc8acc8a29a8b9760b0773f75c4d3b314249d6e1cac7a001de5fdb3e158f9b1253f92635736558e24c6d4dec2e3e5b42d2954f82022d1ff5b3fe8ee', 'user', 240, '3M3WME84', NULL, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -1728001 SECOND)),
  (3, 'Kaue Street', 'kaue@driplab.com', 'scrypt$16384$1b142215918a0e4272c885611225714d$5756d2c9ac64903b4e1a9a0629b861d6c343c946a69ef3c9e7adebb93410245b226007d9796e615dc763aace935ed86f0bf6899401ef79ba2f99b45cbc4fb41d', 'user', 1650, 'DX2P5VV7', NULL, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -1728001 SECOND)),
  (4, 'Luna Glitch', 'luna@driplab.com', 'scrypt$16384$c115e761f856aa32b6d7470c3a9d297c$261034c779d706fe2502cb5dfc68afbe54648ea785620477f7568219c2be072908c50453fa8bd345cec773a0b5885d2be33e6eea2cbff045d3c8084990d8feb0', 'user', 980, '8MY8WBX9', NULL, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -1728001 SECOND)),
  (5, 'Pedro Neon', 'pedro@driplab.com', 'scrypt$16384$98965aa7882b2b3fe3c81733c3069ee3$d1d8e8eaa3c3401e6888c8de904d57d33fefe1a3d005915f1c6cd0b399cc6cc1a423ede7f269674309a1a242a9df400b6d0bbc423bd95bde88a4f56cf549e3a3', 'user', 420, 'BD3WAEUH', NULL, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -1728001 SECOND)),
  (6, 'Maya Static', 'maya@driplab.com', 'scrypt$16384$08575e416845c403ea5fd4af11bf9ba6$acfc7ef599b6170017497dce8ba01ef241a0334bfa5c5eabbb82989b3a91c25657180353c962cf024b900627ab41010e768168e3c351ee2e3b99d510c7461638', 'user', 310, 'XTUFYBF5', NULL, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -1728001 SECOND)),
  (7, 'Bruno Ghost', 'bruno@driplab.com', 'scrypt$16384$d76f037d1c38b1c3a1e95a6014487a31$aa2616bed48948c4bf39a5e428e80aa35f134a6404f221ed7fd148ceb2347cd78a50893a1a18a53707969fb2d657803b04250b3bda11dc12b54533128bfe08a9', 'user', 160, 'A8MQVEXJ', NULL, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -1728001 SECOND)),
  (8, 'Sol Pixel', 'sol@driplab.com', 'scrypt$16384$99bffeb43fbc5095890842e0e02e8cad$a82b9fef7e0ba519691e918e0f99466a17dc23fa287bc39151f08c269e9c6f0ee298d4f33c4eb0d9460520dafecf08053580a23f446f1d654d37c0a53a3fe933', 'user', 60, 'SR47KGTL', NULL, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -1728001 SECOND));

-- xp_transactions (7)
INSERT INTO `xp_transactions` (`id`, `user_id`, `amount`, `reason`, `description`, `ref_id`, `created_at`) VALUES
  (1, 2, 240, 'seed', 'XP inicial de demonstração', NULL, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -1728001 SECOND)),
  (2, 3, 1650, 'seed', 'XP inicial de demonstração', NULL, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -1728001 SECOND)),
  (3, 4, 980, 'seed', 'XP inicial de demonstração', NULL, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -1728001 SECOND)),
  (4, 5, 420, 'seed', 'XP inicial de demonstração', NULL, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -1728001 SECOND)),
  (5, 6, 310, 'seed', 'XP inicial de demonstração', NULL, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -1728001 SECOND)),
  (6, 7, 160, 'seed', 'XP inicial de demonstração', NULL, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -1728001 SECOND)),
  (7, 8, 60, 'seed', 'XP inicial de demonstração', NULL, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -1728001 SECOND));

-- user_badges (2)
INSERT INTO `user_badges` (`user_id`, `badge_id`, `awarded_at`) VALUES
  (3, 3, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -72001 SECOND)),
  (4, 6, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -259201 SECOND));

-- user_rewards: (vazio)

-- drops (3)
INSERT INTO `drops` (`id`, `number`, `name`, `tagline`, `description`, `starts_at`, `ends_at`, `min_level`, `early_access_level`, `early_access_hours`, `max_per_user`, `created_at`) VALUES
  (1, 3, 'NEON RAIN', 'Chuva de neon na cidade.', 'Drop anterior, já encerrado.', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -1209601 SECOND), DATE_ADD(UTC_TIMESTAMP(), INTERVAL -604801 SECOND), 1, NULL, 0, 3, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -2592001 SECOND)),
  (2, 4, 'URBAN GLITCH', 'Peças limitadas. Identidade ilimitada.', 'A coleção que mistura erro digital e rua. Quantidade limitada, sem reposição.', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -172801 SECOND), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 5183999 SECOND), 1, NULL, 0, 3, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -2592001 SECOND)),
  (3, 5, 'DIGITAL GHOST', 'Quem vê, vê. Quem perde, perdeu.', 'Próximo drop. Nível 5+ entra 24h antes.', DATE_ADD(UTC_TIMESTAMP(), INTERVAL 5270399 SECOND), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 6047999 SECOND), 1, 5, 24, 2, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -2592001 SECOND));

-- products (19)
INSERT INTO `products` (`id`, `drop_id`, `category_id`, `name`, `subtitle`, `description`, `price`, `stock_initial`, `stock`, `theme`, `badge_text`, `image_url`, `active`, `created_at`, `image_back_url`) VALUES
  (1, 1, 1, 'Rain Hoodie', 'Deep Blue / Sold out', 'Moletom do drop 003.', 329, 15, 0, 'purple', 'RAIN', NULL, 1, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -259201 SECOND), NULL),
  (2, 1, 2, 'Neon Tee', 'Acid / Sold out', 'Camiseta do drop 003.', 179, 20, 0, 'green', 'NEO', NULL, 1, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -259201 SECOND), NULL),
  (3, 2, 1, 'Glitch Hoodie', 'Black / Limited', 'Moletom oversized 100% algodão com estampa glitch em puff.', 349, 12, 12, 'black', 'DRIP', 'img/produtos/moletom2.png', 1, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -259201 SECOND), 'img/produtos/moletom2verso.png'),
  (4, 2, 2, 'Digital Core Tee', 'Acid Orange / Limited', 'Camiseta boxy fit, algodão pesado, estampa frontal.', 189, 10, 10, 'green', 'DL', 'img/produtos/camisa1.png', 1, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -259201 SECOND), 'img/produtos/camisa1verso.png'),
  (5, 2, 2, 'Error Tee', 'Deep Blue / Limited', 'Camiseta com a estampa 404, caimento solto.', 219, 8, 8, 'purple', '404', 'img/produtos/camisa3.png', 1, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -259201 SECOND), 'img/produtos/camisa3verso.png'),
  (6, 2, 4, 'Lab Cap', 'Off White / Limited', 'Boné 6 painéis com bordado frontal.', 129, 7, 7, 'white', 'LAB', 'img/produtos/bone2.png', 1, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -259201 SECOND), 'img/produtos/bone2lado.png'),
  (7, 2, 1, 'Ice Hoodie', 'Off White / Limited', 'Moletom canguru off white com logo bordado e globo na manga.', 339, 10, 10, 'white', 'ICE', 'img/produtos/moletom1.png', 1, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -259201 SECOND), 'img/produtos/moletom1verso.png'),
  (8, 2, 1, 'Cobalt Hoodie', 'Cobalt Blue / Limited', 'Moletom azul cobalto com logo laranja e estampa vertical na manga.', 359, 8, 8, 'purple', 'COBT', 'img/produtos/moletom3.png', 1, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -259201 SECOND), 'img/produtos/moletom3verso.png'),
  (9, 2, 2, 'Bone Tee', 'Off White / Limited', 'Camiseta boxy fit off white, algodão pesado, etiqueta laranja.', 189, 12, 12, 'white', 'BONE', 'img/produtos/camisa2.png', 1, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -259201 SECOND), 'img/produtos/camisa2verso.png'),
  (10, 2, 3, 'Denim Short', 'Blue Denim / Limited', 'Bermuda jeans larga com logo bordado na barra.', 249, 10, 10, 'purple', 'DNM', 'img/produtos/short1.png', 1, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -259201 SECOND), 'img/produtos/short1verso.png'),
  (11, 2, 3, 'Black Cargo Denim', 'Black / Limited', 'Bermuda jeans preta cargo com bolsos laterais.', 269, 8, 8, 'black', 'CRGO', 'img/produtos/short2.png', 1, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -259201 SECOND), 'img/produtos/short2verso.png'),
  (12, 2, 3, 'Utility Cargo Short', 'Black / Limited', 'Bermuda cargo em sarja com cordão e bolsos utilitários.', 259, 9, 9, 'black', 'UTIL', 'img/produtos/short3.png', 1, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -259201 SECOND), 'img/produtos/short3verso.png'),
  (13, 2, 4, 'Night Cap', 'Black / Limited', 'Boné preto com logo bordado em laranja.', 129, 15, 15, 'black', 'NITE', 'img/produtos/bone1.png', 1, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -259201 SECOND), 'img/produtos/bone1lado.png'),
  (14, 2, 4, 'Cobalt Cap', 'Cobalt Blue / Limited', 'Boné azul cobalto com logo bordado em laranja.', 129, 15, 15, 'purple', 'COBT', 'img/produtos/bone3.png', 1, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -259201 SECOND), 'img/produtos/bone3lado.png'),
  (15, 2, 5, 'Drip Bottle', 'Black / Limited', 'Garrafa térmica preta com alça e logo DripLab.', 119, 20, 20, 'black', 'BTL', 'img/produtos/garrafadriplab.png', 1, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -259201 SECOND), NULL),
  (16, 2, 5, 'Drip Tumbler', 'Black / Limited', 'Copo térmico de aço inox com logo DripLab.', 89, 20, 20, 'black', 'CUP', 'img/produtos/copodriplab.png', 1, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -259201 SECOND), NULL),
  (17, 2, 5, 'Drip Pouch', 'Black / Limited', 'Necessaire neoprene com patch DripLab e puxador.', 79, 25, 25, 'black', 'BAG', 'img/produtos/bagdriplab.png', 1, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -259201 SECOND), NULL),
  (18, 3, 1, 'Ghost Hoodie', 'Grey / Limited', 'Moletom refletivo do drop 005.', 389, 20, 20, 'black', 'GST', NULL, 1, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -259201 SECOND), NULL),
  (19, 3, 4, 'Ghost Beanie', 'Black / Limited', 'Gorro com bordado fantasma.', 99, 15, 15, 'white', 'GH', NULL, 1, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -259201 SECOND), NULL);

-- orders: (vazio)

-- order_items: (vazio)

-- polls (1)
INSERT INTO `polls` (`id`, `title`, `description`, `starts_at`, `ends_at`, `min_level`, `created_at`) VALUES
  (1, 'Qual estampa deve vir no Drop 005?', 'Sua escolha define a próxima coleção.', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -86401 SECOND), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 175268 SECOND), 1, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -86401 SECOND));

-- poll_options (3)
INSERT INTO `poll_options` (`id`, `poll_id`, `label`, `description`) VALUES
  (1, 1, 'NEON CHAOS', 'Cores saturadas e caos visual'),
  (2, 1, 'CITY STATIC', 'Ruído de TV e concreto'),
  (3, 1, 'DIGITAL GHOST', 'Silhuetas refletivas');

-- votes (6)
INSERT INTO `votes` (`id`, `poll_id`, `option_id`, `user_id`, `created_at`) VALUES
  (1, 1, 1, 3, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -72001 SECOND)),
  (2, 1, 1, 4, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -72001 SECOND)),
  (3, 1, 1, 5, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -72001 SECOND)),
  (4, 1, 2, 6, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -72001 SECOND)),
  (5, 1, 2, 7, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -72001 SECOND)),
  (6, 1, 3, 8, DATE_ADD(UTC_TIMESTAMP(), INTERVAL -72001 SECOND));

-- comments (4)
INSERT INTO `comments` (`id`, `user_id`, `drop_id`, `body`, `created_at`) VALUES
  (1, 3, 2, 'Esse Glitch Hoodie é outro nível. Garanti o meu!', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -36001 SECOND)),
  (2, 4, 2, 'Quem mais tá de olho no Drop 005?', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -32401 SECOND)),
  (3, 5, 2, 'A Error Tee vai esgotar primeiro, podem anotar.', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -28801 SECOND)),
  (4, 6, 2, 'Votei em CITY STATIC, bora lá.', DATE_ADD(UTC_TIMESTAMP(), INTERVAL -25201 SECOND));

SET FOREIGN_KEY_CHECKS = 1;
