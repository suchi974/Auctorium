// UPDATED: adds a personal "user_<id>" room so notifications can be pushed
// to a specific buyer regardless of which page they are on.
module.exports = function registerBidSocket(io) {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Auction-scoped room (existing behaviour)
    socket.on('joinAuction', (productId) => {
      socket.join(`product_${productId}`);
    });
    socket.on('leaveAuction', (productId) => {
      socket.leave(`product_${productId}`);
    });

    // Global live-bid ticker (existing behaviour)
    socket.on('listenToAllBids', () => {
      socket.join('all_bids_room');
    });

    // NEW: personal room for outbid / winner / payment notifications.
    // The client should emit this on connect once it knows the userId.
    socket.on('joinUser', ({ userId, role }) => {
      if (!userId) return;
      socket.join(`user_${role || 'buyer'}_${userId}`);
      if (role === 'buyer') socket.join('buyers');
      if (role === 'seller') socket.join('sellers');
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
};
