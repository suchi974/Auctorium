USE auction_system;

-- Check if categories table is empty, then insert new ones
DELETE FROM categories WHERE name NOT IN ('Art', 'Electronics', 'Watches', 'Collectibles');

INSERT IGNORE INTO categories (name) VALUES 
('Mobile Phones'),
('Laptops'),
('Fashion'),
('Jewellery'),
('Furniture'),
('Home Appliances'),
('Books'),
('Sports'),
('Cameras'),
('Real Estate'),
('Toys'),
('Gaming'),
('Musical Instruments'),
('Antiques'),
('Vehicles'),
('Others');

-- Insert sample products across various categories (using existing seller IDs 1 and 2)
INSERT INTO products (name, description, category_id, seller_id, starting_price, current_price, min_increment, start_time, end_time, status)
VALUES
-- Art (1)
('Abstract Oil Painting', 'Original canvas piece, 24x36in, signed by artist.', 1, 1, 150.00, 175.00, 5.00, NOW(), DATE_ADD(NOW(), INTERVAL 1 DAY), 'active'),
('Contemporary Digital Print', 'Limited edition print from emerging artist.', 1, 2, 80.00, 80.00, 5.00, NOW(), DATE_ADD(NOW(), INTERVAL 2 DAY), 'active'),

-- Electronics (2)
('Samsung 4K Smart TV 55"', 'Latest model with HDR support, hardly used.', 2, 1, 450.00, 520.00, 20.00, NOW(), DATE_ADD(NOW(), INTERVAL 3 DAY), 'active'),
('Sony Wireless Headphones', 'Noise-cancelling, premium sound quality.', 2, 1, 250.00, 280.00, 10.00, NOW(), DATE_ADD(NOW(), INTERVAL 2 DAY), 'active'),

-- Watches (3)
('Vintage Leica Camera', 'A rare 1960s Leica in working condition.', 3, 2, 200.00, 240.00, 10.00, NOW(), DATE_ADD(NOW(), INTERVAL 2 DAY), 'active'),
('Swiss Luxury Watch', 'Automatic movement, sapphire crystal.', 3, 1, 800.00, 850.00, 25.00, NOW(), DATE_ADD(NOW(), INTERVAL 4 DAY), 'active'),

-- Collectibles (4)
('Limited Edition Comic Books', 'Set of 5 rare Marvel comics from 1980s.', 4, 1, 300.00, 350.00, 15.00, NOW(), DATE_ADD(NOW(), INTERVAL 3 DAY), 'active'),
('Vintage Baseball Cards', 'Rookie cards from legendary players.', 4, 2, 500.00, 550.00, 25.00, NOW(), DATE_ADD(NOW(), INTERVAL 5 DAY), 'active'),

-- Mobile Phones (5)
('iPhone 14 Pro Max', 'Space Black, 256GB, excellent condition.', 5, 1, 900.00, 950.00, 25.00, NOW(), DATE_ADD(NOW(), INTERVAL 2 DAY), 'active'),
('Samsung Galaxy S23 Ultra', 'Phantom Black, 512GB with original box.', 5, 1, 850.00, 880.00, 20.00, NOW(), DATE_ADD(NOW(), INTERVAL 3 DAY), 'active'),

-- Laptops (6)
('MacBook Pro 16" M2', 'Loaded with 32GB RAM, 1TB SSD.', 6, 2, 1200.00, 1300.00, 50.00, NOW(), DATE_ADD(NOW(), INTERVAL 3 DAY), 'active'),
('Dell XPS 15 Gaming', 'RTX 4080, Intel i9, perfect for creators.', 6, 1, 1500.00, 1600.00, 50.00, NOW(), DATE_ADD(NOW(), INTERVAL 4 DAY), 'active'),

-- Fashion (7)
('Designer Luxury Handbag', 'Authentic Louis Vuitton, slightly used.', 7, 1, 400.00, 450.00, 15.00, NOW(), DATE_ADD(NOW(), INTERVAL 2 DAY), 'active'),
('Premium Leather Jacket', 'Italian leather, vintage biker style.', 7, 2, 300.00, 320.00, 10.00, NOW(), DATE_ADD(NOW(), INTERVAL 2 DAY), 'active'),

-- Jewellery (8)
('Diamond Engagement Ring', '1.5 carat solitaire, certified authentic.', 8, 1, 3000.00, 3200.00, 100.00, NOW(), DATE_ADD(NOW(), INTERVAL 5 DAY), 'active'),
('Gold Necklace', '24K gold chain with pendant, 18 inches.', 8, 1, 500.00, 550.00, 25.00, NOW(), DATE_ADD(NOW(), INTERVAL 3 DAY), 'active'),

