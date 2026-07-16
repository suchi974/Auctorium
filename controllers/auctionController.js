const db = require('../config/db');

// Called periodically by the scheduler in server.js.
// Closes any auction whose end_time has passed and declares the winner.
async function closeExpiredAuctions(io) {
  const [expired] = await db.query(
    `SELECT * FROM products WHERE status = 'active' AND end_time <= NOW()`
  );

  for (const product of expired) {
    const [topBid] = await db.query(
      `SELECT b.*, buy.name AS buyer_name FROM bids b
       JOIN buyers buy ON b.buyer_id = buy.id
       WHERE b.product_id = ? ORDER BY b.b_price DESC, b.b_time ASC LIMIT 1`,
      [product.id]
    );

    if (topBid.length > 0) {
      const winner = topBid[0];
      // Reserve price check: if reserve not met, auction closes with no winner
      const reserveMet = !product.reserve_price || winner.b_price >= product.reserve_price;

      await db.query(
        `UPDATE products SET status = 'closed', winner_id = ? WHERE id = ?`,
        [reserveMet ? winner.buyer_id : null, product.id]
      );

      if (reserveMet) {
        await db.query(
          `INSERT INTO notifications (user_id, user_type, message, type)
           VALUES (?, 'buyer', ?, 'winner')`,
          [winner.buyer_id, `Congratulations! You won the auction for "${product.name}" at ${winner.b_price}`]
        );
      }

      if (io) {
        io.to(`product_${product.id}`).emit('auctionClosed', {
          product_id: product.id,
          winner_id: reserveMet ? winner.buyer_id : null,
          winner_name: reserveMet ? winner.buyer_name : null,
          final_price: winner.b_price,
          reserveMet
        });
      }
    } else {
      // No bids at all
      await db.query(`UPDATE products SET status = 'closed' WHERE id = ?`, [product.id]);
      if (io) io.to(`product_${product.id}`).emit('auctionClosed', { product_id: product.id, winner_id: null });
    }
  }
}

module.exports = { closeExpiredAuctions };
