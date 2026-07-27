const db = require('./config/db');

async function insertProducts() {
  try {
    const products = [
      // Art (1)
      { name: 'Abstract Oil Painting', desc: 'Original canvas piece, 24x36in, signed by artist.', cat: 1, seller: 1, start: 150, current: 175, min: 5, days: 1 },
      { name: 'Contemporary Digital Print', desc: 'Limited edition print from emerging artist.', cat: 1, seller: 2, start: 80, current: 80, min: 5, days: 2 },

      // Electronics (2)
      { name: 'Samsung 4K Smart TV 55"', desc: 'Latest model with HDR support, hardly used.', cat: 2, seller: 1, start: 450, current: 520, min: 20, days: 3 },
      { name: 'Sony Wireless Headphones', desc: 'Noise-cancelling, premium sound quality.', cat: 2, seller: 1, start: 250, current: 280, min: 10, days: 2 },

      // Watches (3)
      { name: 'Vintage Leica Camera', desc: 'A rare 1960s Leica in working condition.', cat: 3, seller: 2, start: 200, current: 240, min: 10, days: 2 },
      { name: 'Swiss Luxury Watch', desc: 'Automatic movement, sapphire crystal.', cat: 3, seller: 1, start: 800, current: 850, min: 25, days: 4 },

      // Collectibles (4)
      { name: 'Limited Edition Comic Books', desc: 'Set of 5 rare Marvel comics from 1980s.', cat: 4, seller: 1, start: 300, current: 350, min: 15, days: 3 },
      { name: 'Vintage Baseball Cards', desc: 'Rookie cards from legendary players.', cat: 4, seller: 2, start: 500, current: 550, min: 25, days: 5 },

      // Mobile Phones (5)
      { name: 'iPhone 14 Pro Max', desc: 'Space Black, 256GB, excellent condition.', cat: 5, seller: 1, start: 900, current: 950, min: 25, days: 2 },
      { name: 'Samsung Galaxy S23 Ultra', desc: 'Phantom Black, 512GB with original box.', cat: 5, seller: 1, start: 850, current: 880, min: 20, days: 3 },

      // Laptops (6)
      { name: 'MacBook Pro 16" M2', desc: 'Loaded with 32GB RAM, 1TB SSD.', cat: 6, seller: 2, start: 1200, current: 1300, min: 50, days: 3 },
      { name: 'Dell XPS 15 Gaming', desc: 'RTX 4080, Intel i9, perfect for creators.', cat: 6, seller: 1, start: 1500, current: 1600, min: 50, days: 4 },

      // Fashion (7)
      { name: 'Designer Luxury Handbag', desc: 'Authentic Louis Vuitton, slightly used.', cat: 7, seller: 1, start: 400, current: 450, min: 15, days: 2 },
      { name: 'Premium Leather Jacket', desc: 'Italian leather, vintage biker style.', cat: 7, seller: 2, start: 300, current: 320, min: 10, days: 2 },

      // Jewellery (8)
      { name: 'Diamond Engagement Ring', desc: '1.5 carat solitaire, certified authentic.', cat: 8, seller: 1, start: 3000, current: 3200, min: 100, days: 5 },
      { name: 'Gold Necklace', desc: '24K gold chain with pendant, 18 inches.', cat: 8, seller: 1, start: 500, current: 550, min: 25, days: 3 },

      // Furniture (9)
      { name: 'Mid-Century Modern Sofa', desc: 'Eames-inspired, excellent condition, delivery available.', cat: 9, seller: 2, start: 600, current: 650, min: 25, days: 3 },
      { name: 'Vintage Oak Dining Table', desc: 'Seats 8, hand-carved details.', cat: 9, seller: 1, start: 400, current: 420, min: 15, days: 2 },

      // Home Appliances (10)
      { name: 'Espresso Machine', desc: 'Professional-grade, stainless steel.', cat: 10, seller: 1, start: 350, current: 380, min: 15, days: 2 },
      { name: 'Robot Vacuum Cleaner', desc: 'Smart mapping, self-charging.', cat: 10, seller: 1, start: 250, current: 280, min: 10, days: 2 },

      // Books (11)
      { name: 'Signed First Edition Harry Potter', desc: 'Harry Potter and the Philosophers Stone, 1st edition.', cat: 11, seller: 2, start: 1000, current: 1100, min: 50, days: 4 },
      { name: 'Vintage Classic Literature Collection', desc: 'Set of 12 signed classic novels.', cat: 11, seller: 1, start: 400, current: 450, min: 15, days: 3 },

      // Sports (12)
      { name: 'Vintage Baseball Signed by Legends', desc: 'Signed by multiple Hall of Famers.', cat: 12, seller: 1, start: 2000, current: 2200, min: 100, days: 5 },
      { name: 'Professional Golf Club Set', desc: 'Complete set, brand new condition.', cat: 12, seller: 2, start: 600, current: 650, min: 25, days: 3 },

      // Cameras (13)
      { name: 'Canon EOS R5 Mirrorless', desc: 'Professional camera with RF 24-105 lens.', cat: 13, seller: 1, start: 2500, current: 2700, min: 100, days: 4 },
      { name: 'Vintage Hasselblad', desc: 'Classic photography equipment, fully functional.', cat: 13, seller: 1, start: 800, current: 900, min: 25, days: 3 },

      // Real Estate (14)
      { name: 'Beach Villa Blueprint', desc: 'Architectural plans for luxury beachfront property.', cat: 14, seller: 2, start: 500, current: 550, min: 25, days: 3 },

      // Toys (15)
      { name: 'Vintage Action Figures Collection', desc: 'Rare 1980s collectible toys in original packaging.', cat: 15, seller: 1, start: 350, current: 400, min: 15, days: 2 },
      { name: 'LEGO Star Wars Ultimate Collection', desc: 'Rare retired set from 2005.', cat: 15, seller: 1, start: 450, current: 500, min: 20, days: 2 },

      // Gaming (16)
      { name: 'PlayStation 5 Console', desc: 'Disc edition with extra controllers.', cat: 16, seller: 2, start: 500, current: 550, min: 20, days: 2 },
      { name: 'Vintage Nintendo 64', desc: 'Complete set with original games.', cat: 16, seller: 1, start: 300, current: 350, min: 15, days: 2 },

      // Musical Instruments (17)
      { name: 'Fender Stratocaster Electric Guitar', desc: 'American-made, signature model.', cat: 17, seller: 1, start: 1200, current: 1300, min: 50, days: 3 },
      { name: 'Steinway Grand Piano', desc: 'Classic model, recently refurbished.', cat: 17, seller: 2, start: 5000, current: 5500, min: 200, days: 5 },

      // Antiques (18)
      { name: 'Victorian Pocket Watch', desc: 'Gold-plated, working condition.', cat: 18, seller: 1, start: 400, current: 450, min: 15, days: 2 },
      { name: 'Antique Porcelain Tea Set', desc: 'Delft blue, 18th century, complete set.', cat: 18, seller: 2, start: 600, current: 700, min: 25, days: 3 },

      // Vehicles (19)
      { name: 'Classic Motorcycle Harley-Davidson', desc: 'Original 1970s model, restored.', cat: 19, seller: 1, start: 8000, current: 8500, min: 250, days: 5 },

      // Others (20)
      { name: 'Vintage Typewriter Collection', desc: 'Set of 3 rare mid-century typewriters.', cat: 20, seller: 1, start: 200, current: 250, min: 10, days: 2 }
    ];

    const conn = await db.getConnection();

    for (const p of products) {
      try {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + p.days);

        await conn.query(
          `INSERT IGNORE INTO products (name, description, category_id, seller_id, starting_price, current_price, min_increment, start_time, end_time, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, 'active')`,
          [p.name, p.desc, p.cat, p.seller, p.start, p.current, p.min, endDate]
        );
        console.log(`✓ Inserted: ${p.name}`);
      } catch (err) {
        console.log(`✗ Failed: ${p.name} - ${err.message}`);
      }
    }

    conn.release();
    console.log('\nAll products processed!');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

insertProducts();
