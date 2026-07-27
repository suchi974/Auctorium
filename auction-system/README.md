# Auctorium — Online Auction System (Node.js + MySQL + Socket.IO)

Production-ready full-stack auction platform with real-time bidding, notifications, and mock payments.

## What's included in this build
- **Fixed** — "Bid Placed Successfully" toast on success; specific error messages on failure ("Bid amount must be higher…", "Auction has already ended", "You cannot bid on your own auction", "Please login to place a bid").
- **New** — Real-time **seller notifications** when an auction ends (product, winner, winning bid, end time, status, payment status).
- **New** — Real-time **buyer outbid alerts** targeted at the previously highest bidder only.
- **New** — Mock **payment page** with 5 methods, 2s loader, `TXN-…` transaction ID, printable receipt.
- **New** — **My Products** (won auctions) page + **Product Details** page for won items.
- **New** — Modern notification bell with unread badge, mark-read / mark-all-read.
- **UI polish** — sticky navbar, skeleton loaders, hover-lift cards, image zoom on hover, dedup toasts, modern footer with social links, better buttons/inputs/forms.
- **DB migration** — adds `notifications.title` + `notifications.data JSON` + indexes (idempotent).

Existing endpoints (auth, products, bids, categories, admin approvals, image uploads) are all preserved.

---

## Prerequisites
- Node.js 18+
- MySQL 8+ (or MariaDB 10.5+)

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
Create/update `.env` in project root (already includes JWT_SECRET etc.):
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=auction_system
JWT_SECRET=change-this-in-production
JWT_EXPIRES_IN=7d
PORT=5000
```

### 3. Create database + tables
```bash
# fresh install
mysql -u root -p < sql/schema.sql
mysql -u root -p auction_system < sql/seed.sql

# already have a DB? apply the migration to add new columns/indexes
mysql -u root -p auction_system < sql/migration.sql
```

### 4. Seed some data (optional)
```bash
node seedDatabase.js
node insertProducts.js
```

### 5. Run
```bash
npm run dev    # nodemon
# or
npm start
```
Open http://localhost:5000

---

## Verifying the changes

### Bid status messages
1. Log in as a buyer, place a bid ≥ min next bid → **green** toast "Bid Placed Successfully".
2. Try to bid on your own auction (same email as seller) → **red** toast "You cannot bid on your own auction."
3. Bid below current price → "Bid amount must be higher than the current highest bid…".
4. Bid on an ended auction → "Auction has already ended."
5. Log out and click bid → "Please login to place a bid."

### Outbid + seller winner notifications
1. Buyer A bids on Product X.
2. Buyer B outbids Buyer A. Buyer A sees a **red** outbid toast + notification card w/ product name, previous bid, current highest, timestamp, "View Auction".
3. When the auction ends with Buyer B as winner:
   - Buyer B receives a **winner** notification.
   - Seller receives a **winner** notification containing: Product, Winner name, Winning bid, End time, Status: Completed, Payment: Pending.
   - Clicking either notification opens the auction detail page.

### Payments + My Products
1. Winner opens **My Products** (avatar menu → My Products).
2. Click **Pay Now** → choose method → **Proceed Payment** → 2s loader → success screen with `TXN-…` ID.
3. Click **Download Receipt** → printable receipt page.
4. Back on My Products the card now shows **Paid** + **View Receipt**.

---

## API reference

### Existing
- `POST /api/auth/register`, `POST /api/auth/login`
- `GET /api/products`, `GET /api/products/:id`, `POST /api/products` (seller), `PATCH /api/products/:id/approve` (admin)
- `POST /api/bids` (buyer), `GET /api/bids/product/:productId`
- `GET /api/categories`, `POST /api/categories` (admin)

### New
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET  | `/api/notifications` | any | List latest 100 notifications |
| GET  | `/api/notifications/unread-count` | any | `{ count }` |
| POST | `/api/notifications/:id/read` | any | Mark one read |
| POST | `/api/notifications/read-all` | any | Mark all read |
| GET  | `/api/payments/product/:productId` | buyer | Order summary + existing payment (if any) |
| POST | `/api/payments` | buyer | Mock pay `{ product_id, method }` |
| GET  | `/api/payments/:id/receipt` | buyer | Receipt payload |
| GET  | `/api/my-products` | buyer | Won auctions |
| GET  | `/api/my-products/:id` | buyer | Won product detail |

### Real-time Socket.IO events
- `newBid` — auction room + `all_bids_room`
- `auctionClosed` — auction room
- `notification` — personal room `user_<role>_<id>` (client emits `joinUser` after connect)

---

## Project structure
```
auction-system/
├── server.js                              # entry, registers all routes + WS + close-job
├── config/db.js                           # mysql2 pool
├── middleware/authMiddleware.js
├── sockets/bidSocket.js                   # adds user_<role>_<id> rooms
├── controllers/
│   ├── authController.js
│   ├── productController.js
│   ├── bidController.js                   # robust validation + outbid emit
│   ├── auctionController.js               # closes auctions + seller notification
│   ├── categoryController.js
│   ├── notificationController.js          # NEW
│   ├── paymentController.js               # NEW (mock gateway)
│   └── myProductsController.js            # NEW
├── routes/
│   ├── authRoutes.js
│   ├── productRoutes.js
│   ├── bidRoutes.js
│   ├── categoryRoutes.js
│   ├── notificationRoutes.js              # NEW
│   ├── paymentRoutes.js                   # NEW
│   └── myProductsRoutes.js                # NEW
├── sql/
│   ├── schema.sql
│   ├── seed.sql
│   └── migration.sql                      # NEW - additive, idempotent
├── public/
│   ├── index.html                         # bell + My Products + Payment + Details + footer
│   ├── app.js                             # all fixes + real-time
│   └── styles.css                         # polished + new components
├── seedDatabase.js
├── insertProducts.js
├── checkDB.js
└── package.json
```

---

## Notes
- Payment gateway is **fully mocked** — replace `paymentController.pay()` with your real gateway later.
- Auto-close job runs every 10s (interval in `server.js`).
- The "cannot bid on own auction" check matches buyer + seller by **email** (they live in separate tables).

Enjoy! For issues or extensions, tweak the code — all controllers are small and single-purpose.
