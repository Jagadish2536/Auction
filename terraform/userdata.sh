#!/usr/bin/env bash
# Update and install system dependencies
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y git python3-pip python3-venv postgresql postgresql-contrib nginx curl

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Configure PostgreSQL
sudo -u postgres psql -c "CREATE DATABASE auction;"
sudo -u postgres psql -c "CREATE USER postgres WITH PASSWORD '${db_password}';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE auction TO postgres;"

# Clone project and set up
mkdir -p /var/www/jv-cricket-auction
cd /var/www/jv-cricket-auction

# In a real pipeline, the code would be fetched from Git/S3.
# For now, create placeholders and folders
mkdir -p backend frontend uploads/logos uploads/team_logos uploads/players

# Set up backend virtual env
cd backend
python3 -m venv venv
source venv/bin/activate

# Write environment file for production
cat <<EOT > .env
FLASK_ENV=production
FLASK_DEBUG=0
SECRET_KEY=production-secret-key-change-me
JWT_SECRET_KEY=production-jwt-secret-key-change-me
DATABASE_URL=postgresql://postgres:${db_password}@localhost/auction
UPLOAD_FOLDER=/var/www/jv-cricket-auction/uploads
MAX_CONTENT_LENGTH=16777216
FRONTEND_URL=https://${domain_name}
EOT

# Set up systemd service for Gunicorn with Eventlet
cat <<EOT > /etc/systemd/system/auction-backend.service
[Unit]
Description=Gunicorn instance to serve JV Cricket Auction Backend
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/var/www/jv-cricket-auction/backend
ExecStart=/var/www/jv-cricket-auction/backend/venv/bin/gunicorn --worker-class eventlet -w 1 -b 127.0.0.1:5000 app:app
Restart=always

[Install]
WantedBy=multi-user.target
EOT

systemctl start auction-backend
systemctl enable auction-backend

# Set up Nginx config to reverse proxy both Next.js and Flask API/Sockets
cat <<EOT > /etc/nginx/sites-available/jv-cricket
server {
    listen 80;
    server_name ${domain_name} www.${domain_name};

    # Frontend Next.js static and server
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Socket.IO support
    location /socket.io {
        proxy_pass http://127.0.0.1:5000/socket.io;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    # Serve uploaded images directly via Nginx for performance
    location /uploads {
        alias /var/www/jv-cricket-auction/uploads;
        expires 7d;
        add_header Cache-Control "public, no-transform";
    }
}
EOT

ln -s /etc/nginx/sites-available/jv-cricket /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
systemctl restart nginx
