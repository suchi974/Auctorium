const db = require('../config/db');

// POST /api/products  (seller only) - Section 5.1 Create Auction
exports.createProduct = async (req, res) => {
  try {
    const seller_id = req.user.id;
    const {
      name, description, category_id, image_url,
      starting_price, reserve_price, min_increment,
      start_time, end_time
    } = req.body;

    if (!name || !category_id || !starting_price || !start_time || !end_time) {
      return res.status(400).json({ message: 'name, category_id, starting_price, start_time and end_time are required' });
    }
    if (new Date(end_time) <= new Date(start_time)) {
      return res.status(400).json({ message: 'end_time must be after start_time' });
    }
    const parsedIncrement = min_increment == null || min_increment === '' ? 1 : Number(min_increment);
    if (!Number.isFinite(parsedIncrement) || parsedIncrement <= 0) {
      return res.status(400).json({ message: 'Minimum increment must be greater than zero' });
    }

    const initialStatus = new Date(start_time) <= new Date() ? 'active' : 'approved';
    const [result] = await db.query(
      `INSERT INTO products
       (name, description, category_id, seller_id, image_url, starting_price, reserve_price,
        current_price, min_increment, start_time, end_time, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, description || null, category_id, seller_id, image_url || null,
       starting_price, reserve_price || null, starting_price, parsedIncrement,
       start_time, end_time, initialStatus]
    );

    const [createdRows] = await db.query(
      `SELECT p.*, c.name AS category_name, s.name AS seller_name
       FROM products p
       JOIN categories c ON c.category_id = p.category_id
       JOIN sellers s ON s.id = p.seller_id
       WHERE p.id = ?`,
      [result.insertId]
    );
    const product = createdRows[0];
    const io = req.app.get('io');

    // Keep all connected clients in sync. Consumers can refresh only the card
    // affected by this event instead of polling the entire listing.
    if (io) io.emit('auctionCreated', product);

    res.status(201).json({ message: 'Auction created successfully', product_id: result.insertId, product });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error creating product' });
  }
};

// GET /api/products/recent-live - a separate public feed for buyer "Recent alerts".
// New auctions belong in this feed, not in a buyer's personal notifications.
exports.getRecentLiveAuctions = async (req, res) => {
  const requestedLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 20) : 5;
  try {
    const [rows] = await db.query(
      `SELECT p.*, c.name AS category_name, s.name AS seller_name,
              (SELECT COUNT(*) FROM bids b WHERE b.product_id = p.id) AS bid_count
       FROM products p
       JOIN categories c ON c.category_id = p.category_id
       JOIN sellers s ON s.id = p.seller_id
       WHERE p.status = 'active' AND p.start_time <= NOW() AND p.end_time > NOW()
       ORDER BY p.created_at DESC
       LIMIT ?`,
      [limit]
    );
    res.json(rows);
  } catch (err) {
    console.error('getRecentLiveAuctions error:', err);
    res.status(500).json({ message: 'Server error fetching recent live auctions' });
  }
};

// GET /api/products  - Section 11 Search and Filtering
// Query params: category, minPrice, maxPrice, status, seller, search, sortBy
exports.getProducts = async (req, res) => {
  try {
    const { category, minPrice, maxPrice, status, seller, search, sortBy } = req.query;
    let sql = `
      SELECT p.*, c.name AS category_name, s.name AS seller_name,
        (SELECT COUNT(*) FROM bids b WHERE b.product_id = p.id) AS bid_count
      FROM products p
      JOIN categories c ON p.category_id = c.category_id
      JOIN sellers s ON p.seller_id = s.id
      WHERE 1=1`;
    const params = [];

    if (category) { sql += ' AND p.category_id = ?'; params.push(category); }
    if (minPrice) { sql += ' AND p.current_price >= ?'; params.push(minPrice); }
    if (maxPrice) { sql += ' AND p.current_price <= ?'; params.push(maxPrice); }
    if (status) { sql += ' AND p.status = ?'; params.push(status); }
    if (seller) { sql += ' AND s.name LIKE ?'; params.push(`%${seller}%`); }
    if (search) { sql += ' AND (p.name LIKE ? OR p.description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

    let orderSql = ' ORDER BY p.created_at DESC';
    if (sortBy === 'price_asc') {
      orderSql = ' ORDER BY p.current_price ASC';
    } else if (sortBy === 'price_desc') {
      orderSql = ' ORDER BY p.current_price DESC';
    } else if (sortBy === 'ending_soon') {
      orderSql = ' ORDER BY p.end_time ASC';
    }
    sql += orderSql;

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching products' });
  }
};

// GET /api/products/:id
exports.getProductById = async (req, res) => {
  const [rows] = await db.query(
    `SELECT p.*, c.name AS category_name, s.name AS seller_name
     FROM products p
     JOIN categories c ON p.category_id = c.category_id
     JOIN sellers s ON p.seller_id = s.id
     WHERE p.id = ?`,
    [req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ message: 'Product not found' });

  const [bids] = await db.query(
    `SELECT b.bid_id, b.product_id, b.buyer_id, b.b_price, b.b_time, buy.name AS buyer_name FROM bids b
     JOIN buyers buy ON b.buyer_id = buy.id
     WHERE b.product_id = ? ORDER BY b.b_price DESC, b.b_time DESC`,
    [req.params.id]
  );
  // Map bid fields to what the React UI expects
  const mappedBids = bids.map((b) => ({
    id: b.bid_id,
    amount: Number(b.b_price),
    buyer_id: b.buyer_id,
    buyer_name: b.buyer_name,
    created_at: b.b_time,
  }));
  // Also compute highest bidder for UI convenience
  const highest = mappedBids[0] || null;
  const p = rows[0];
  res.json({
    ...p,
    category: p.category_name,       // alias for UI
    bids: mappedBids,
    bid_count: mappedBids.length,
    highest_bidder_id: highest ? highest.buyer_id : null,
    final_price: p.winner_id ? Number(p.current_price) : null,
  });
};

// PATCH /api/products/:id/approve  (admin only) - Section 10
exports.approveProduct = async (req, res) => {
  const { decision } = req.body; // 'approved' | 'rejected'
  if (!['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({ message: "decision must be 'approved' or 'rejected'" });
  }
  await db.query('UPDATE products SET status = ? WHERE id = ?', [decision, req.params.id]);
  res.json({ message: `Product ${decision}` });
};
