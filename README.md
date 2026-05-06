# Zuqu — Hyperlocal Delivery Platform

A full-stack hyperlocal delivery platform with five surfaces:
- **API** — Fastify + PostgreSQL + Redis backend
- **Shop Portal** — React (Vite) web app for shop owners
- **Admin Portal** — React (Vite) web app for platform admins
- **Customer App** — React Native (Expo) mobile app for customers
- **Rider App** — React Native (Expo) mobile app for delivery riders

> **New here?** Run `bash setup.sh` after cloning — it handles everything automatically.
> See [REQUIREMENTS.md](./REQUIREMENTS.md) for a full breakdown of what's needed.

---

## Project Structure

```
apps/
├── api/            # Fastify REST API + WebSocket server
├── shop-portal/    # Shop owner web portal (React + Vite)  → port 5174
├── admin-portal/   # Platform admin dashboard (React + Vite) → port 5175
├── customer-app/   # Customer mobile app (React Native + Expo)
└── rider-app/      # Rider mobile app (React Native + Expo)
```

---

## Architecture Overview

```
Customer App  ─┐
Shop Portal   ─┤
Admin Portal  ─┼──► Fastify API (port 3000) ──► PostgreSQL
Rider App     ─┘         │
                          ├──► Redis (pub/sub + geo cache + locks)
                          └──► WebSocket (ws://localhost:3000/ws)
                                   │
                          Redis subscriber ──► broadcast to all WS clients
```

**Key design decisions:**
- Real-time events (order offers, status updates) use WebSocket + Redis pub/sub so broadcasts work across multiple API processes
- Rider location stored in Redis with a **10-minute TTL**, refreshed on every GPS ping — used as the "truly online" signal. Riders with an expired key are treated as offline (ghost-online detection)
- Redis atomic locks (`NX`) prevent double-assignment of orders to multiple riders
- Pre-order availability check: customer app queries `GET /riders/available` before placing an order — warns if no riders are active nearby
- OTP verified on delivery — rider enters code shown on customer app

---

## Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- PostgreSQL running on port 5432
- Redis running on port 6379 (see [Redis Setup](#redis-setup) below)
- Xcode (for iOS simulator)
- Expo CLI (`npm install -g expo-cli`)

---

## Redis Setup

Redis is required for order dispatch, locks, and pub/sub. The easiest way to run it is via Docker:

```bash
docker run -d --name redis-hyperlocal -p 6379:6379 --restart unless-stopped redis:7-alpine
```

Verify it's running:
```bash
docker exec redis-hyperlocal redis-cli ping
# → PONG
```

Or, install natively via Homebrew:
```bash
brew install redis && brew services start redis
```

---

## 1. API Server

```bash
cd apps/api
```

### Environment setup (`apps/api/.env`)
```
PORT=3000
DATABASE_URL=postgresql://hyperlocal_user:hyperlocal_pass@localhost:5432/hyperlocal
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_secret_here
VAPID_PUBLIC_KEY=<generated>
VAPID_PRIVATE_KEY=<generated>
ADMIN_EMAIL=admin@zuqu.in
ADMIN_PASSWORD=admin123
```

### Start (development — auto-restarts on file changes)
```bash
npm run dev
```

### Start (one-off)
```bash
npx tsx src/index.ts
```

### Start in background (logs to file)
```bash
npx tsx src/index.ts > /tmp/api.log 2>&1 &
tail -f /tmp/api.log
```

### Stop server on port 3000
```bash
lsof -ti :3000 | xargs kill -9
```

### Check if server is running
```bash
curl http://localhost:3000/health
```

### Run migrations
```bash
npx tsx src/shared/db/migrate.ts
```

### Run seed (demo products)
```bash
npx tsx src/modules/products/seed.ts
```

---

## 2. Shop Portal (Web)

```bash
cd apps/shop-portal && npm run dev
# http://localhost:5174
```

### Environment setup (`apps/shop-portal/.env`)
```
VITE_VAPID_PUBLIC_KEY=<same as API VAPID_PUBLIC_KEY>
```

**Features:**
- Real-time order notifications (WebSocket + Web Push)
- Sound alerts with enable/disable toggle (on by default)
- Order lifecycle: pending → confirm → (rider picks up) → delivered
- Cancel order button hidden once a rider has been assigned (backend also enforces this)
- Live order status updates from rider

---

## 3. Admin Portal (Web)

```bash
cd apps/admin-portal && npm run dev
# http://localhost:5175
```

> If port 5175 is taken, Vite auto-increments (5176, 5177…). Check terminal output for the actual URL.

### Login credentials
```
Email:    admin@zuqu.in
Password: admin123
```
*(Set in `apps/api/.env` via `ADMIN_EMAIL` and `ADMIN_PASSWORD`)*

### Features

| Page | What you can see & do |
|---|---|
| **Dashboard** | Stats cards (orders, revenue, riders, shops, customers) with period filter (Today / Yesterday / This Week / This Month / This Year / Custom date range). Revenue trend bar chart. Recent orders table. |
| **Orders** | All orders paginated. Filter by status, date range, or search by order#, shop, customer phone, rider name. Click a row to expand details. Export to CSV. |
| **Riders** | All riders with online status, total deliveries, total earned, avg per delivery, wallet balance, trust score. Click a row → Rider Detail. Export to CSV. |
| **Rider Detail** | Full profile, earnings summary, last 20 deliveries. Actions: **Suspend / Unsuspend**, **Verify / Unverify**, **Adjust Wallet** (credit or debit with a note). |
| **Shops** | All shops with total orders, revenue, average order value. Click a row → Shop Detail. |
| **Shop Detail** | Shop profile, revenue summary, last 20 orders. |
| **Customers** | All customers with order count and total spend. Click a row → Customer Detail. |
| **Customer Detail** | Customer profile, order history. |

### Admin API endpoints
All under `/api/admin/` — require `Authorization: Bearer <admin-jwt>` header.

```
POST  /api/admin/login
GET   /api/admin/stats?from=YYYY-MM-DD&to=YYYY-MM-DD
GET   /api/admin/orders?status=&from=&to=&search=&page=&limit=
GET   /api/admin/orders/export/csv
GET   /api/admin/riders?search=&page=&limit=
GET   /api/admin/riders/export/csv
GET   /api/admin/riders/:id
PATCH /api/admin/riders/:id/suspend   { suspend: true|false }
PATCH /api/admin/riders/:id/verify    { verify: true|false }
PATCH /api/admin/riders/:id/wallet    { amount: number, note: string }
GET   /api/admin/shops?search=&page=&limit=
GET   /api/admin/shops/:id
GET   /api/admin/customers?search=&page=&limit=
GET   /api/admin/customers/:id
```

---

## 4. Customer App (iOS Simulator)

```bash
cd apps/customer-app && npx expo run:ios
```

**Features:**
- Browse nearby shops and products by category
- Search products by name or brand with **recent search history** (saved locally)
- Cart with tip selection, saved delivery addresses, and free-delivery threshold hints
- **Pre-order rider availability check** — warns before placing if no riders are active nearby
- Live order tracking: WebSocket updates + 10-second polling fallback + re-fetch on screen focus
- OTP display when rider is on the way (shown when status = `picked_up`)
- Post-delivery rating modal (rider + shop ratings, optional review text)
- Reorder from past orders
- Saved addresses manager

---

## 5. Rider App (iOS Simulator)

```bash
cd apps/rider-app && npx expo run:ios
```

**Features:**
- Toggle online/offline with live GPS location
- Incoming order offers with 30-second countdown timer (accept/reject)
- Audio chime + local notification for new order offers (works in background)
- **Online validation at accept time** — if rider went offline between receiving and accepting an offer, the accept is rejected server-side
- Active delivery screen — confirm pickup, enter OTP to complete
- Earnings screen with period tabs (Today / Week / Month / Year / All)
- Custom date range calendar picker
- Daily earnings bar chart
- Delivery history grouped by date

### iOS Simulator GPS fix

The iOS simulator defaults to San Francisco coordinates. Run this **after** launching the simulator, **before** going online in the rider app:

```bash
# Bangalore
xcrun simctl location booted set 12.9352,77.6245

# Mumbai
xcrun simctl location booted set 19.0760,72.8777

# Delhi
xcrun simctl location booted set 28.6139,77.2090
```

---

## 6. Quick Start (all services)

Open five terminal tabs:

```bash
# Tab 1 — Redis (if not already running)
docker run -d --name redis-hyperlocal -p 6379:6379 --restart unless-stopped redis:7-alpine

# Tab 2 — API
cd apps/api && npm run dev

# Tab 3 — Shop Portal
cd apps/shop-portal && npm run dev
# → http://localhost:5174

# Tab 4 — Admin Portal
cd apps/admin-portal && npm run dev
# → http://localhost:5175  (admin@zuqu.in / admin123)

# Tab 5 — Customer App
cd apps/customer-app && npx expo run:ios

# Tab 6 — Rider App (set GPS first)
xcrun simctl location booted set 12.9352,77.6245
cd apps/rider-app && npx expo run:ios
```

---

## 7. Database

### Connect
```bash
psql postgresql://hyperlocal_user:hyperlocal_pass@localhost:5432/hyperlocal
```

### Useful queries

```sql
-- Recent orders
SELECT id, order_number, status, total_amount, rider_id, created_at
FROM orders ORDER BY created_at DESC LIMIT 10;

-- Riders and their online/location status
SELECT id, name, phone, is_online, is_verified, is_suspended, lat, lng, location_updated
FROM riders;

-- Earnings per rider
SELECT rider_id, COUNT(*) as deliveries, SUM(delivery_fee) as total
FROM orders WHERE status = 'delivered' GROUP BY rider_id;

-- Push subscriptions
SELECT shop_id, endpoint FROM push_subscriptions;

-- Saved addresses
SELECT * FROM customer_addresses ORDER BY created_at DESC LIMIT 20;

-- Ratings
SELECT * FROM order_ratings ORDER BY created_at DESC LIMIT 20;

-- Reset all orders (dev only)
DELETE FROM order_items; DELETE FROM orders;
```

---

## 8. Migrations

Run via `cd apps/api && npx tsx src/shared/db/migrate.ts` — each file runs only once.

| File | Description |
|---|---|
| `001_create_users.ts` | Users table |
| `002_create_shops.ts` | Shops table |
| `003_create_products.ts` | Master & shop products |
| `004_create_orders.ts` | Orders & order items |
| `005_create_riders.ts` | Riders table |
| `006_add_order_number.ts` | Human-readable order numbers |
| `007_seed_demo_data.ts` | Demo shop + products |
| `008_fix_order_rider_fk.ts` | Fix rider FK constraint |
| `009_push_subscriptions.ts` | Web push subscriptions |
| `010_customer_push_tokens.ts` | Customer Expo push tokens |
| `011_shop_product_custom_image.ts` | Custom product images |
| `012_ratings.ts` | Post-delivery ratings (rider + shop) |
| `013_saved_addresses.ts` | Customer saved addresses |
| `014_promo_codes.ts` | Promo / discount codes |

---

## 9. Order Flow

```
Customer checks rider availability (pre-order)
        │
        ▼ (riders available)
Customer places order
        │
        ▼
  status: pending
        │
  Shop confirms
        │
        ▼
  status: confirmed
        │
  API finds nearest TRULY ONLINE rider (Redis key alive, within 15km, not busy)
  Broadcasts order_offered via WebSocket
        │
  Rider accepts within 30s (is_online re-validated at accept time)
        │
        ▼
  status: assigned  ◄── Cancel button disappears (backend + UI guard)
        │
  Rider picks up from shop
        │
        ▼
  status: picked_up  ◄── Customer sees OTP here
        │
  Customer shows OTP to rider
  Rider enters OTP in app
        │
        ▼
  status: delivered  ◄── Rating modal shown to customer
```

If rider rejects or 30s timer expires → offer goes to next nearest rider.  
If no riders are available at confirmation time → API **retries every 30 seconds for up to 5 minutes** (10 attempts). As soon as a rider comes online during that window they will receive the offer automatically.  
After 10 failed attempts → `order_no_riders` event broadcast to shop.

---

## 10. Internal API Endpoints (dev/ops)

```bash
# Re-trigger order offer (useful for testing)
curl -X POST http://localhost:3000/api/internal/offer/<orderId>

# Check rider availability near a shop
curl "http://localhost:3000/api/riders/available?shop_id=<shopId>"
# → { available: true, count: 2, total_nearby: 3 }

# Health check
curl http://localhost:3000/health
```

---

## 11. Common Issues

### Redis not running
```bash
# Start via Docker
docker run -d --name redis-hyperlocal -p 6379:6379 --restart unless-stopped redis:7-alpine

# Or restart existing container
docker start redis-hyperlocal

# Verify
docker exec redis-hyperlocal redis-cli ping
# → PONG
```

### Port already in use
```bash
lsof -ti :3000 | xargs kill -9   # API
lsof -ti :5174 | xargs kill -9   # Shop portal
lsof -ti :5175 | xargs kill -9   # Admin portal
```

### Admin portal starts on wrong port
Vite auto-increments if 5175 is taken. Check the terminal output for the actual URL, or kill any previous instances first:
```bash
lsof -ti :5175 :5176 :5177 | xargs kill -9
cd apps/admin-portal && npm run dev
```

### Expo build cache issues
```bash
npx expo start --clear
```

### Rider not receiving order offers

**Always do this before going online in the rider app:**
```bash
# Set simulator GPS to Bangalore FIRST, then open rider app and tap "Go Online"
xcrun simctl location booted set 12.9352,77.6245
```
The iOS simulator defaults to **San Francisco** coordinates. If you go online without setting GPS first, the rider's location is stored as SF in both the DB and Redis — no shop in Bangalore will ever be within range.

**Full checklist:**
1. Set simulator GPS to Bangalore (see above)
2. Open the rider app and tap **Go Online** — this writes the correct location to Redis with a 10-min TTL
3. Verify Redis is running: `docker exec redis-hyperlocal redis-cli ping` → should return `PONG`
4. The rider must have a live Redis location key — if it has expired (no location update in 10 min), they are treated as offline even if `is_online = true` in the DB
5. Check order status is `confirmed` in the DB (not `pending`)
6. Re-trigger the offer manually if needed: `curl -X POST http://localhost:3000/api/internal/offer/<orderId>`

**Fix a rider stuck with wrong location (e.g. San Francisco):**
```bash
# 1. Set correct GPS on simulator
xcrun simctl location booted set 12.9352,77.6245

# 2. Fix directly in DB if needed
psql postgresql://hyperlocal_user:hyperlocal_pass@localhost:5432/hyperlocal \
  -c "UPDATE riders SET lat=12.9352, lng=77.6245, location_updated=NOW() WHERE name='<RiderName>';"

# 3. Fix Redis location key
docker exec redis-hyperlocal redis-cli SET "rider_location:<riderId>" \
  '{"lat":12.9352,"lng":77.6245}' EX 600

# 4. Re-trigger the order offer
curl -X POST http://localhost:3000/api/internal/offer/<orderId>
```

**Order confirmed but no rider assigned after 5 minutes:**
```bash
# Check if any riders are actually online and nearby
curl "http://localhost:3000/api/riders/available?shop_id=<shopId>"
# → { available: false, count: 0, total_nearby: 0 }

# Check rider online status in DB
psql postgresql://hyperlocal_user:hyperlocal_pass@localhost:5432/hyperlocal \
  -c "SELECT name, is_online, lat, lng, location_updated FROM riders;"

# Check which riders have a live Redis key
docker exec redis-hyperlocal redis-cli KEYS "rider_location:*"
```

### Push notifications not working (shop portal)
1. Click "Enable Alerts" in the shop portal sidebar
2. Check browser notification permissions (not blocked)
3. Verify `VITE_VAPID_PUBLIC_KEY` in `apps/shop-portal/.env` matches `VAPID_PUBLIC_KEY` in `apps/api/.env`

### Rider audio not playing in background
- The rider app uses `expo-notifications` to fire a local notification (with sound) when an order arrives
- Make sure notification permissions are granted on first launch
- WAV chime: `apps/rider-app/assets/new_order.wav`

### Migration already run error
Migrations are tracked in `knex_migrations` — each file runs only once automatically.

### PostgreSQL not running
The project uses a Docker container named `hyperlocal_postgres`:
```bash
# Start it
docker start hyperlocal_postgres

# Verify
docker exec hyperlocal_postgres psql -U hyperlocal_user -d hyperlocal -c "SELECT 1"
```

### Admin portal blank / "Something went wrong"
1. Make sure PostgreSQL and Redis are both running (see above)
2. The admin token in localStorage may be expired — click "Back to Login" and sign in again
3. Kill any stale Vite processes and restart: `lsof -ti :5175 :5176 :5177 | xargs kill -9 && cd apps/admin-portal && npm run dev`

### Shops showing "0 Shops Nearby" in customer app
The `GET /shops/nearby` endpoint is public (no auth needed). If you see this:
1. Make sure PostgreSQL is running — the shops table needs to be populated
2. Check that at least one shop has `is_active = true` in the DB:
```sql
SELECT name, is_active, is_open, lat, lng FROM shops;
```
3. Check the shop's `lat`/`lng` are within range of the customer's location (default radius: 2km for the app, 5km for the API test)

### Order stuck as "pending" (shop not confirming)
Check the shop portal is running and connected. You can manually update in psql:
```sql
UPDATE orders SET status = 'confirmed' WHERE id = '<orderId>';
```
Then re-trigger the rider offer:
```bash
curl -X POST http://localhost:3000/api/internal/offer/<orderId>
```
