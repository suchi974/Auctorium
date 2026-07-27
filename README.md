# Auctorium — Online Auction System (Node.js + MySQL + Socket.IO)

Production-ready full-stack auction platform with real-time bidding, notifications, and mock payments.

## What's included in this build
- **Fixed** — "Bid Placed Successfully" toast on success; specific error messages on failure ("Bid amount must be higher…", "Auction has already ended", "You cannot bid on your own auction", "Please login to place a bid").
- **New** — Real-time **seller notifications** when an auction ends (product, winner, winning bid, end time, status, payment status).
- **New** — Real-time **buyer outbid alerts** targeted at the previously highest bidder only.
- **New** — Mock **payment page** with 5 methods, 2s loader, `TXN-…` transaction ID, printable receipt.
- **New** — **My Products** (won auctions) page + **Product Details** page for won items.
- **New** — Modern notification bell with unread badge, mark-read / mark-all-read / delete / clear-all.
- **New** — **Seller auction management**: sellers can edit or cancel any auction that hasn't closed, manually close an auction early, and see their 5 most recent bid alerts.
- **UI polish** — sticky navbar, skeleton loaders, hover-lift cards, image zoom on hover, dedup toasts, modern footer with social links, better buttons/inputs/forms.
- **DB install** — `sql/install.sql` is now the single recommended script (schema + seed in one shot); `sql/migration.sql` remains for upgrading an older database, and adds `notifications.title` + `notifications.data JSON` + indexes (idempotent).

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
Create/update `.env` in project root:
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
# fresh install (recommended) — creates DB, schema, and seed data in one shot
mysql -u root -p < sql/install.sql

# upgrading an existing older DB instead? apply the migration to add new columns/indexes
mysql -u root -p auction_system < sql/migration.sql
```
`sql/schema.sql` and `sql/seed.sql` are kept only for backward compatibility — use `install.sql` for a first-time setup. See `sql/INSTALL.md` for GUI-tool instructions (Workbench, phpMyAdmin) and troubleshooting.

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

### Demo credentials (created by `install.sql`)
| Role | Email | Password |
|---|---|---|
| Seller | seller@auction.com | Password@123 |
| Seller | seller2@auction.com | Password@123 |
| Buyer | buyer@auction.com | Password@123 |
| Buyer | buyer2@auction.com | Password@123 |
| Admin | admin@auction.com | Password@123 |

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

### Seller auction management
1. Log in as a seller, open **My Auctions** (or equivalent seller dashboard entry).
2. Edit an active auction's details — name, description, category, price, end time — saves via `PATCH /api/seller/auctions/:id`.
3. Try editing an auction that's already closed/ended → server rejects with a 409.
4. Click **Close Auction** on a live listing → it closes immediately and the winner/notification flow fires.
5. Delete an auction you own → it's removed via `DELETE /api/seller/auctions/:id`.

---

## API reference

### Existing
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/products`, `GET /api/products/recent-live`, `GET /api/products/:id`, `POST /api/products` (seller), `POST /api/products/upload` (seller), `PATCH /api/products/:id/approve` (admin)
- `POST /api/bids` (buyer), `GET /api/bids/product/:productId`, `GET /api/bids/my` (buyer)
- `GET /api/categories`, `POST /api/categories` (admin)

### New
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET  | `/api/notifications` | any | List latest 100 notifications |
| GET  | `/api/notifications/unread-count` | any | `{ count }` |
| POST | `/api/notifications/:id/read` | any | Mark one read |
| POST | `/api/notifications/read-all` | any | Mark all read |
| DELETE | `/api/notifications/:id` | any | Delete one notification |
| DELETE | `/api/notifications` | any | Clear all notifications |
| GET  | `/api/payments/product/:productId` | buyer | Order summary + existing payment (if any) |
| POST | `/api/payments` | buyer | Mock pay `{ product_id, method }` |
| GET  | `/api/payments/:id/receipt` | buyer | Receipt payload |
| GET  | `/api/my-products` | buyer | Won auctions |
| GET  | `/api/my-products/:id` | buyer | Won product detail |
| GET  | `/api/seller/auctions` | seller | Own listings w/ bid count + highest bid |
| GET  | `/api/seller/auctions/recent-alerts` | seller | Last 5 bid-confirmation notifications |
| PATCH | `/api/seller/auctions/:id` | seller | Edit an auction (blocked once closed/ended) |
| DELETE | `/api/seller/auctions/:id` | seller | Remove an auction |
| POST | `/api/seller/auctions/:id/close` | seller | Manually close an auction |
| GET | `/api/health` | — | Health check |

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
│   ├── notificationController.js
│   ├── paymentController.js               # mock gateway
│   ├── myProductsController.js
│   └── sellerAuctionController.js         # NEW — seller-side edit/close/delete + bid alerts
├── routes/
│   ├── authRoutes.js
│   ├── productRoutes.js
│   ├── bidRoutes.js
│   ├── categoryRoutes.js
│   ├── notificationRoutes.js
│   ├── paymentRoutes.js
│   ├── myProductsRoutes.js
│   └── sellerAuctionRoutes.js             # NEW
├── sql/
│   ├── install.sql                        # NEW — recommended one-shot schema + seed
│   ├── schema.sql                         # legacy — schema only
│   ├── seed.sql                           # legacy — sample data only
│   ├── migration.sql                      # additive, idempotent upgrade path
│   └── INSTALL.md                         # detailed setup walkthrough (CLI/Workbench/phpMyAdmin)
├── public/
│   ├── index.html                         # bell + My Products + Payment + Details + footer
│   ├── app.js                             # base app logic
│   ├── styles.css                         # polished + new components
│   └── static/
│       ├── css/                           # built React app CSS + ui-fixes.css
│       └── js/                            # built React app JS + patch scripts:
│           ├── seller-category-compat.js
│           ├── buyer-recent-alerts.js
│           └── seller-auction-management.js  # NEW
├── seedDatabase.js
├── insertProducts.js
├── listProducts.js
├── checkDB.js
└── package.json
```

---

## Notes
- Payment gateway is **fully mocked** — replace `paymentController.pay()` with your real gateway later.
- Auto-close job runs every 10s (interval in `server.js`).
- The "cannot bid on own auction" check matches buyer + seller by **email** (they live in separate tables).
- Seller edits are blocked server-side (not just in the UI) once an auction is closed or its end time has passed.

Enjoy! For issues or extensions, tweak the code — all controllers are small and single-purpose.
