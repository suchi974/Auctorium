const db = require('../config/db');

async function getOwned(id, sellerId) {
  const [rows] = await db.query('SELECT * FROM products WHERE id = ? AND seller_id = ?', [id, sellerId]);
  return rows[0] || null;
}

exports.list = async (req, res) => {
  const [rows] = await db.query(
    `SELECT p.*, c.name AS category_name, COUNT(b.bid_id) AS bid_count, MAX(b.b_price) AS highest_bid
     FROM products p JOIN categories c ON c.category_id = p.category_id
     LEFT JOIN bids b ON b.product_id = p.id WHERE p.seller_id = ?
     GROUP BY p.id, c.name ORDER BY p.created_at DESC`,
    [req.user.id]
  );
  res.json(rows.map((row) => ({ ...row, bid_count: Number(row.bid_count), highest_bid: row.highest_bid === null ? null : Number(row.highest_bid) })));
};

// Seller Dashboard: bid activity is intentionally separate from personal notifications.
exports.recentAlerts = async (req, res) => {
  const [rows] = await db.query(
    `SELECT id, title, message, type, data, created_at
     FROM notifications
     WHERE user_id = ? AND user_type = 'seller' AND type = 'bid_confirmation'
     ORDER BY created_at DESC
     LIMIT 5`,
    [req.user.id]
  );
  res.json(rows);
};

// PATCH /api/seller/auctions/:id
// All edit constraints live on the server so they also apply to direct API calls.
exports.update = async (req, res) => {
  try {
    const auction = await getOwned(req.params.id, req.user.id);
    if (!auction) return res.status(404).json({ message: 'Auction not found' });

    if (auction.status === 'closed' || new Date(auction.end_time) <= new Date()) {
      return res.status(409).json({ message: 'Completed auctions cannot be edited' });
    }

    const { name, description, category_id, image_url, starting_price, reserve_price, end_time } = req.body;
    const nextName = String(name ?? auction.name).trim();
    const nextDescription = description === undefined ? auction.description : (description == null ? null : String(description).trim());
    const nextCategoryId = Number(category_id ?? auction.category_id);
    const nextStartingPrice = Number(starting_price ?? auction.starting_price);
    const nextReservePrice = reserve_price === undefined ? auction.reserve_price : (reserve_price === '' || reserve_price == null
      ? null
      : Number(reserve_price));

    if (!nextName || nextName.length > 150) {
      return res.status(400).json({ message: 'Product name is required and must be 150 characters or fewer' });
    }
    if (!Number.isInteger(nextCategoryId) || nextCategoryId < 1) {
      return res.status(400).json({ message: 'Please select a valid category' });
    }
    if (!Number.isFinite(nextStartingPrice) || nextStartingPrice <= 0) {
      return res.status(400).json({ message: 'Starting price must be greater than zero' });
    }
    if (nextReservePrice !== null && (!Number.isFinite(nextReservePrice) || nextReservePrice < nextStartingPrice)) {
      return res.status(400).json({ message: 'Reserve price must be at least the starting price' });
    }

    const [categories] = await db.query('SELECT category_id FROM categories WHERE category_id = ?', [nextCategoryId]);
    if (!categories.length) return res.status(400).json({ message: 'Please select a valid category' });

    const [bidRows] = await db.query('SELECT COUNT(*) AS count FROM bids WHERE product_id = ?', [auction.id]);
    const hasBids = Number(bidRows[0].count) > 0;
    if (hasBids && nextStartingPrice !== Number(auction.starting_price)) {
      return res.status(409).json({ message: 'Starting price cannot be changed after bids have been placed' });
    }

    let nextEndTime = auction.end_time;
    if (end_time != null) {
      if (auction.status !== 'active') {
        return res.status(409).json({ message: 'Auction end time can only be changed while the auction is live' });
      }
      nextEndTime = new Date(end_time);
      if (Number.isNaN(nextEndTime.getTime()) || nextEndTime <= new Date()) {
        return res.status(400).json({ message: 'Auction end time must be in the future' });
      }
      if (nextEndTime <= new Date(auction.start_time)) {
        return res.status(400).json({ message: 'End time must be after the auction start time' });
      }
    }

    const nextImageUrl = image_url === undefined ? auction.image_url : (image_url || null);
    await db.query(
      `UPDATE products
       SET name = ?, description = ?, category_id = ?, image_url = ?, starting_price = ?,
           reserve_price = ?, end_time = ?, current_price = CASE WHEN ? = 0 THEN ? ELSE current_price END
       WHERE id = ?`,
      [nextName, nextDescription, nextCategoryId, nextImageUrl, nextStartingPrice,
        nextReservePrice, nextEndTime, hasBids ? 1 : 0, nextStartingPrice, auction.id]
    );
    const [rows] = await db.query(
      `SELECT p.*, c.name AS category_name FROM products p
       JOIN categories c ON c.category_id = p.category_id WHERE p.id = ?`,
      [auction.id]
    );
    const product = rows[0];
    req.app.get('io')?.emit('auctionUpdated', product);
    res.json({ message: 'Auction updated successfully', product });
  } catch (err) {
    console.error('seller auction update error:', err);
    res.status(500).json({ message: 'Unable to update auction' });
  }
};

exports.remove = async (req, res) => {
  const auction = await getOwned(req.params.id, req.user.id);
  if (!auction) return res.status(404).json({ message: 'Auction not found' });
  const [bids] = await db.query('SELECT COUNT(*) AS count FROM bids WHERE product_id = ?', [auction.id]);
  if (Number(bids[0].count)) return res.status(409).json({ message: 'Auctions with bids cannot be deleted; close the auction instead' });
  await db.query('DELETE FROM products WHERE id = ?', [auction.id]);
  req.app.get('io')?.emit('auctionDeleted', { product_id: auction.id });
  res.status(204).end();
};

exports.close = async (req, res) => {
  const auction = await getOwned(req.params.id, req.user.id);
  if (!auction) return res.status(404).json({ message: 'Auction not found' });
  if (auction.status === 'closed') return res.status(409).json({ message: 'Auction is already closed' });
  const [bids] = await db.query('SELECT buyer_id, b_price FROM bids WHERE product_id = ? ORDER BY b_price DESC, b_time ASC LIMIT 1', [auction.id]);
  const top = bids[0];
  const winnerId = top && (!auction.reserve_price || Number(top.b_price) >= Number(auction.reserve_price)) ? top.buyer_id : null;
  await db.query("UPDATE products SET status = 'closed', winner_id = ? WHERE id = ?", [winnerId, auction.id]);
  const event = { product_id: auction.id, winner_id: winnerId, final_price: top ? Number(top.b_price) : null };
  req.app.get('io')?.emit('auctionClosed', event);
  res.json({ ok: true, ...event });
};
