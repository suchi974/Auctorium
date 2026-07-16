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
const registerBidSocket = require('./sockets/bidSocket');
const { closeExpiredAuctions } = require('./controllers/auctionController');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.set('io', io);
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/bids', bidRoutes);
app.use('/api/categories', categoryRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

registerBidSocket(io);

// Scheduled job: check for expired auctions every 10 seconds (Section 7)
setInterval(() => {
  closeExpiredAuctions(io).catch((err) => console.error('Auction close job error:', err));
}, 10000);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Online Auction System running on http://localhost:${PORT}`);
});
