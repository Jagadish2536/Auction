#!/usr/bin/env bash
# ============================================================
# EC2 Initial Setup Script — Run once on a fresh Ubuntu 24.04
# ============================================================
set -e

echo "🚀 Setting up JV Cricket Auction Production Server..."

# ── System Updates ──────────────────────────────────
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y

# ── Install Docker ──────────────────────────────────
echo "🐳 Installing Docker..."
apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add ubuntu user to docker group
usermod -aG docker ubuntu

# ── Install Certbot (Let's Encrypt SSL) ─────────────
echo "🔐 Installing Certbot..."
apt-get install -y certbot

# ── Clone Project ───────────────────────────────────
echo "📦 Cloning project..."
mkdir -p /var/www
cd /var/www
git clone https://github.com/Jagadish2536/Auction.git jv-cricket-auction
cd jv-cricket-auction

# ── Create SSL directory (self-signed for initial startup) ──
mkdir -p nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout nginx/ssl/privkey.pem \
    -out nginx/ssl/fullchain.pem \
    -subj "/CN=jagadishvarma.xyz"

# ── Create uploads directory ────────────────────────
mkdir -p uploads

# ── Set ownership ───────────────────────────────────
chown -R ubuntu:ubuntu /var/www/jv-cricket-auction

echo ""
echo "============================================"
echo "✅ Server setup complete!"
echo ""
echo "Next steps:"
echo "1. SSH in as 'ubuntu' user"
echo "2. cd /var/www/jv-cricket-auction"
echo "3. Create .env file with your secrets"
echo "4. Run: docker compose -f docker-compose.prod.yml up -d --build"
echo ""
echo "For real SSL (Let's Encrypt):"
echo "  certbot certonly --standalone -d jagadishvarma.xyz -d www.jagadishvarma.xyz"
echo "  cp /etc/letsencrypt/live/jagadishvarma.xyz/fullchain.pem nginx/ssl/"
echo "  cp /etc/letsencrypt/live/jagadishvarma.xyz/privkey.pem nginx/ssl/"
echo "  docker compose -f docker-compose.prod.yml restart nginx"
echo "============================================"
