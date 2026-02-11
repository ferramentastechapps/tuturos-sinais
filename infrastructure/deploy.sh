#!/bin/bash
# ═══════════════════════════════════════════
# Deploy Script — Build & restart services
# Run from project root: bash infrastructure/deploy.sh
# ═══════════════════════════════════════════

set -e

PROJECT_DIR="/var/www/signal-dashboard"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

echo "═══════════════════════════════════"
echo "  Signal Engine — Deploy"
echo "═══════════════════════════════════"

# ──── Pull latest code ────
echo "📥 Pulling latest code..."
cd "$PROJECT_DIR"
git pull origin main

# ──── Backend Build ────
echo ""
echo "🔧 Building Backend..."
cd "$BACKEND_DIR"
npm ci --production=false
npm run build

# ──── Frontend Build ────
echo ""
echo "🎨 Building Frontend..."
cd "$FRONTEND_DIR"
npm ci
npm run build

# Copy build to serving directory
if [ -d "$FRONTEND_DIR/dist" ]; then
    echo "   Frontend build ready"
fi

# ──── Nginx Config ────
echo ""
echo "🌐 Updating Nginx..."
cp "$PROJECT_DIR/infrastructure/nginx.conf" /etc/nginx/sites-available/signal-dashboard
ln -sf /etc/nginx/sites-available/signal-dashboard /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
echo "   Nginx reloaded"

# ──── PM2 Deploy ────
echo ""
echo "🚀 Restarting services..."
cd "$BACKEND_DIR"

if pm2 describe signal-engine > /dev/null 2>&1; then
    pm2 reload ecosystem.config.cjs --env production
    echo "   Services reloaded"
else
    pm2 start ecosystem.config.cjs --env production
    echo "   Services started"
fi

pm2 save

# ──── Health Check ────
echo ""
echo "🔍 Health check..."
sleep 3
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
    echo "   ✅ API responding (HTTP $HTTP_STATUS)"
else
    echo "   ⚠️ API returned HTTP $HTTP_STATUS"
    echo "   Check logs: pm2 logs signal-engine --lines 50"
fi

# ──── Done ────
echo ""
echo "═══════════════════════════════════"
echo "  ✅ Deploy Complete!"
echo "═══════════════════════════════════"
echo ""
echo "Verify:"
echo "  pm2 status"
echo "  pm2 logs signal-engine --lines 20"
echo "  curl http://localhost:3001/api/health"
echo ""
