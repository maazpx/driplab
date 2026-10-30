CREATE TABLE IF NOT EXISTS stock_log (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  product_id  INT      NOT NULL,
  old_stock   INT      NOT NULL,
  new_stock   INT      NOT NULL,
  changed_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TRIGGER IF EXISTS trg_products_stock_log;
DELIMITER $$
CREATE TRIGGER trg_products_stock_log
AFTER UPDATE ON products
FOR EACH ROW
BEGIN
  IF NEW.stock <> OLD.stock THEN
    INSERT INTO stock_log (product_id, old_stock, new_stock) VALUES (NEW.id, OLD.stock, NEW.stock);
  END IF;
END$$
DELIMITER ;

-- 2) Procedure: ranking de usuários com o nível calculado (CALL sp_user_ranking(10);)
DROP PROCEDURE IF EXISTS sp_user_ranking;
DELIMITER $$
CREATE PROCEDURE sp_user_ranking(IN p_limit INT)
BEGIN
  SELECT u.id, u.name, u.xp,
         (SELECT MAX(l.number) FROM levels l WHERE l.min_xp <= u.xp) AS level_number
  FROM users u
  WHERE u.role = 'user'
  ORDER BY u.xp DESC, u.id ASC
  LIMIT p_limit;
END$$
DELIMITER ;