module.exports = function registerBidSocket(io) {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Client joins the room for the auction they're currently viewing
    socket.on('joinAuction', (productId) => {
      socket.join(`product_${productId}`);
    });

    socket.on('leaveAuction', (productId) => {
      socket.leave(`product_${productId}`);
    });

    // Listen to all bids globally for live notifications
    socket.on('listenToAllBids', () => {
      socket.join('all_bids_room');
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
};
