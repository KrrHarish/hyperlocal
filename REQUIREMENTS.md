# Zuqu — Requirements & Setup

Everything you need to run this project from a fresh clone.

---

## System Requirements

| Tool | Version | Install |
|---|---|---|
| **Node.js** | v20+ | https://nodejs.org or `nvm install 20` |
| **pnpm** | any | `npm install -g pnpm` |
| **PostgreSQL** | v14+ | https://www.postgresql.org/download/ |
| **Redis** | v6+ | `brew install redis` (macOS) |
| **Xcode** | 15+ | Mac App Store (iOS simulator) |
| **Expo CLI** | any | `npm install -g expo-cli` |

### macOS (Homebrew) quick install
```bash
brew install node@20 postgresql redis
brew services start postgresql
brew services start redis
```

### Ubuntu/Debian quick install
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql redis-server
sudo systemctl start postgresql redis-server
```

---

## Clone & Setup

```bash
git clone <repo-url>
cd hyperlocal
bash setup.sh
```

The `setup.sh` script will:
1. ✅ Check Node, pnpm, PostgreSQL, Redis are installed
2. ✅ Run `pnpm install` across all workspaces
3. ✅ Create `.env` files for the API and shop portal
4. ✅ Create the PostgreSQL database and user
5. ✅ Run all database migrations
6. ✅ Auto-generate VAPID keys for push notifications

---

## Manual Setup (if you prefer step by step)

### 1. Install dependencies
```bash
pnpm install
```

### 2. Create PostgreSQL database
```bash
psql postgres -c "CREATE USER hyperlocal_user WITH PASSWORD 'hyperlocal_pass';"
psql postgres -c "CREATE DATABASE hyperlocal OWNER hyperlocal_user;"
psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE hyperlocal TO hyperlocal_user;"
```

### 3. Create environment files

**`apps/api/.env`**
```
PORT=3000
DATABASE_URL=postgresql://hyperlocal_user:hyperlocal_pass@localhost:5432/hyperlocal
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_random_secret_here
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
```

**`apps/shop-portal/.env`**
```
VITE_VAPID_PUBLIC_KEY=
```

### 4. Generate VAPID keys (for push notifications)
```bash
cd apps/api
node -e "const wp=require('web-push'); const k=wp.generateVAPIDKeys(); console.log('PUBLIC:', k.publicKey, '\nPRIVATE:', k.privateKey)"
```
Copy the output keys into:
- `apps/api/.env` → `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`
- `apps/shop-portal/.env` → `VITE_VAPID_PUBLIC_KEY` (same as public key)

### 5. Run database migrations
```bash
cd apps/api
npx tsx src/shared/db/migrate.ts
```

### 6. (Optional) Seed demo data
```bash
cd apps/api
npx tsx src/modules/products/seed.ts
```

---

## npm / Node Packages

All packages are managed via pnpm workspaces. Run `pnpm install` at the root — no need to install per-app.

### API (`apps/api`)
| Package | Purpose |
|---|---|
| `fastify` | HTTP server |
| `@fastify/jwt` | JWT auth |
| `@fastify/websocket` | WebSocket support |
| `knex` | SQL query builder + migrations |
| `pg` | PostgreSQL driver |
| `ioredis` | Redis client (pub/sub + caching) |
| `web-push` | Web push notifications (VAPID) |
| `tsx` / `nodemon` | Dev server with hot reload |

### Shop Portal (`apps/shop-portal`)
| Package | Purpose |
|---|---|
| `react` + `react-dom` | UI framework |
| `vite` | Build tool / dev server |
| `axios` | HTTP client |
| `react-router-dom` | Client-side routing |

### Customer App & Rider App (`apps/customer-app`, `apps/rider-app`)
| Package | Purpose |
|---|---|
| `expo` | React Native build toolchain |
| `expo-linear-gradient` | Gradient backgrounds |
| `expo-location` | GPS location |
| `expo-av` | Audio playback (order chime) |
| `expo-notifications` | Local notifications (background sound) |
| `@expo/vector-icons` | Ionicons icon set |
| `@react-navigation/native` | Screen navigation |
| `@react-navigation/bottom-tabs` | Tab bar navigation |
| `@react-navigation/native-stack` | Stack navigation |
| `axios` | HTTP client |
| `@react-native-async-storage/async-storage` | Local token storage |

---

## iOS Simulator Setup

### Set GPS location (required for rider ↔ shop proximity)

The iOS simulator defaults to San Francisco. Run this after launching the simulator:

```bash
# Bangalore
xcrun simctl location booted set 12.9352,77.6245

# Mumbai
xcrun simctl location booted set 19.0760,72.8777

# Delhi
xcrun simctl location booted set 28.6139,77.2090

# Hyderabad
xcrun simctl location booted set 17.3850,78.4867

# Chennai
xcrun simctl location booted set 13.0827,80.2707
```

> Run this before going online in the rider app, otherwise the rider will appear ~14,000 km away from shops.

---

## Running All Services

After setup, open 4 terminal tabs:

```bash
# Tab 1 — API (auto-restarts on file changes)
cd apps/api && npm run dev

# Tab 2 — Shop Portal
cd apps/shop-portal && npm run dev
# Open http://localhost:5174

# Tab 3 — Customer App
cd apps/customer-app && npx expo run:ios

# Tab 4 — Rider App (set GPS first)
xcrun simctl location booted set 12.9352,77.6245
cd apps/rider-app && npx expo run:ios
```

---

## Verify Everything Works

```bash
# API health check
curl http://localhost:3000/health

# Redis check
redis-cli ping   # → PONG

# PostgreSQL check
psql postgresql://hyperlocal_user:hyperlocal_pass@localhost:5432/hyperlocal -c "\dt"
```
