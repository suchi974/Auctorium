-- =========================================================================
-- Auctorium — ONE-SHOT install script
-- =========================================================================
-- What this does:
--   1. Creates the `auction_system` database (drops+recreates if it exists)
--   2. Creates ALL tables in the correct order
--   3. Seeds: 2 sellers, 2 buyers, 1 admin, 20 categories, 30 sample products
--   4. Creates all indexes
--
-- How to run (recommended - from a normal shell, NOT from inside mysql>):
--   mysql -u root -p < install.sql
--
-- Or from inside the mysql> prompt:
--   source /full/path/to/install.sql;
--
-- IMPORTANT: pasting this file line-by-line into MySQL Workbench or
-- phpMyAdmin can silently drop statements. Prefer piping / SOURCE.
-- =========================================================================

DROP DATABASE IF EXISTS auction_system;
CREATE DATABASE auction_system
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_unicode_ci;
USE auction_system;

-- -------------------------------------------------------------------------
-- Users (sellers, buyers, admins)
-- -------------------------------------------------------------------------
CREATE TABLE sellers (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    email        VARCHAR(150) NOT NULL UNIQUE,
    password     VARCHAR(255) NOT NULL,
    phone        VARCHAR(20),
    reg_date     DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_verified  BOOLEAN  DEFAULT FALSE,
    is_blocked   BOOLEAN  DEFAULT FALSE
) ENGINE=InnoDB;

CREATE TABLE buyers (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    email        VARCHAR(150) NOT NULL UNIQUE,
    password     VARCHAR(255) NOT NULL,
    phone        VARCHAR(20),
    reg_date     DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_verified  BOOLEAN  DEFAULT FALSE,
    is_blocked   BOOLEAN  DEFAULT FALSE
) ENGINE=InnoDB;

CREATE TABLE admins (
    id        INT AUTO_INCREMENT PRIMARY KEY,
    name      VARCHAR(100) NOT NULL,
    email     VARCHAR(150) NOT NULL UNIQUE,
    password  VARCHAR(255) NOT NULL
) ENGINE=InnoDB;

