// server.js — Express + Socket.IO + MySQL + serves React SPA from /public
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const bidRoutes = require('./routes/bidRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const myProductsRoutes = require('./routes/myProductsRoutes');
const sellerAuctionRoutes = require('./routes/sellerAuctionRoutes');
const registerBidSocket = require('./sockets/bidSocket');
const { closeExpiredAuctions } = require('./controllers/auctionController');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.set('io', io);
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static assets from /public (contains the built React app)
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/bids', bidRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/my-products', myProductsRoutes);
app.use('/api/seller/auctions', sellerAuctionRoutes);
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// SPA fallback: any non-API GET returns index.html so React Router can handle it.
// Placed AFTER API routes so /api/* requests still hit their handlers.
app.get(/^\/(?!api|socket\.io|uploads).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.IO
registerBidSocket(io);

// Auto-close expired auctions every 10s
setInterval(() => {
  closeExpiredAuctions(io).catch((err) => console.error('Auction close job error:', err));
}, 10000);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Auctorium running at http://localhost:${PORT}`);
});
