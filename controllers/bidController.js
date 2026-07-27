const db = require('../config/db');

// Small helper used by controllers to persist + push a notification.
// Emits to `user_<role>_<id>` room so the receiver gets it in real-time.
async function createAndEmit(io, { user_id, user_type = 'buyer', type, title, message, data = null, emit = true }) {
  const payload = data ? JSON.stringify(data) : null;
  const [result] = await db.query(
    `INSERT INTO notifications (user_id, user_type, title, message, type, data)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [user_id, user_type, title, message, type, payload]
  );
  const notif = {
    id: result.insertId,
    user_id,
    user_type,
    title,
    message,
    type,
    data: data || null,
    is_read: 0,
    created_at: new Date().toISOString(),
  };
  if (io && emit) io.to(`user_${user_type}_${user_id}`).emit('notification', notif);
  return notif;
}

// POST /api/bids  (buyer)  { product_id, b_price }
// Robust validation with specific, human-readable error messages.
// Success returns { success: true, ... }, failures return 4xx with `{ message }`.
exports.placeBid = async (req, res) => {
  const conn = await db.getConnection();
  try {
    // ---- auth guard ----
    if (!req.user || !req.user.id) {
      conn.release();
      return res.status(401).json({ message: 'Please login to place a bid.' });
    }
    if (req.user.role !== 'buyer') {
      conn.release();
      return res.status(403).json({ message: 'Only buyers can place bids.' });
    }

    const buyer_id = req.user.id;
    const { product_id, b_price } = req.body;
    const io = req.app.get('io');

    if (!product_id || !b_price) {
      conn.release();
      return res.status(400).json({ message: 'product_id and b_price are required' });
    }

    const bidAmt = parseFloat(b_price);
    if (Number.isNaN(bidAmt) || bidAmt <= 0) {
      conn.release();
      return res.status(400).json({ message: 'Please enter a valid bid amount.' });
    }

    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT * FROM products WHERE id = ? FOR UPDATE', [product_id]);
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Auction not found.' });
    }
    const product = rows[0];
    const now = new Date();

    // Auction state checks
    if (product.status === 'closed') {
      await conn.rollback();
      return res.status(400).json({ message: 'Auction has already ended.' });
    }
    if (product.status !== 'active' && product.status !== 'approved') {
      await conn.rollback();
      return res.status(400).json({ message: 'This auction is not open for bidding yet.' });
    }
    if (now < new Date(product.start_time)) {
      await conn.rollback();
      return res.status(400).json({ message: 'This auction has not started yet.' });
    }
    if (now > new Date(product.end_time)) {
      await conn.rollback();
      return res.status(400).json({ message: 'Auction has already ended.' });
    }

    // === Cannot bid on your own auction ===
    // (buyers and sellers are separate tables so this only matches when the same
    //  email/user has both accounts; we still explicitly guard by matching id + role.)
    // Match by email since sellers.id and buyers.id come from different tables.
    const [selfCheck] = await conn.query(
      `SELECT s.id FROM sellers s
       JOIN buyers b ON b.email = s.email
       WHERE b.id = ? AND s.id = ?`,
      [buyer_id, product.seller_id]
    );
    if (selfCheck.length > 0) {
      await conn.rollback();
      return res.status(403).json({ message: 'You cannot bid on your own auction.' });
    }

    // Amount validity
    const minValid = parseFloat(product.current_price) + parseFloat(product.min_increment);
    if (bidAmt < minValid) {
      await conn.rollback();
      return res.status(400).json({
        message: `Bid amount must be higher than the current highest bid. Minimum next bid is ₹${Number(minValid).toLocaleString('en-IN')}.`,
      });
    }

    // Capture previous highest bidder BEFORE we insert (for outbid notification)
    const [prevTop] = await conn.query(
      `SELECT b.buyer_id, b.b_price
       FROM bids b
       WHERE b.product_id = ?
       ORDER BY b.b_price DESC, b.b_time ASC
       LIMIT 1`,
      [product_id]
    );
    const previousLeader = prevTop[0] || null;

    const [ins] = await conn.query(
      'INSERT INTO bids (product_id, buyer_id, b_price) VALUES (?, ?, ?)',
      [product_id, buyer_id, bidAmt]
    );
    await conn.query(
      "UPDATE products SET current_price = ?, status = 'active' WHERE id = ?",
      [bidAmt, product_id]
    );
    await conn.commit();

    // Fetch enriched bid payload
    const [bidInfo] = await db.query(
      `SELECT b.*, p.name AS product_name, p.image_url AS product_image, buy.name AS buyer_name
       FROM bids b
       JOIN products p ON b.product_id = p.id
       JOIN buyers buy ON b.buyer_id = buy.id
       WHERE b.bid_id = ?`,
      [ins.insertId]
    );
    const bidPayload = bidInfo[0];

    // === OUTBID notification to the previously highest bidder ===
    if (previousLeader && previousLeader.buyer_id !== buyer_id) {
      await createAndEmit(io, {
        user_id: previousLeader.buyer_id,
        user_type: 'buyer',
        type: 'outbid',
        title: `You have been outbid on ${product.name}`,
        message: `Your Bid: ₹${Number(previousLeader.b_price).toLocaleString('en-IN')}  •  Current Highest Bid: ₹${Number(bidAmt).toLocaleString('en-IN')}`,
        data: {
          product_id: product.id,
          product_name: product.name,
          product_image: product.image_url,
          previous_bid: Number(previousLeader.b_price),
          current_bid: Number(bidAmt),
          bid_time: bidPayload.b_time,
        },
      });
    }

    // Every accepted bid is a new highest bid. These records feed the seller
    // dashboard's Recent alerts, while the personal notification center hides them.
    await createAndEmit(io, {
      user_id: product.seller_id,
      user_type: 'seller',
      type: 'bid_confirmation',
      title: 'New highest bid',
      message: `${bidPayload.buyer_name} placed a new highest bid of ₹${Number(bidAmt).toLocaleString('en-IN')} on ${product.name}.`,
      data: {
        product_id: product.id,
        product_name: product.name,
        product_image: product.image_url,
        buyer_name: bidPayload.buyer_name,
        bid_amount: Number(bidAmt),
        bid_time: bidPayload.b_time,
      },
      emit: false,
    });

    if (io) {
      io.to(`product_${product_id}`).emit('newBid', bidPayload);
      io.to('all_bids_room').emit('newBid', bidPayload);
      io.emit('auctionUpdated', {
        product_id: product.id,
        current_price: bidAmt,
        status: 'active',
        bid_count_delta: 1,
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Bid Placed Successfully',
      bid: bidPayload,
      current_price: bidAmt,
    });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    console.error('placeBid error:', err);
    return res.status(500).json({ message: 'Server error placing bid. Please try again.' });
  } finally {
    conn.release();
  }
};

exports.getBidsForProduct = async (req, res) => {
  const [rows] = await db.query(
    `SELECT b.*, buy.name AS buyer_name FROM bids b
     JOIN buyers buy ON b.buyer_id = buy.id
     WHERE b.product_id = ? ORDER BY b.b_price DESC, b.b_time DESC`,
    [req.params.productId]
  );
  res.json(rows);
};

// GET /api/bids/my  (buyer)  – all bids by current buyer with enriched product info
exports.myBids = async (req, res) => {
  try {
    const buyer_id = req.user.id;
    const [rows] = await db.query(
      `SELECT b.bid_id, b.product_id, b.buyer_id, b.b_price, b.b_time,
              p.name AS product_name, p.image_url AS product_image, p.status AS product_status,
              p.current_price, p.end_time, p.category_id,
              c.name AS category_name, s.name AS seller_name,
              (SELECT COUNT(*) FROM bids WHERE product_id = p.id) AS bid_count
       FROM bids b
       JOIN products p ON b.product_id = p.id
       JOIN categories c ON p.category_id = c.category_id
       JOIN sellers s ON p.seller_id = s.id
       WHERE b.buyer_id = ?
       ORDER BY b.b_time DESC`,
      [buyer_id]
    );
    const out = rows.map((r) => ({
      bid: { id: r.bid_id, amount: Number(r.b_price), created_at: r.b_time },
      product: {
        id: r.product_id,
        name: r.product_name,
        image_url: r.product_image,
        status: r.product_status,
        current_price: Number(r.current_price),
        end_time: r.end_time,
        category_name: r.category_name,
        seller_name: r.seller_name,
        bid_count: r.bid_count,
      },
    }));
    res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching your bids' });
  }
};

exports._createAndEmit = createAndEmit;
