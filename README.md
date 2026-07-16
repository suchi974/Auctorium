# Rostrum — Online Auction System

A full-stack reference implementation of the Online Auction System requirements doc, built with:
- **Backend:** Node.js, Express, MySQL (mysql2), Socket.IO for real-time bidding, JWT auth, bcrypt
- **Database:** MySQL, schema derived from the ER diagram (Seller/Buyer/Product/Bids/Category)
- **Frontend:** Vanilla HTML/CSS/JS (served statically from `/public`), no build step required

## What's implemented

| Requirements doc section | Where |
|---|---|
| 4.1 User registration/login/roles | `controllers/authController.js`, JWT in `middleware/authMiddleware.js` |
| 5. Create Auction | `POST /api/products` (`controllers/productController.js`) |
| 6. Real-Time Bidding + validation | `controllers/bidController.js` + Socket.IO broadcast |
| 7. Winner Selection | `controllers/auctionController.js`, runs every 10s via `setInterval` in `server.js` |
| 8. Payments | `payments` table in schema (endpoints not wired — see "Not included" below) |
| 9. Notifications | `notifications` table, populated on outbid + win events |
| 10. Admin | `PATCH /api/products/:id/approve`, `is_blocked` flag on users |
| 11. Search & Filtering | `GET /api/products?search=&category=&status=&minPrice=&maxPrice=` |
| ER diagram entities | `sql/schema.sql` — sellers, buyers, products, bids, categories (Offer bridge folded into `bids`) |

### Not included (flagged "to be implemented" in your source doc)
Payment gateway integration, report generation, and dispute management were explicitly marked as future/optional in your PDF — I left the `payments` and `notifications` tables in place so they're easy to wire up, but didn't build fake payment processing.

## 1. Run it locally

```bash
cd auction-system
npm install
cp .env.example .env   # then edit DB credentials + JWT_SECRET

# create the database + tables
mysql -u root -p < sql/schema.sql
mysql -u root -p < sql/seed.sql   # optional demo data

npm run dev   # or: npm start
```

Open **http://localhost:5000** — the frontend is served from the same Express app, so there's nothing else to start.

Demo accounts from `seed.sql` (password for both: `Password123`):
- Seller: `seller@example.com`
- Buyer: `buyer@example.com`

## 2. Getting a real live link (deployment)

I can't host anything myself, but this app deploys in a few minutes on a free tier:

**Render.com (easiest)**
1. Push this folder to a GitHub repo.
2. On Render: New → Web Service → connect the repo.
3. Build command: `npm install` · Start command: `npm start`.
4. Add a Render **MySQL** database (or use PlanetScale/Railway MySQL), then set the `.env` values as Environment Variables in the Render dashboard.
5. Run `sql/schema.sql` against that database once (Render's DB dashboard has a query console, or connect via `mysql` CLI using the credentials Render gives you).
6. Deploy — Render gives you a `https://your-app.onrender.com` URL.

**Railway.app** works almost identically and also offers one-click MySQL provisioning.

## 3. Project structure

```
auction-system/
├── server.js                 # Express + Socket.IO entry point
├── config/db.js              # MySQL connection pool
├── sql/schema.sql            # Full DB schema (from ER diagram)
├── sql/seed.sql              # Demo data
├── controllers/              # Business logic
├── routes/                   # Express route definitions
├── middleware/authMiddleware.js
├── sockets/bidSocket.js      # Real-time bid rooms
└── public/index.html         # Frontend (browse, bid live, list items)
```

## 4. API quick reference

```
POST   /api/auth/register       { name, email, password, role }
POST   /api/auth/login          { email, password, role }
GET    /api/products            ?search=&category=&status=&minPrice=&maxPrice=
GET    /api/products/:id
POST   /api/products            (seller, auth)  create a listing
PATCH  /api/products/:id/approve (admin, auth)   { decision: 'approved'|'rejected' }
POST   /api/bids                (buyer, auth)   { product_id, b_price }
GET    /api/bids/product/:id
GET    /api/categories
POST   /api/categories          (admin, auth)   { name }
```

Socket.IO events: client emits `joinAuction`/`leaveAuction` with a product id; server emits `newBid` and `auctionClosed` to everyone in that room.