-- Furniture (9)
('Mid-Century Modern Sofa', 'Eames-inspired, excellent condition, delivery available.', 9, 2, 600.00, 650.00, 25.00, NOW(), DATE_ADD(NOW(), INTERVAL 3 DAY), 'active'),
('Vintage Oak Dining Table', 'Seats 8, hand-carved details.', 9, 1, 400.00, 420.00, 15.00, NOW(), DATE_ADD(NOW(), INTERVAL 2 DAY), 'active'),

-- Home Appliances (10)
('Espresso Machine', 'Professional-grade, stainless steel.', 10, 1, 350.00, 380.00, 15.00, NOW(), DATE_ADD(NOW(), INTERVAL 2 DAY), 'active'),
('Robot Vacuum Cleaner', 'Smart mapping, self-charging.', 10, 1, 250.00, 280.00, 10.00, NOW(), DATE_ADD(NOW(), INTERVAL 2 DAY), 'active'),

-- Books (11)
('Signed First Edition Harry Potter', 'Harry Potter and the Philosophers Stone, 1st edition.', 11, 2, 1000.00, 1100.00, 50.00, NOW(), DATE_ADD(NOW(), INTERVAL 4 DAY), 'active'),
('Vintage Classic Literature Collection', 'Set of 12 signed classic novels.', 11, 1, 400.00, 450.00, 15.00, NOW(), DATE_ADD(NOW(), INTERVAL 3 DAY), 'active'),

-- Sports (12)
('Vintage Baseball Signed by Legends', 'Signed by multiple Hall of Famers.', 12, 1, 2000.00, 2200.00, 100.00, NOW(), DATE_ADD(NOW(), INTERVAL 5 DAY), 'active'),
('Professional Golf Club Set', 'Complete set, brand new condition.', 12, 2, 600.00, 650.00, 25.00, NOW(), DATE_ADD(NOW(), INTERVAL 3 DAY), 'active'),

-- Cameras (13)
('Canon EOS R5 Mirrorless', 'Professional camera with RF 24-105 lens.', 13, 1, 2500.00, 2700.00, 100.00, NOW(), DATE_ADD(NOW(), INTERVAL 4 DAY), 'active'),
('Vintage Hasselblad', 'Classic photography equipment, fully functional.', 13, 1, 800.00, 900.00, 25.00, NOW(), DATE_ADD(NOW(), INTERVAL 3 DAY), 'active'),

-- Real Estate (14)
('Beach Villa Blueprint', 'Architectural plans for luxury beachfront property.', 14, 2, 500.00, 550.00, 25.00, NOW(), DATE_ADD(NOW(), INTERVAL 3 DAY), 'active'),

-- Toys (15)
('Vintage Action Figures Collection', 'Rare 1980s collectible toys in original packaging.', 15, 1, 350.00, 400.00, 15.00, NOW(), DATE_ADD(NOW(), INTERVAL 2 DAY), 'active'),
('LEGO Star Wars Ultimate Collection', 'Rare retired set from 2005.', 15, 1, 450.00, 500.00, 20.00, NOW(), DATE_ADD(NOW(), INTERVAL 2 DAY), 'active'),

-- Gaming (16)
('PlayStation 5 Console', 'Disc edition with extra controllers.', 16, 2, 500.00, 550.00, 20.00, NOW(), DATE_ADD(NOW(), INTERVAL 2 DAY), 'active'),
('Vintage Nintendo 64', 'Complete set with original games.', 16, 1, 300.00, 350.00, 15.00, NOW(), DATE_ADD(NOW(), INTERVAL 2 DAY), 'active'),

-- Musical Instruments (17)
('Fender Stratocaster Electric Guitar', 'American-made, signature model.', 17, 1, 1200.00, 1300.00, 50.00, NOW(), DATE_ADD(NOW(), INTERVAL 3 DAY), 'active'),
('Steinway Grand Piano', 'Classic model, recently refurbished.', 17, 2, 5000.00, 5500.00, 200.00, NOW(), DATE_ADD(NOW(), INTERVAL 5 DAY), 'active'),

-- Antiques (18)
('Victorian Pocket Watch', 'Gold-plated, working condition.', 18, 1, 400.00, 450.00, 15.00, NOW(), DATE_ADD(NOW(), INTERVAL 2 DAY), 'active'),
('Antique Porcelain Tea Set', 'Delft blue, 18th century, complete set.', 18, 2, 600.00, 700.00, 25.00, NOW(), DATE_ADD(NOW(), INTERVAL 3 DAY), 'active'),

-- Vehicles (19)
('Classic Motorcycle Harley-Davidson', 'Original 1970s model, restored.', 19, 1, 8000.00, 8500.00, 250.00, NOW(), DATE_ADD(NOW(), INTERVAL 5 DAY), 'active'),

-- Others (20)
('Vintage Typewriter Collection', 'Set of 3 rare mid-century typewriters.', 20, 1, 200.00, 250.00, 10.00, NOW(), DATE_ADD(NOW(), INTERVAL 2 DAY), 'active');

