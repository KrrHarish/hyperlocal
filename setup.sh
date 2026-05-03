#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Zuqu — One-shot setup script
# Run once after cloning:  bash setup.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC}  $1"; }
success() { echo -e "${GREEN}[OK]${NC}    $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
step()    { echo -e "\n${BOLD}▶ $1${NC}"; }

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}   Zuqu Hyperlocal Delivery Platform — Setup${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

ROOT=$(pwd)

# ─── 1. Check required tools ─────────────────────────────────────────────────
step "Checking required tools"

check_cmd() {
  if ! command -v "$1" &>/dev/null; then
    error "$1 is not installed. $2"
  fi
  success "$1 found ($(command -v $1))"
}

check_cmd node   "Install from https://nodejs.org (v20+ required)"
check_cmd npm    "Comes with Node.js"
check_cmd psql   "Install PostgreSQL: https://www.postgresql.org/download/"
check_cmd redis-cli "Install Redis: brew install redis (macOS) or https://redis.io"

NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 20 ]; then
  error "Node.js v20+ required. You have $(node -v). Use nvm: nvm install 20"
fi
success "Node.js version OK ($(node -v))"

# Check pnpm
if ! command -v pnpm &>/dev/null; then
  info "pnpm not found — installing..."
  npm install -g pnpm
fi
success "pnpm found"

# ─── 2. Check services ────────────────────────────────────────────────────────
step "Checking services"

if ! pg_isready -q 2>/dev/null; then
  warn "PostgreSQL does not appear to be running."
  warn "Start it: brew services start postgresql (macOS) or sudo systemctl start postgresql"
  warn "Continuing anyway — you can start it before running the API."
else
  success "PostgreSQL is running"
fi

if ! redis-cli ping &>/dev/null; then
  warn "Redis does not appear to be running."
  warn "Start it: brew services start redis (macOS) or sudo systemctl start redis"
  warn "Continuing anyway — you can start it before running the API."
else
  success "Redis is running"
fi

# ─── 3. Install dependencies ─────────────────────────────────────────────────
step "Installing dependencies (pnpm install)"
cd "$ROOT"
pnpm install
success "All workspace dependencies installed"

# ─── 4. Set up environment files ─────────────────────────────────────────────
step "Setting up environment files"

# API
if [ ! -f "$ROOT/apps/api/.env" ]; then
  info "Creating apps/api/.env from template..."
  cp "$ROOT/apps/api/.env.example" "$ROOT/apps/api/.env" 2>/dev/null || cat > "$ROOT/apps/api/.env" <<'EOF'
PORT=3000
DATABASE_URL=postgresql://hyperlocal_user:hyperlocal_pass@localhost:5432/hyperlocal
REDIS_URL=redis://localhost:6379
JWT_SECRET=change_this_to_a_random_secret
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
EOF
  warn "apps/api/.env created — fill in VAPID keys (see README for how to generate)"
else
  success "apps/api/.env already exists"
fi

# Shop portal
if [ ! -f "$ROOT/apps/shop-portal/.env" ]; then
  info "Creating apps/shop-portal/.env from template..."
  cat > "$ROOT/apps/shop-portal/.env" <<'EOF'
VITE_VAPID_PUBLIC_KEY=
EOF
  warn "apps/shop-portal/.env created — fill in VITE_VAPID_PUBLIC_KEY (same as API VAPID_PUBLIC_KEY)"
else
  success "apps/shop-portal/.env already exists"
fi

# ─── 5. Set up PostgreSQL database ───────────────────────────────────────────
step "Setting up PostgreSQL database"

DB_URL=$(grep DATABASE_URL "$ROOT/apps/api/.env" | cut -d= -f2-)
DB_NAME=$(echo "$DB_URL" | sed 's|.*\/||' | cut -d? -f1)
DB_USER=$(echo "$DB_URL" | sed 's|postgresql://||' | cut -d: -f1)
DB_PASS=$(echo "$DB_URL" | sed 's|.*://[^:]*:||' | cut -d@ -f1)

info "Database: $DB_NAME  User: $DB_USER"

