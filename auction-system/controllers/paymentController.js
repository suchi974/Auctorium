const db = require('../config/db');
const { _createAndEmit } = require('./bidController');

const PLATFORM_FEE_RATE = 0.02;         // 2% mock platform fee
const PROCESSING_DELAY_MS = 2000;       // 2s loader on the mock gateway

function randomTxnRef() {
  const rand = Math.random().toString(36).slice(2, 12).toUpperCase();
  const ts = Date.now().toString(36).toUpperCase();
  return `TXN-${ts}-${rand}`;
}

// GET /api/payments/product/:productId
// Returns the payment row (if any) for the current buyer + a product summary.
exports.getForProduct = async (req, res) => {
  const buyer_id = req.user.id;
  const { productId } = req.params;

  const [products] = await db.query(
    `SELECT p.*, c.name AS category_name, s.name AS seller_name
     FROM products p
     JOIN categories c ON p.category_id = c.category_id
     JOIN sellers s ON p.seller_id = s.id
     WHERE p.id = ?`,
    [productId]
  );
  if (products.length === 0) return res.status(404).json({ message: 'Product not found' });
  const product = products[0];

  if (product.winner_id !== buyer_id) {
    return res.status(403).json({ message: 'You did not win this auction' });
  }

  const [pays] = await db.query(
    `SELECT * FROM payments WHERE product_id = ? AND buyer_id = ? ORDER BY created_at DESC LIMIT 1`,
    [productId, buyer_id]
  );

  const winning = Number(product.current_price);
  const fee = Math.round(winning * PLATFORM_FEE_RATE);
  res.json({
    product: {
      id: product.id,
      name: product.name,
      description: product.description,
      image_url: product.image_url,
      category_name: product.category_name,
      seller_name: product.seller_name,
      start_time: product.start_time,
      end_time: product.end_time,
      winning_bid: winning,
      platform_fee: fee,
      total: winning + fee,
    },
    payment: pays[0] || null,
  });
};

// POST /api/payments  { product_id, method }
// Mock gateway: 2s delay, always succeeds, generates txn ref.
exports.pay = async (req, res) => {
  const buyer_id = req.user.id;
  const { product_id, method } = req.body;
  const io = req.app.get('io');

  const allowedMethods = ['card', 'debit', 'upi', 'netbanking', 'wallet'];
  const dbMethodMap = { card: 'card', debit: 'card', upi: 'upi', netbanking: 'netbanking', wallet: 'wallet' };
  if (!product_id || !method || !allowedMethods.includes(method)) {
    return res.status(400).json({ message: 'product_id and a valid method are required' });
  }

  const [products] = await db.query('SELECT * FROM products WHERE id = ?', [product_id]);
  if (products.length === 0) return res.status(404).json({ message: 'Product not found' });
  const product = products[0];

  if (product.winner_id !== buyer_id) {
    return res.status(403).json({ message: 'You did not win this auction' });
  }

  // Prevent double payment
  const [existing] = await db.query(
    `SELECT * FROM payments WHERE product_id = ? AND buyer_id = ? AND status = 'completed'`,
    [product_id, buyer_id]
  );
  if (existing.length > 0) {
    return res.status(400).json({ message: 'Payment already completed for this auction' });
  }

  // Mock processing latency
  await new Promise((r) => setTimeout(r, PROCESSING_DELAY_MS));

  const winning = Number(product.current_price);
  const fee = Math.round(winning * PLATFORM_FEE_RATE);
  const total = winning + fee;
  const txn = randomTxnRef();

  const [ins] = await db.query(
    `INSERT INTO payments (product_id, buyer_id, amount, method, status, transaction_ref)
     VALUES (?, ?, ?, ?, 'completed', ?)`,
    [product_id, buyer_id, total, dbMethodMap[method], txn]
  );

  await _createAndEmit(io, {
    user_id: buyer_id,
    user_type: 'buyer',
    type: 'payment',
    title: 'Payment successful',
    message: `Payment of ₹${Number(total).toLocaleString('en-IN')} completed for "${product.name}".`,
    data: {
      product_id: product.id,
      product_name: product.name,
      product_image: product.image_url,
      amount: total,
      transaction_ref: txn,
    },
  });

  const [buyers] = await db.query('SELECT name FROM buyers WHERE id = ?', [buyer_id]);
  await _createAndEmit(io, {
    user_id: product.seller_id,
    user_type: 'seller',
    type: 'payment',
    title: 'Buyer completed payment',
    message: `${buyers[0]?.name || 'The buyer'} completed payment for ${product.name}.`,
    data: {
      product_id: product.id,
      product_name: product.name,
      product_image: product.image_url,
      buyer_name: buyers[0]?.name || null,
      amount: total,
      transaction_ref: txn,
    },
  });

  res.status(201).json({
    payment: {
      id: ins.insertId,
      product_id: Number(product_id),
      buyer_id,
      amount: total,
      winning_bid: winning,
      platform_fee: fee,
      method: dbMethodMap[method],
      status: 'completed',
      transaction_ref: txn,
      created_at: new Date().toISOString(),
    },
    product: {
      id: product.id,
      name: product.name,
      image_url: product.image_url,
    },
  });
};

// GET /api/payments/:id/receipt  – returns receipt data (client renders / prints)
exports.receipt = async (req, res) => {
  const [rows] = await db.query(
    `SELECT pay.*, p.name AS product_name, p.image_url AS product_image,
            p.description AS product_description, s.name AS seller_name,
            b.name AS buyer_name, b.email AS buyer_email
     FROM payments pay
     JOIN products p ON pay.product_id = p.id
     JOIN sellers s ON p.seller_id = s.id
     JOIN buyers b ON pay.buyer_id = b.id
     WHERE pay.id = ? AND pay.buyer_id = ?`,
    [req.params.id, req.user.id]
  );
  if (rows.length === 0) return res.status(404).json({ message: 'Receipt not found' });
  res.json(rows[0]);
};
