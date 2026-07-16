USE auction_system;

INSERT INTO categories (name) VALUES ('Art'), ('Electronics'), ('Watches'), ('Collectibles');

-- password for both demo accounts is: Password123
-- (hash generated with bcrypt, 10 rounds)
INSERT INTO sellers (name, email, password, is_verified) VALUES
('Ava Studio', 'seller@example.com', '$2a$10$CwTycUXWue0Thq9StjUM0uJ8Q1o9d6mF9x5ff/O6X6uH6WlbcxbSK', TRUE);

INSERT INTO buyers (name, email, password, is_verified) VALUES
('Sam Buyer', 'buyer@example.com', '$2a$10$CwTycUXWue0Thq9StjUM0uJ8Q1o9d6mF9x5ff/O6X6uH6WlbcxbSK', TRUE);

INSERT INTO admins (name, email, password) VALUES
('Root Admin', 'admin@example.com', '$2a$10$CwTycUXWue0Thq9StjUM0uJ8Q1o9d6mF9x5ff/O6X6uH6WlbcxbSK');

INSERT INTO products (name, description, category_id, seller_id, starting_price, current_price, min_increment, start_time, end_time, status)
VALUES
('Vintage Leica Camera', 'A rare 1960s Leica in working condition.', 3, 1, 200.00, 200.00, 10.00, NOW(), DATE_ADD(NOW(), INTERVAL 2 DAY), 'active'),
('Abstract Oil Painting', 'Original canvas piece, 24x36in.', 1, 1, 150.00, 150.00, 5.00, NOW(), DATE_ADD(NOW(), INTERVAL 1 DAY), 'active');
