# Zuqu — Hyperlocal Delivery Platform

A full-stack hyperlocal delivery app with three surfaces:
- **API** — Fastify + PostgreSQL backend
- **Shop Portal** — React (Vite) web app for shop owners
- **Customer App** — React Native (Expo) mobile app

---

## Project Structure

```
apps/
├── api/            # Fastify REST API
├── shop-portal/    # Shop owner web portal (React + Vite)
├── customer-app/   # Customer mobile app (React Native + Expo)
└── rider-app/      # Rider mobile app (React Native + Expo)
```

---

## Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- PostgreSQL running on port 5432
- Expo CLI (`npm install -g expo-cli`)

---

## 1. API Server

```bash
cd apps/api
```

### Start (development)
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

### Stop background server
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

### Run a specific migration manually
```bash
npx knex migrate:latest --knexfile src/shared/db/knexfile.ts
```

---

## 2. Shop Portal (Web)

```bash
cd apps/shop-portal
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

---

## 3. Customer App (iOS Simulator)

```bash
cd apps/customer-app
```

### Start Expo dev server
```bash
npm start
# or
npx expo start
```

### Run on iOS Simulator
```bash
npx expo run:ios
```

### Run on Android Emulator
```bash
npx expo run:android
```

### Rebuild (after adding new native packages)
```bash
npx expo run:ios --device
```

---

## 4. Database

### Connect to database
```bash
psql postgresql://hyperlocal_user:hyperlocal_pass@localhost:5432/hyperlocal
```

### Check tables
```sql
\dt
```

### Check orders
```sql
SELECT id, status, total_amount, created_at FROM orders ORDER BY created_at DESC LIMIT 10;
```

### Check riders
```sql
SELECT id, name, phone, is_online, is_verified FROM riders;
```

### Check push subscriptions
```sql
SELECT shop_id, endpoint FROM push_subscriptions;
```

### Reset all orders (dev only)
```sql
DELETE FROM order_items; DELETE FROM orders;
```

---

## 5. Environment Variables

### API (`apps/api/.env`)
```
PORT=3000
DATABASE_URL=postgresql://hyperlocal_user:hyperlocal_pass@localhost:5432/hyperlocal
REDIS_URL=redis://localhost:6379
JWT_SECRET=<secret>
VAPID_PUBLIC_KEY=<generated>
VAPID_PRIVATE_KEY=<generated>
```

### Shop Portal (`apps/shop-portal/.env`)
```
VITE_VAPID_PUBLIC_KEY=<same as API VAPID_PUBLIC_KEY>
```

---

## 6. Migrations (in order)

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

## 7. Quick Start (all services)

Open three terminal tabs:

**Tab 1 — API**
```bash
cd apps/api && npx tsx src/index.ts
```

**Tab 2 — Shop Portal**
```bash
cd apps/shop-portal && npm run dev
```

**Tab 3 — Customer App**
```bash
cd apps/customer-app && npx expo run:ios
```

---

## 8. Common Issues

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
cd apps/customer-app && npx expo start --clear
```

### Migration already run error
Migrations are tracked in the `knex_migrations` table — each runs only once automatically.

### Push notifications not working
1. Make sure "Enable Alerts" is clicked in the shop portal sidebar
2. Check browser notification permissions (not blocked)
3. Verify `VITE_VAPID_PUBLIC_KEY` in `apps/shop-portal/.env` matches `VAPID_PUBLIC_KEY` in `apps/api/.env`
