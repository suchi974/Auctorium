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

    const [result] = await db.query(
      `INSERT INTO products
       (name, description, category_id, seller_id, image_url, starting_price, reserve_price,
        current_price, min_increment, start_time, end_time, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [name, description || null, category_id, seller_id, image_url || null,
       starting_price, reserve_price || null, starting_price, min_increment || 1.00,
       start_time, end_time]
    );

    res.status(201).json({ message: 'Product submitted for admin approval', product_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error creating product' });
  }
};

// GET /api/products  - Section 11 Search and Filtering
// Query params: category, minPrice, maxPrice, status, seller, search
exports.getProducts = async (req, res) => {
  try {
    const { category, minPrice, maxPrice, status, seller, search } = req.query;
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

    sql += ' ORDER BY p.created_at DESC';

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
    `SELECT b.*, buy.name AS buyer_name FROM bids b
     JOIN buyers buy ON b.buyer_id = buy.id
     WHERE b.product_id = ? ORDER BY b.b_price DESC, b.b_time DESC`,
    [req.params.id]
  );
  res.json({ ...rows[0], bids });
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
