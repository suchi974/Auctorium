-- ============================================================
-- Online Auction System - Database Schema
-- Derived from ER diagram: User -isa-> Seller/Buyer, Product,
-- Bids, Offer (bridge), Category
-- ============================================================

CREATE DATABASE IF NOT EXISTS auction_system;
USE auction_system;

-- ---------------------------------------------------------
-- SELLER  (from diagram: Name, Id*, Password, Email, Reg_Date)
-- ---------------------------------------------------------
CREATE TABLE sellers (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    password      VARCHAR(255) NOT NULL,
    phone         VARCHAR(20),
    reg_date      DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_verified   BOOLEAN DEFAULT FALSE,
    is_blocked    BOOLEAN DEFAULT FALSE
);

-- ---------------------------------------------------------
-- BUYER (same attribute set as Seller per diagram)
-- ---------------------------------------------------------
CREATE TABLE buyers (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    password      VARCHAR(255) NOT NULL,
    phone         VARCHAR(20),
    reg_date      DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_verified   BOOLEAN DEFAULT FALSE,
    is_blocked    BOOLEAN DEFAULT FALSE
);

-- ---------------------------------------------------------
-- ADMIN (implied by "Admin manages platform" in stakeholders table)
-- ---------------------------------------------------------
CREATE TABLE admins (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    password      VARCHAR(255) NOT NULL
);

-- ---------------------------------------------------------
-- CATEGORY (Category_Id*, Name)
-- ---------------------------------------------------------
CREATE TABLE categories (
    category_id   INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100) NOT NULL UNIQUE
);

-- ---------------------------------------------------------
-- PRODUCT  (Id*, Name, Description, Category_Id, Seller_Id, Price)
-- extended with auction fields required by section 5 (Create Auction)
-- ---------------------------------------------------------
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
    FOREIGN KEY (category_id) REFERENCES categories(category_id),
    FOREIGN KEY (seller_id)   REFERENCES sellers(id) ON DELETE CASCADE,
    FOREIGN KEY (winner_id)   REFERENCES buyers(id)
);

-- ---------------------------------------------------------
-- BIDS  (Bid_Id*, B_date, B_Price, B_Time, Buyer_Id)
-- The diagram's "Offer" bridge (BidId, ProductId, BuyerId) is folded
-- into this table directly via product_id + buyer_id, which is the
-- standard normalized way to express that N:N relationship.
-- ---------------------------------------------------------
CREATE TABLE bids (
    bid_id      INT AUTO_INCREMENT PRIMARY KEY,
    product_id  INT NOT NULL,
    buyer_id    INT NOT NULL,
    b_price     DECIMAL(12,2) NOT NULL,
    b_date      DATE DEFAULT (CURRENT_DATE),
    b_time      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (buyer_id)   REFERENCES buyers(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------
-- PAYMENTS (section 8)
-- ---------------------------------------------------------
CREATE TABLE payments (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    product_id      INT NOT NULL,
    buyer_id        INT NOT NULL,
    amount          DECIMAL(12,2) NOT NULL,
    method          ENUM('card','upi','netbanking','wallet') NOT NULL,
    status          ENUM('pending','completed','failed','refunded') DEFAULT 'pending',
    transaction_ref VARCHAR(100),
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (buyer_id)   REFERENCES buyers(id)
);

-- ---------------------------------------------------------
-- NOTIFICATIONS (section 9)
-- ---------------------------------------------------------
CREATE TABLE notifications (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    user_type   ENUM('seller','buyer') NOT NULL,
    message     VARCHAR(255) NOT NULL,
    type        ENUM('bid_confirmation','outbid','ending_soon','winner','payment') NOT NULL,
    is_read     BOOLEAN DEFAULT FALSE,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Helpful indexes for real-time bidding lookups
CREATE INDEX idx_bids_product ON bids(product_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_endtime ON products(end_time);