-- -------------------------------------------------------------------------
-- Categories
-- -------------------------------------------------------------------------
CREATE TABLE categories (
    category_id  INT AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;

-- -------------------------------------------------------------------------
-- Products
-- -------------------------------------------------------------------------
CREATE TABLE products (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(150) NOT NULL,
    description     TEXT,
    category_id     INT NOT NULL,
    seller_id       INT NOT NULL,
    image_url       VARCHAR(255),
    starting_price  DECIMAL(12,2) NOT NULL,
    reserve_price   DECIMAL(12,2) DEFAULT NULL,
    current_price   DECIMAL(12,2) NOT NULL,
    min_increment   DECIMAL(12,2) NOT NULL DEFAULT 1.00,
    start_time      DATETIME NOT NULL,
    end_time        DATETIME NOT NULL,
    status          ENUM('pending','approved','rejected','active','closed') DEFAULT 'pending',
    winner_id       INT DEFAULT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(category_id),
    CONSTRAINT fk_products_seller   FOREIGN KEY (seller_id)   REFERENCES sellers(id) ON DELETE CASCADE,
    CONSTRAINT fk_products_winner   FOREIGN KEY (winner_id)   REFERENCES buyers(id)
) ENGINE=InnoDB;

-- -------------------------------------------------------------------------
-- Bids
-- -------------------------------------------------------------------------
CREATE TABLE bids (
    bid_id      INT AUTO_INCREMENT PRIMARY KEY,
    product_id  INT NOT NULL,
    buyer_id    INT NOT NULL,
    b_price     DECIMAL(12,2) NOT NULL,
    b_date      DATE     DEFAULT (CURRENT_DATE),
    b_time      DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_bids_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT fk_bids_buyer   FOREIGN KEY (buyer_id)   REFERENCES buyers(id)   ON DELETE CASCADE
) ENGINE=InnoDB;

-- -------------------------------------------------------------------------
-- Payments (mock)
-- -------------------------------------------------------------------------
CREATE TABLE payments (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    product_id      INT NOT NULL,
    buyer_id        INT NOT NULL,
    amount          DECIMAL(12,2) NOT NULL,
    method          ENUM('card','upi','netbanking','wallet') NOT NULL,
    status          ENUM('pending','completed','failed','refunded') DEFAULT 'pending',
    transaction_ref VARCHAR(100),
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payments_product FOREIGN KEY (product_id) REFERENCES products(id),
    CONSTRAINT fk_payments_buyer   FOREIGN KEY (buyer_id)   REFERENCES buyers(id)
) ENGINE=InnoDB;

-- -------------------------------------------------------------------------
-- Notifications  (with title + JSON data — previously in migration.sql)
-- -------------------------------------------------------------------------
CREATE TABLE notifications (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    user_type   ENUM('seller','buyer') NOT NULL,
    title       VARCHAR(255) NULL,
    message     VARCHAR(1024) NOT NULL,
    type        ENUM('bid_confirmation','outbid','ending_soon','winner','payment') NOT NULL,
    data        JSON NULL,
    is_read     BOOLEAN  DEFAULT FALSE,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -------------------------------------------------------------------------
-- Indexes
-- -------------------------------------------------------------------------
CREATE INDEX idx_bids_product          ON bids(product_id);
CREATE INDEX idx_products_status       ON products(status);
CREATE INDEX idx_products_endtime      ON products(end_time);
CREATE INDEX idx_products_winner       ON products(winner_id, status);
CREATE INDEX idx_pay_product_buyer     ON payments(product_id, buyer_id);
CREATE INDEX idx_notif_user_created    ON notifications(user_id, user_type, created_at);

-- =========================================================================
--   SEED DATA
-- =========================================================================
-- Password below is a bcrypt hash for the string "Password@123"
-- (generated with bcrypt cost 10). Change it if you like.
-- Same hash reused for demo users only.
-- =========================================================================
SET @pw := '$2a$10$Duq6b0bXpM01mfLB/Pt6oOHyIL8h4H0CyU.EbVW.mYw86HKvT5TG.';

INSERT INTO sellers (name, email, password, is_verified) VALUES
  ('Nova Studios',    'seller@auction.com',  @pw, TRUE),
  ('Heritage Traders','seller2@auction.com', @pw, TRUE);

INSERT INTO buyers (name, email, password, is_verified) VALUES
  ('Aria Sharma',     'buyer@auction.com',   @pw, TRUE),
  ('Rohan Malhotra',  'buyer2@auction.com',  @pw, TRUE);

INSERT INTO admins (name, email, password) VALUES
  ('Site Admin', 'admin@auction.com', @pw);

-- Categories (id 1..20)
INSERT INTO categories (name) VALUES
  ('Art'),               -- 1
  ('Electronics'),       -- 2
  ('Watches'),           -- 3
  ('Collectibles'),      -- 4
  ('Mobile Phones'),     -- 5
  ('Laptops'),           -- 6
  ('Fashion'),           -- 7
  ('Jewellery'),         -- 8
  ('Furniture'),         -- 9
  ('Home Appliances'),   -- 10
  ('Books'),             -- 11
  ('Sports'),            -- 12
  ('Cameras'),           -- 13
  ('Real Estate'),       -- 14
  ('Toys'),              -- 15
  ('Gaming'),            -- 16
  ('Musical Instruments'),-- 17
  ('Antiques'),          -- 18
  ('Vehicles'),          -- 19
  ('Others');            -- 20

-- Products
INSERT INTO products (name, description, category_id, seller_id, starting_price, current_price, min_increment, start_time, end_time, status) VALUES
  ('Abstract Oil Painting',             'Original canvas piece, 24x36in, signed by artist.',            1,  1,   150.00,   175.00,   5.00, NOW(), DATE_ADD(NOW(), INTERVAL 1 DAY), 'active'),
  ('Contemporary Digital Print',        'Limited edition print from emerging artist.',                   1,  2,    80.00,    80.00,   5.00, NOW(), DATE_ADD(NOW(), INTERVAL 2 DAY), 'active'),
  ('Samsung 4K Smart TV 55"',           'Latest model with HDR support, hardly used.',                   2,  1,   450.00,   520.00,  20.00, NOW(), DATE_ADD(NOW(), INTERVAL 3 DAY), 'active'),
  ('Sony Wireless Headphones',          'Noise-cancelling, premium sound quality.',                      2,  1,   250.00,   280.00,  10.00, NOW(), DATE_ADD(NOW(), INTERVAL 2 DAY), 'active'),
  ('Vintage Leica Camera',              'A rare 1960s Leica in working condition.',                      3,  2,   200.00,   240.00,  10.00, NOW(), DATE_ADD(NOW(), INTERVAL 2 DAY), 'active'),
  ('Swiss Luxury Watch',                'Automatic movement, sapphire crystal.',                         3,  1,   800.00,   850.00,  25.00, NOW(), DATE_ADD(NOW(), INTERVAL 4 DAY), 'active'),
  ('Limited Edition Comic Books',       'Set of 5 rare Marvel comics from 1980s.',                       4,  1,   300.00,   350.00,  15.00, NOW(), DATE_ADD(NOW(), INTERVAL 3 DAY), 'active'),
  ('Vintage Baseball Cards',            'Rookie cards from legendary players.',                          4,  2,   500.00,   550.00,  25.00, NOW(), DATE_ADD(NOW(), INTERVAL 5 DAY), 'active'),
  ('iPhone 14 Pro Max',                 'Space Black, 256GB, excellent condition.',                      5,  1,   900.00,   950.00,  25.00, NOW(), DATE_ADD(NOW(), INTERVAL 2 DAY), 'active'),
  ('Samsung Galaxy S23 Ultra',          'Phantom Black, 512GB with original box.',                       5,  1,   850.00,   880.00,  20.00, NOW(), DATE_ADD(NOW(), INTERVAL 3 DAY), 'active'),
  ('MacBook Pro 16" M2',                'Loaded with 32GB RAM, 1TB SSD.',                                6,  2,  1200.00,  1300.00,  50.00, NOW(), DATE_ADD(NOW(), INTERVAL 3 DAY), 'active'),
  ('Dell XPS 15 Gaming',                'RTX 4080, Intel i9, perfect for creators.',                     6,  1,  1500.00,  1600.00,  50.00, NOW(), DATE_ADD(NOW(), INTERVAL 4 DAY), 'active'),
  ('Designer Luxury Handbag',           'Authentic Louis Vuitton, slightly used.',                       7,  1,   400.00,   450.00,  15.00, NOW(), DATE_ADD(NOW(), INTERVAL 2 DAY), 'active'),
  ('Premium Leather Jacket',            'Italian leather, vintage biker style.',                         7,  2,   300.00,   320.00,  10.00, NOW(), DATE_ADD(NOW(), INTERVAL 2 DAY), 'active'),
  ('Diamond Engagement Ring',           '1.5 carat solitaire, certified authentic.',                     8,  1,  3000.00,  3200.00, 100.00, NOW(), DATE_ADD(NOW(), INTERVAL 5 DAY), 'active'),
  ('Gold Necklace',                     '24K gold chain with pendant, 18 inches.',                       8,  1,   500.00,   550.00,  25.00, NOW(), DATE_ADD(NOW(), INTERVAL 3 DAY), 'active'),
  ('Mid-Century Modern Sofa',           'Eames-inspired, excellent condition.',                          9,  2,   600.00,   650.00,  25.00, NOW(), DATE_ADD(NOW(), INTERVAL 3 DAY), 'active'),
  ('Vintage Oak Dining Table',          'Seats 8, hand-carved details.',                                 9,  1,   400.00,   420.00,  15.00, NOW(), DATE_ADD(NOW(), INTERVAL 2 DAY), 'active'),
  ('Espresso Machine',                  'Professional-grade, stainless steel.',                         10,  1,   350.00,   380.00,  15.00, NOW(), DATE_ADD(NOW(), INTERVAL 2 DAY), 'active'),
  ('Robot Vacuum Cleaner',              'Smart mapping, self-charging.',                                10,  1,   250.00,   280.00,  10.00, NOW(), DATE_ADD(NOW(), INTERVAL 2 DAY), 'active'),
  ('Signed First Edition Harry Potter', 'Harry Potter and the Philosophers Stone, 1st edition.',        11,  2,  1000.00,  1100.00,  50.00, NOW(), DATE_ADD(NOW(), INTERVAL 4 DAY), 'active'),
  ('Canon EOS R5 Mirrorless',           'Professional camera with RF 24-105 lens.',                     13,  1,  2500.00,  2700.00, 100.00, NOW(), DATE_ADD(NOW(), INTERVAL 4 DAY), 'active'),
  ('LEGO Star Wars Ultimate Collection','Rare retired set from 2005.',                                  15,  1,   450.00,   500.00,  20.00, NOW(), DATE_ADD(NOW(), INTERVAL 2 DAY), 'active'),
  ('PlayStation 5 Console',             'Disc edition with extra controllers.',                         16,  2,   500.00,   550.00,  20.00, NOW(), DATE_ADD(NOW(), INTERVAL 2 DAY), 'active'),
  ('Fender Stratocaster',               'American-made, signature model.',                              17,  1,  1200.00,  1300.00,  50.00, NOW(), DATE_ADD(NOW(), INTERVAL 3 DAY), 'active'),
  ('Antique Porcelain Tea Set',         'Delft blue, 18th century, complete set.',                      18,  2,   600.00,   700.00,  25.00, NOW(), DATE_ADD(NOW(), INTERVAL 3 DAY), 'active'),
  ('Classic Motorcycle Harley-Davidson','Original 1970s model, restored.',                              19,  1,  8000.00,  8500.00, 250.00, NOW(), DATE_ADD(NOW(), INTERVAL 5 DAY), 'active');

-- Done.
SELECT 'auction_system database installed successfully' AS status,
       (SELECT COUNT(*) FROM products) AS products,
       (SELECT COUNT(*) FROM categories) AS categories,
       (SELECT COUNT(*) FROM sellers) AS sellers,
       (SELECT COUNT(*) FROM buyers) AS buyers;
