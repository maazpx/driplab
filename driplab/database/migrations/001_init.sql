--Banco de dados DripLab 
 -- níveis 
CREATE TABLE levels (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  number    INT          NOT NULL,
  name      VARCHAR(60)  NOT NULL,
  min_xp    INT          NOT NULL,
  UNIQUE (number),
  CHECK (min_xp >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

 -- usuarios 
CREATE TABLE users (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(100) NOT NULL,
  email          VARCHAR(160) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  role           VARCHAR(10)  NOT NULL DEFAULT 'user',
  xp             INT          NOT NULL DEFAULT 0,
  referral_code  VARCHAR(12)  NOT NULL,
  referred_by    INT          NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (email),
  UNIQUE (referral_code),
  CHECK (role IN ('user','admin')),
  CHECK (xp >= 0),
  FOREIGN KEY (referred_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

 -- badges 
CREATE TABLE badges (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  code         VARCHAR(40)  NOT NULL,
  name         VARCHAR(80)  NOT NULL,
  description  VARCHAR(255) NOT NULL,
  icon         VARCHAR(10)  NOT NULL DEFAULT '★',
  UNIQUE (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE user_badges (
  user_id     INT      NOT NULL,
  badge_id    INT      NOT NULL,
  awarded_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, badge_id),
  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
  FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

 --histórico de pontos 
CREATE TABLE xp_transactions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT          NOT NULL,
  amount      INT          NOT NULL,
  reason      VARCHAR(40)  NOT NULL,
  description VARCHAR(160) NULL,
  ref_id      INT          NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX idx_xp_user_date ON xp_transactions (user_id, created_at);

 -- recompensas 
CREATE TABLE rewards (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(80)  NOT NULL,
  description  VARCHAR(255) NOT NULL,
  min_level    INT          NOT NULL DEFAULT 1,
  stock        INT          NULL,
  active       TINYINT(1)   NOT NULL DEFAULT 1,
  CHECK (min_level >= 1),
  CHECK (stock IS NULL OR stock >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE user_rewards (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT          NOT NULL,
  reward_id   INT          NOT NULL,
  code        VARCHAR(20)  NOT NULL,
  claimed_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, reward_id),
  UNIQUE (code),
  FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
  FOREIGN KEY (reward_id) REFERENCES rewards(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

 -- categorias, drops e produtos (catalogo)
CREATE TABLE categories (
  id    INT AUTO_INCREMENT PRIMARY KEY,
  slug  VARCHAR(40) NOT NULL,
  name  VARCHAR(60) NOT NULL,
  UNIQUE (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE drops (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  number              INT          NOT NULL,
  name                VARCHAR(80)  NOT NULL,
  tagline             VARCHAR(160) NULL,
  description         TEXT         NULL,
  starts_at           DATETIME     NOT NULL,
  ends_at             DATETIME     NOT NULL,
  min_level           INT          NOT NULL DEFAULT 1,
  early_access_level  INT          NULL,
  early_access_hours  INT          NOT NULL DEFAULT 0,
  max_per_user        INT          NOT NULL DEFAULT 2,
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (number),
  CHECK (ends_at > starts_at),
  CHECK (min_level >= 1),
  CHECK (early_access_hours >= 0),
  CHECK (max_per_user >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE products (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  drop_id        INT            NOT NULL,
  category_id    INT            NOT NULL,
  name           VARCHAR(100)   NOT NULL,
  subtitle       VARCHAR(100)   NULL,
  description    TEXT           NULL,
  price          DECIMAL(10,2)  NOT NULL,
  stock_initial  INT            NOT NULL,
  stock          INT            NOT NULL,
  theme          VARCHAR(20)    NOT NULL DEFAULT 'black',
  badge_text     VARCHAR(10)    NOT NULL DEFAULT 'DL',
  image_url      VARCHAR(255)   NULL,
  active         TINYINT(1)     NOT NULL DEFAULT 1,
  created_at     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (price >= 0),
  CHECK (stock_initial >= 0),
  CHECK (stock >= 0),
  CHECK (theme IN ('black','green','purple','white')),
  FOREIGN KEY (drop_id)     REFERENCES drops(id)      ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX idx_products_drop ON products (drop_id);
CREATE INDEX idx_products_category ON products (category_id);

 -- pedidos 
CREATE TABLE orders (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT            NOT NULL,
  drop_id     INT            NOT NULL,
  status      VARCHAR(15)    NOT NULL DEFAULT 'confirmed',
  total       DECIMAL(10,2)  NOT NULL,
  created_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (status IN ('confirmed','cancelled')),
  CHECK (total >= 0),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (drop_id) REFERENCES drops(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX idx_orders_user ON orders (user_id);

CREATE TABLE order_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  order_id    INT            NOT NULL,
  product_id  INT            NOT NULL,
  quantity    INT            NOT NULL,
  unit_price  DECIMAL(10,2)  NOT NULL,
  CHECK (quantity > 0),
  FOREIGN KEY (order_id)   REFERENCES orders(id)   ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX idx_items_order ON order_items (order_id);

 --votação de coleções
CREATE TABLE polls (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  title        VARCHAR(160) NOT NULL,
  description  VARCHAR(255) NULL,
  starts_at    DATETIME     NOT NULL,
  ends_at      DATETIME     NOT NULL,
  min_level    INT          NOT NULL DEFAULT 1,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (ends_at > starts_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE poll_options (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  poll_id     INT          NOT NULL,
  label       VARCHAR(80)  NOT NULL,
  description VARCHAR(255) NULL,
  UNIQUE (poll_id, id),
  FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- um voto por usuário por votação
CREATE TABLE votes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  poll_id     INT      NOT NULL,
  option_id   INT      NOT NULL,
  user_id     INT      NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (poll_id, user_id),
  FOREIGN KEY (poll_id, option_id) REFERENCES poll_options(poll_id, id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- comentários nos drops 
CREATE TABLE comments (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT           NOT NULL,
  drop_id     INT           NOT NULL,
  body        VARCHAR(500)  NOT NULL,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (drop_id) REFERENCES drops(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX idx_comments_drop ON comments (drop_id, created_at);

--views caso precise
CREATE VIEW v_poll_results AS
SELECT o.poll_id, o.id AS option_id, o.label, o.description,
       COUNT(v.id) AS votes
FROM poll_options o
LEFT JOIN votes v ON v.option_id = o.id
GROUP BY o.poll_id, o.id, o.label, o.description;

CREATE VIEW v_drop_stock AS
SELECT d.id AS drop_id,
       COALESCE(SUM(p.stock_initial), 0) AS stock_initial,
       COALESCE(SUM(p.stock), 0)         AS stock_left
FROM drops d
LEFT JOIN products p ON p.drop_id = d.id AND p.active = 1
GROUP BY d.id;
