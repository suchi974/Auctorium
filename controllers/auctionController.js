const db = require('../config/db');
const { _createAndEmit } = require('./bidController');

// UPDATED: closes expired auctions and emits real-time notifications
// to BOTH the winning buyer AND the seller (new behaviour).
async function closeExpiredAuctions(io) {
  const [expired] = await db.query(
    `SELECT p.*, s.name AS seller_name
     FROM products p
     JOIN sellers s ON p.seller_id = s.id
     WHERE p.status = 'active' AND p.end_time <= NOW()`
  );

  for (const product of expired) {
    const [topBid] = await db.query(
      `SELECT b.*, buy.name AS buyer_name
       FROM bids b
       JOIN buyers buy ON b.buyer_id = buy.id
       WHERE b.product_id = ?
       ORDER BY b.b_price DESC, b.b_time ASC
       LIMIT 1`,
      [product.id]
    );

    if (topBid.length > 0) {
      const winner = topBid[0];
      const reserveMet = !product.reserve_price || Number(winner.b_price) >= Number(product.reserve_price);

      await db.query(
        `UPDATE products SET status = 'closed', winner_id = ? WHERE id = ?`,
        [reserveMet ? winner.buyer_id : null, product.id]
      );

      if (reserveMet) {
        // ---- Buyer notification (existing behaviour, kept) ----
        await _createAndEmit(io, {
          user_id: winner.buyer_id,
          user_type: 'buyer',
          type: 'winner',
          title: `You won: ${product.name}`,
          message: `Congratulations! You won this auction at ₹${Number(winner.b_price).toLocaleString('en-IN')}. Complete your payment to claim it.`,
          data: {
            product_id: product.id,
            product_name: product.name,
            product_image: product.image_url,
            amount: Number(winner.b_price),
          },
        });

        // ---- NEW: Seller notification ----
        await _createAndEmit(io, {
          user_id: product.seller_id,
          user_type: 'seller',
          type: 'winner',
          title: `🎉 Your auction has ended.`,
          message:
            `Product: ${product.name}  •  ` +
            `Winner: ${winner.buyer_name}  •  ` +
            `Winning Bid: ₹${Number(winner.b_price).toLocaleString('en-IN')}  •  ` +
            `Status: Auction Completed  •  Payment: Pending`,
          data: {
            product_id: product.id,
            product_name: product.name,
            product_image: product.image_url,
            winner_id: winner.buyer_id,
            winner_name: winner.buyer_name,
            winning_bid: Number(winner.b_price),
            end_time: product.end_time,
            auction_status: 'Completed',
            payment_status: 'Pending',
          },
        });
      } else {
        // Reserve not met — notify seller too (auction ended without a valid winner)
        await _createAndEmit(io, {
          user_id: product.seller_id,
          user_type: 'seller',
          type: 'winner',
          title: `Your auction has ended (reserve not met)`,
          message: `Product: ${product.name}  •  Top Bid: ₹${Number(winner.b_price).toLocaleString('en-IN')}  •  Reserve price was not reached.`,
          data: {
            product_id: product.id,
            product_name: product.name,
            product_image: product.image_url,
            winning_bid: Number(winner.b_price),
            end_time: product.end_time,
            auction_status: 'Completed',
            payment_status: 'N/A',
            reserve_met: false,
          },
        });
      }

      if (io) {
        io.to(`product_${product.id}`).emit('auctionClosed', {
          product_id: product.id,
          winner_id: reserveMet ? winner.buyer_id : null,
          winner_name: reserveMet ? winner.buyer_name : null,
          final_price: winner.b_price,
          reserveMet,
        });
      }
    } else {
      // No bids at all — close and notify seller
      await db.query(`UPDATE products SET status = 'closed' WHERE id = ?`, [product.id]);

      await _createAndEmit(io, {
        user_id: product.seller_id,
        user_type: 'seller',
        type: 'winner',
        title: `Your auction ended with no bids`,
        message: `Product: ${product.name}  •  No bids were placed before the auction closed.`,
        data: {
          product_id: product.id,
          product_name: product.name,
          product_image: product.image_url,
          end_time: product.end_time,
          auction_status: 'Completed',
          payment_status: 'N/A',
          no_bids: true,
        },
      });

      if (io) {
        io.to(`product_${product.id}`).emit('auctionClosed', {
          product_id: product.id,
          winner_id: null,
        });
      }
    }
  }
}

module.exports = { closeExpiredAuctions };
