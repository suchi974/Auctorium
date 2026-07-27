const db = require('../config/db');

// GET /api/my-products     (buyer only)
// Returns every auction won by the current buyer, joined with payment status.
exports.list = async (req, res) => {
  const buyer_id = req.user.id;
  const [rows] = await db.query(
    `SELECT p.*, c.name AS category_name, s.name AS seller_name,
            pay.id AS payment_id, pay.status AS payment_status,
            pay.transaction_ref, pay.amount AS paid_amount, pay.method AS payment_method,
            pay.created_at AS paid_at
     FROM products p
     JOIN categories c ON p.category_id = c.category_id
     JOIN sellers s ON p.seller_id = s.id
     LEFT JOIN payments pay ON pay.product_id = p.id AND pay.buyer_id = ? AND pay.status = 'completed'
     WHERE p.winner_id = ? AND p.status = 'closed'
     ORDER BY p.end_time DESC`,
    [buyer_id, buyer_id]
  );

  const items = rows.map((r) => ({
    product: {
      id: r.id,
      name: r.name,
      description: r.description,
      image_url: r.image_url,
      category_name: r.category_name,
      seller_name: r.seller_name,
      current_price: Number(r.current_price),
      start_time: r.start_time,
      end_time: r.end_time,
      status: r.status,
    },
    payment: r.payment_id
      ? {
          id: r.payment_id,
          status: r.payment_status,
          transaction_ref: r.transaction_ref,
          amount: Number(r.paid_amount),
          method: r.payment_method,
          created_at: r.paid_at,
        }
      : null,
    delivery_status:
      r.payment_id ? 'Preparing shipment' : 'Awaiting payment',
  }));

  res.json(items);
};

// GET /api/my-products/:id — detailed view of a single won product
exports.detail = async (req, res) => {
  const buyer_id = req.user.id;
  const [rows] = await db.query(
    `SELECT p.*, c.name AS category_name, s.name AS seller_name, s.email AS seller_email,
            pay.id AS payment_id, pay.status AS payment_status,
            pay.transaction_ref, pay.amount AS paid_amount, pay.method AS payment_method,
            pay.created_at AS paid_at
     FROM products p
     JOIN categories c ON p.category_id = c.category_id
     JOIN sellers s ON p.seller_id = s.id
     LEFT JOIN payments pay ON pay.product_id = p.id AND pay.buyer_id = ? AND pay.status = 'completed'
     WHERE p.id = ? AND p.winner_id = ?`,
    [buyer_id, req.params.id, buyer_id]
  );
  if (rows.length === 0) return res.status(404).json({ message: 'Not found or not won by you' });
  const r = rows[0];
  res.json({
    product: {
      id: r.id,
      name: r.name,
      description: r.description,
      image_url: r.image_url,
      category_name: r.category_name,
      seller_name: r.seller_name,
      seller_email: r.seller_email,
      current_price: Number(r.current_price),
      start_time: r.start_time,
      end_time: r.end_time,
      status: r.status,
    },
    payment: r.payment_id
      ? {
          id: r.payment_id,
          status: r.payment_status,
          transaction_ref: r.transaction_ref,
          amount: Number(r.paid_amount),
          method: r.payment_method,
          created_at: r.paid_at,
        }
      : null,
    delivery_status: r.payment_id ? 'Preparing shipment' : 'Awaiting payment',
  });
};
