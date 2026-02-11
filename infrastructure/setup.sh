#!/bin/bash
# ═══════════════════════════════════════════
# VPS Initial Setup Script — Ubuntu 24.04
# Run as root: sudo bash setup.sh
# ═══════════════════════════════════════════

set -e

echo "═══════════════════════════════════"
echo "  Signal Engine — VPS Setup"
echo "═══════════════════════════════════"

# ──── System Update ────
echo "📦 Updating system..."
apt update && apt upgrade -y

# ──── Install Node.js 20 ────
echo "📦 Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

echo "   Node: $(node --version)"
echo "   npm: $(npm --version)"

# ──── Install PM2 ────
echo "📦 Installing PM2..."
npm install -g pm2

# ──── Install Nginx ────
echo "📦 Installing Nginx..."
apt install -y nginx

# ──── Install Certbot ────
echo "📦 Installing Certbot..."
apt install -y certbot python3-certbot-nginx

# ──── Install Git ────
apt install -y git

# ──── Create project directory ────
echo "📂 Creating project directory..."
mkdir -p /var/www/signal-dashboard/backend
mkdir -p /var/www/signal-dashboard/frontend
mkdir -p /var/www/signal-dashboard/logs

# ──── Firewall ────
echo "🔒 Configuring firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# ──── Swap (for 2GB RAM VPS) ────
echo "💾 Creating swap..."
if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "   Swap created: 2GB"
else
    echo "   Swap already exists"
fi

# ──── PM2 startup ────
echo "⚙️  Configuring PM2 startup..."
pm2 startup systemd -u root --hp /root
pm2 save

# ──── Summary ────
echo ""
echo "═══════════════════════════════════"
echo "  ✅ Setup Complete!"
echo "═══════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Clone/upload your code to /var/www/signal-dashboard/"
echo "  2. Copy .env.example to .env and fill in values"
echo "  3. Run deploy.sh"
echo "  4. Configure SSL: sudo certbot --nginx -d your-domain.com"
echo ""
