-- =====================================================================
-- DripLab — Migration 002: foto do verso do produto
-- products.image_url passa a ser a FRENTE; image_back_url é o VERSO (opcional).
-- Para quem já rodou a 001: basta rodar "npm run db:migrate" (os dados são preservados).
-- =====================================================================
ALTER TABLE products ADD COLUMN image_back_url VARCHAR(255) NULL;