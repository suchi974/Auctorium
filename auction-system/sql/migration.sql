-- =========================================================================
-- Auctorium — Migration (ADDS ONLY, does not touch existing data)
-- Use this ONLY if you already have an older `auction_system` DB from a
-- previous build and want to add the new columns/indexes.
--
-- For a fresh install, use install.sql instead (drops+recreates everything).
--
-- How to run (recommended):
--   mysql -u root -p auction_system < migration.sql
--
-- This file uses plain ALTER/CREATE statements. Each statement is safe to
-- run ONCE. If you re-run it, MySQL will report "Duplicate column name" /
-- "Duplicate key name" errors — those are harmless; the DB is already
-- migrated. Simply ignore them.
-- =========================================================================

USE auction_system;

-- --- notifications: add title + JSON data ---
ALTER TABLE notifications
  ADD COLUMN title  VARCHAR(255) NULL AFTER user_type,
  ADD COLUMN data   JSON         NULL AFTER type;

-- If the message column is only VARCHAR(255) the new seller message
-- (with product/winner/bid inline) can be long. Widen it.
ALTER TABLE notifications
  MODIFY COLUMN message VARCHAR(1024) NOT NULL;

-- --- indexes ---
CREATE INDEX idx_notif_user_created ON notifications(user_id, user_type, created_at);
CREATE INDEX idx_pay_product_buyer  ON payments(product_id, buyer_id);
CREATE INDEX idx_products_winner    ON products(winner_id, status);

-- Done.
SELECT 'auction_system migration applied' AS status;