# Create user and database if they don't exist
if pg_isready -q 2>/dev/null; then
  psql postgres -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 || \
    psql postgres -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" && \
    success "DB user '$DB_USER' ready"

  psql postgres -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || \
    psql postgres -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" && \
    success "Database '$DB_NAME' ready"

  # Grant privileges
  psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" &>/dev/null

  # Run migrations
  info "Running migrations..."
  cd "$ROOT/apps/api"
  npx tsx src/shared/db/migrate.ts && success "Migrations complete"
  cd "$ROOT"
else
  warn "PostgreSQL not running — skipping DB setup. Run migrations manually after starting PostgreSQL:"
  warn "  cd apps/api && npx tsx src/shared/db/migrate.ts"
fi

# ─── 6. Generate VAPID keys (if missing) ─────────────────────────────────────
step "Checking VAPID keys for web push notifications"

VAPID_PUB=$(grep VAPID_PUBLIC_KEY "$ROOT/apps/api/.env" | cut -d= -f2-)
if [ -z "$VAPID_PUB" ]; then
  info "No VAPID keys found — generating..."
  cd "$ROOT/apps/api"
  KEYS=$(node -e "
    const webpush = require('web-push');
    const keys = webpush.generateVAPIDKeys();
    console.log(keys.publicKey + '|' + keys.privateKey);
  " 2>/dev/null || echo "")

  if [ -n "$KEYS" ]; then
    PUB=$(echo "$KEYS" | cut -d'|' -f1)
    PRIV=$(echo "$KEYS" | cut -d'|' -f2)
    # Update .env files
    sed -i.bak "s|VAPID_PUBLIC_KEY=.*|VAPID_PUBLIC_KEY=$PUB|" "$ROOT/apps/api/.env"
    sed -i.bak "s|VAPID_PRIVATE_KEY=.*|VAPID_PRIVATE_KEY=$PRIV|" "$ROOT/apps/api/.env"
    sed -i.bak "s|VITE_VAPID_PUBLIC_KEY=.*|VITE_VAPID_PUBLIC_KEY=$PUB|" "$ROOT/apps/shop-portal/.env"
    rm -f "$ROOT/apps/api/.env.bak" "$ROOT/apps/shop-portal/.env.bak"
    success "VAPID keys generated and saved"
  else
    warn "Could not auto-generate VAPID keys (web-push might not be installed yet)"
    warn "Generate manually: cd apps/api && node -e \"const wp=require('web-push'); console.log(wp.generateVAPIDKeys())\""
    warn "Then copy keys into apps/api/.env and apps/shop-portal/.env"
  fi
  cd "$ROOT"
else
  success "VAPID keys already set"
fi

# ─── 7. iOS Simulator GPS (macOS only) ───────────────────────────────────────
if [[ "$OSTYPE" == "darwin"* ]]; then
  step "iOS Simulator GPS"
  info "The iOS simulator defaults to San Francisco coordinates."
  info "Set it to your city so riders appear near shops:"
  echo ""
  echo -e "  ${CYAN}xcrun simctl location booted set <lat>,<lng>${NC}"
  echo ""
  echo "  Example (Bangalore): xcrun simctl location booted set 12.9352,77.6245"
  echo "  Example (Mumbai):    xcrun simctl location booted set 19.0760,72.8777"
  echo "  Example (Delhi):     xcrun simctl location booted set 28.6139,77.2090"
  echo ""
  warn "Run this AFTER launching the simulator, BEFORE going online in the rider app."
fi

# ─── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}${BOLD}   Setup complete!${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Start all services (open 4 terminal tabs):"
echo ""
echo -e "  ${CYAN}Tab 1 — API${NC}"
echo "    cd apps/api && npm run dev"
echo ""
echo -e "  ${CYAN}Tab 2 — Shop Portal${NC}"
echo "    cd apps/shop-portal && npm run dev"
echo "    Open http://localhost:5174"
echo ""
echo -e "  ${CYAN}Tab 3 — Customer App${NC}"
echo "    cd apps/customer-app && npx expo run:ios"
echo ""
echo -e "  ${CYAN}Tab 4 — Rider App${NC}"
echo "    xcrun simctl location booted set 12.9352,77.6245"
echo "    cd apps/rider-app && npx expo run:ios"
echo ""
echo "See README.md for full documentation."
echo ""
