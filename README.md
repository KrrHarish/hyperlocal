# Zuqu — Hyperlocal Delivery Platform

A full-stack hyperlocal delivery platform with four surfaces:
- **API** — Fastify + PostgreSQL + Redis backend
- **Shop Portal** — React (Vite) web app for shop owners
- **Customer App** — React Native (Expo) mobile app for customers
- **Rider App** — React Native (Expo) mobile app for delivery riders

> **New here?** Run `bash setup.sh` after cloning — it handles everything automatically.
> See [REQUIREMENTS.md](./REQUIREMENTS.md) for a full breakdown of what's needed.

---

## Project Structure

```
apps/
├── api/            # Fastify REST API + WebSocket server
├── shop-portal/    # Shop owner web portal (React + Vite)
├── customer-app/   # Customer mobile app (React Native + Expo)
└── rider-app/      # Rider mobile app (React Native + Expo)
```

---

## Architecture Overview

```
Customer App  ─┐
Shop Portal   ─┼──► Fastify API (port 3000) ──► PostgreSQL
Rider App     ─┘         │
                          ├──► Redis (pub/sub + geo cache + locks)
                          └──► WebSocket (ws://localhost:3000/ws)
                                   │
                          Redis subscriber ──► broadcast to all WS clients
```

**Key design decisions:**
- Real-time events (order offers, status updates) use WebSocket + Redis pub/sub so broadcasts work across multiple API processes
- Rider location stored in Redis (300s TTL) for fast proximity queries
- Redis atomic locks (`NX`) prevent double-assignment of orders
- OTP verified on delivery — rider enters code shown on customer app

---

## Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- PostgreSQL running on port 5432
- Redis running on port 6379
- Xcode (for iOS simulator)
- Expo CLI (`npm install -g expo-cli`)

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
```

### Start (development — auto-restarts on file changes)
```bash
npm run dev
# or directly:
npx nodemon --watch src --ext ts --exec "npx tsx src/index.ts"
```

### Start (one-off)
```bash
npx tsx src/index.ts
```

### Start in background (logs to file)
```bash
npx tsx src/index.ts > /tmp/api.log 2>&1 &
```

### Watch logs
```bash
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
cd apps/shop-portal
```

### Environment setup (`apps/shop-portal/.env`)
```
VITE_VAPID_PUBLIC_KEY=<same as API VAPID_PUBLIC_KEY>
```

### Start dev server
```bash
npm run dev
# Runs on http://localhost:5174
```

### Build for production
```bash
npm run build
```

**Features:**
- Real-time order notifications (WebSocket + Web Push)
- Sound alerts with enable/disable toggle (on by default)
- Order lifecycle: pending → confirm → (rider picks up) → delivered
- Live order status updates from rider

---

## 3. Customer App (iOS Simulator)

```bash
cd apps/customer-app
```

### Run on iOS Simulator
```bash
npx expo run:ios
```

### Run on Android Emulator
```bash
npx expo run:android
```

**Features:**
- Browse shops and products
- Place orders with cart
- Live order tracking screen
- OTP display when rider is on the way (shown when status = `picked_up`)
- Real-time status updates via WebSocket

---

## 4. Rider App (iOS Simulator)

```bash
cd apps/rider-app
```

### Run on iOS Simulator
```bash
npx expo run:ios
```

**Features:**
- Toggle online/offline with live GPS location
- Incoming order offers with 30-second countdown timer (accept/reject)
- Audio chime + local notification for new order offers (works in background)
- Active delivery screen — confirm pickup, enter OTP to complete
- Earnings screen with period tabs (Today / Week / Month / Year / All)
- Custom date range picker (calendar UI, no extra library)
- Daily earnings bar chart
- Delivery history grouped by date

### iOS Simulator GPS fix

The iOS simulator defaults to San Francisco coordinates. Set it to your city:

```bash
# Bangalore (or replace with your shop's coordinates)
xcrun simctl location booted set 12.9352,77.6245
```

Set this before going online in the rider app so the proximity matching works.

---

## 5. Database

### Connect
```bash
psql postgresql://hyperlocal_user:hyperlocal_pass@localhost:5432/hyperlocal
```

### Useful queries

```sql
-- Recent orders
SELECT id, order_number, status, total_amount, rider_id, created_at
FROM orders ORDER BY created_at DESC LIMIT 10;

-- Riders
SELECT id, name, phone, is_online, is_verified, lat, lng FROM riders;

-- Earnings for a rider
SELECT rider_id, COUNT(*) as deliveries, SUM(delivery_fee) as total
FROM orders WHERE status = 'delivered' GROUP BY rider_id;

-- Push subscriptions
SELECT shop_id, endpoint FROM push_subscriptions;

-- Reset all orders (dev only)
DELETE FROM order_items; DELETE FROM orders;
```

---

## 6. Migrations

Run in order via `npx tsx src/shared/db/migrate.ts` — each runs only once.

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

---

## 7. Quick Start (all four services)

Open four terminal tabs:

**Tab 1 — API**
```bash
cd apps/api && npm run dev
```

**Tab 2 — Shop Portal**
```bash
cd apps/shop-portal && npm run dev
```

**Tab 3 — Customer App**
```bash
cd apps/customer-app && npx expo run:ios
```

**Tab 4 — Rider App**
```bash
# Set simulator GPS first
xcrun simctl location booted set 12.9352,77.6245

cd apps/rider-app && npx expo run:ios
```

---

## 8. Order Flow

```
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
  API finds nearest online rider (within 15km)
  Broadcasts order_offered via WebSocket
        │
  Rider accepts (30s window)
        │
        ▼
  status: assigned
        │
  Rider picks up from shop
        │
        ▼
  status: picked_up   ◄── Customer sees OTP here
        │
  Customer shows OTP to rider
  Rider enters OTP in app
        │
        ▼
  status: delivered
```

If rider rejects or timer expires → offer goes to next nearest rider.

---

## 9. Internal API Endpoints (dev/ops)

### Manually trigger order offer (useful for testing)
```bash
curl -X POST http://localhost:3000/api/internal/offer/<orderId>
```

### Health check
```bash
curl http://localhost:3000/health
```

---

## 10. Common Issues

### Port 3000 already in use
```bash
lsof -ti :3000 | xargs kill -9
```

### Port 5174 already in use
```bash
lsof -ti :5174 | xargs kill -9
```

### Expo build cache issues
```bash
npx expo start --clear
```

### Rider not receiving order offers
1. Make sure rider is **online** in the app
2. Check simulator GPS is set to correct coordinates (`xcrun simctl location booted set <lat>,<lng>`)
3. Verify Redis is running: `redis-cli ping` → should return `PONG`
4. Check the order status is `confirmed` (not `pending`)
5. Re-trigger manually: `curl -X POST http://localhost:3000/api/internal/offer/<orderId>`

### Push notifications not working (shop portal)
1. Click "Enable Alerts" in the shop portal sidebar
2. Check browser notification permissions (not blocked)
3. Verify `VITE_VAPID_PUBLIC_KEY` in `apps/shop-portal/.env` matches `VAPID_PUBLIC_KEY` in `apps/api/.env`

### Rider audio not playing in background
- The rider app uses `expo-notifications` to fire a local notification (with sound) when an order arrives
- Make sure notification permissions are granted on first launch
- The WAV chime file is at `apps/rider-app/assets/new_order.wav`

### Migration already run error
Migrations are tracked in the `knex_migrations` table — each file runs only once automatically.
