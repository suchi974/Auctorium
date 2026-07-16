const db = require('../config/db');

// POST /api/bids  (buyer only)  { product_id, b_price }
// Implements Section 6: Real-Time Bidding + Automatic Bid Validation
exports.placeBid = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const buyer_id = req.user.id;
    const { product_id, b_price } = req.body;

    if (!product_id || !b_price) {
      return res.status(400).json({ message: 'product_id and b_price are required' });
    }

    await conn.beginTransaction();

    // Lock the product row to avoid race conditions between concurrent bidders
    const [rows] = await conn.query('SELECT * FROM products WHERE id = ? FOR UPDATE', [product_id]);
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Product not found' });
    }
    const product = rows[0];
    const now = new Date();

    // 1. Auction status check
    if (product.status !== 'active' && product.status !== 'approved') {
      await conn.rollback();
      return res.status(400).json({ message: 'This auction is not open for bidding' });
    }
    // 2. Time expiration check
    if (now < new Date(product.start_time)) {
      await conn.rollback();
      return res.status(400).json({ message: 'This auction has not started yet' });
    }
    if (now > new Date(product.end_time)) {
      await conn.rollback();
      return res.status(400).json({ message: 'This auction has already ended' });
    }
    // 3. Bid amount validity (must beat current price + min increment)
    const minValidBid = parseFloat(product.current_price) + parseFloat(product.min_increment);
    if (parseFloat(b_price) < minValidBid) {
      await conn.rollback();
      return res.status(400).json({ message: `Bid must be at least ${minValidBid}` });
    }

    // Insert bid
    const [result] = await conn.query(
      'INSERT INTO bids (product_id, buyer_id, b_price) VALUES (?, ?, ?)',
      [product_id, buyer_id, b_price]
    );

    // Update product's current price + mark active
    await conn.query(
      "UPDATE products SET current_price = ?, status = 'active' WHERE id = ?",
      [b_price, product_id]
    );

    // Notify the previously highest bidder they've been outbid
    const [prevBids] = await conn.query(
      `SELECT DISTINCT buyer_id FROM bids WHERE product_id = ? AND buyer_id != ?`,
      [product_id, buyer_id]
    );
    for (const row of prevBids) {
      await conn.query(
        `INSERT INTO notifications (user_id, user_type, message, type)
         VALUES (?, 'buyer', ?, 'outbid')`,
        [row.buyer_id, `You've been outbid on "${product.name}". New price: ${b_price}`]
      );
    }

    await conn.commit();

    // Fetch complete bid information including product name and buyer name
    const [bidInfo] = await db.query(
      `SELECT b.*, p.name AS product_name, buy.name AS buyer_name 
       FROM bids b
       JOIN products p ON b.product_id = p.id
       JOIN buyers buy ON b.buyer_id = buy.id
       WHERE b.bid_id = ?`,
      [result.insertId]
    );

    const bidPayload = bidInfo.length > 0 ? bidInfo[0] : {
      bid_id: result.insertId,
      product_id,
      buyer_id,
      b_price,
      b_time: new Date(),
      product_name: 'Product',
      buyer_name: 'Anonymous'
    };

    // Broadcast to all clients watching this auction room in real time
    const io = req.app.get('io');
    if (io) {
      io.to(`product_${product_id}`).emit('newBid', bidPayload);
      // Also broadcast to all clients listening for live updates (home page)
      io.to('all_bids_room').emit('newBid', bidPayload);
    }

    res.status(201).json({ message: 'Bid placed successfully', bid: bidPayload });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Server error placing bid' });
  } finally {
    conn.release();
  }
};

// GET /api/bids/product/:productId
exports.getBidsForProduct = async (req, res) => {
  const [rows] = await db.query(
    `SELECT b.*, buy.name AS buyer_name FROM bids b
     JOIN buyers buy ON b.buyer_id = buy.id
     WHERE b.product_id = ? ORDER BY b.b_price DESC, b.b_time DESC`,
    [req.params.productId]
  );
  res.json(rows);
};
