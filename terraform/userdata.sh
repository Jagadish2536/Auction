#!/usr/bin/env bash
# ============================================================
# JV Cricket Auction - EC2 Bootstrap (Terraform userdata)
# Installs Docker, clones repo, configures env, starts app
# ============================================================
set -e
exec > >(tee /var/log/userdata.log) 2>&1

echo "🚀 Starting JV Cricket Auction setup..."
export DEBIAN_FRONTEND=noninteractive

# ── System Updates ──────────────────────────────────
apt-get update -y
apt-get upgrade -y

# ── Install Docker ──────────────────────────────────
apt-get install -y ca-certificates curl gnupg git
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
usermod -aG docker ubuntu

# ── Install Certbot ─────────────────────────────────
apt-get install -y certbot

# ── Clone Project ───────────────────────────────────
mkdir -p /var/www
cd /var/www
git clone https://github.com/Jagadish2536/Auction.git jv-cricket-auction
cd jv-cricket-auction

# ── Create self-signed SSL (replaced by Let's Encrypt later) ──
mkdir -p nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout nginx/ssl/privkey.pem \
    -out nginx/ssl/fullchain.pem \
    -subj "/CN=${domain_name}"

# ── Write production .env ───────────────────────────
cat > .env <<EOF
DB_PASSWORD=${db_password}
SECRET_KEY=${app_secret}
JWT_SECRET_KEY=${jwt_secret}
FRONTEND_URL=https://${domain_name}
NEXT_PUBLIC_API_URL=https://${domain_name}
MANAGER_EMAIL=${manager_email}
MANAGER_PASSWORD=${manager_password}
AWS_S3_BUCKET=${s3_bucket}
AWS_REGION=${aws_region}
EOF

# ── Set ownership ───────────────────────────────────
chown -R ubuntu:ubuntu /var/www/jv-cricket-auction

# ── Start application ──────────────────────────────
sudo -u ubuntu docker compose -f docker-compose.prod.yml up -d --build

echo "============================================"
echo "✅ JV Cricket Auction deployed!"
echo "   Domain: https://${domain_name}"
echo "   S3 Bucket: ${s3_bucket}"
echo ""
echo "   For real SSL, run as ubuntu:"
echo "   docker compose -f docker-compose.prod.yml stop nginx"
echo "   sudo certbot certonly --standalone -d ${domain_name} -d www.${domain_name}"
echo "   sudo cp /etc/letsencrypt/live/${domain_name}/fullchain.pem nginx/ssl/"
echo "   sudo cp /etc/letsencrypt/live/${domain_name}/privkey.pem nginx/ssl/"
echo "   docker compose -f docker-compose.prod.yml up -d nginx"
echo "============================================"
