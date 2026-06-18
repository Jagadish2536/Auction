# AWS Production Deployment Guide

This guide describes how to deploy the **JV Cricket Auction Platform** to AWS using Terraform + Docker + GitHub Actions.

## 🏗️ Architecture Overview

```
Internet → Nginx (SSL/WebSocket) → Flask Backend (Gunicorn+Eventlet) → PostgreSQL
                                  → Next.js Frontend (Standalone)     → Redis
                                                                      → S3 (Images)
```

| Component | Service | Purpose |
|-----------|---------|---------|
| **EC2** (t3.medium) | Docker host | Runs all containers |
| **S3** | Image storage | Player photos, team logos, sponsor logos |
| **PostgreSQL 16** | Docker container | Application database |
| **Redis 7** | Docker container | Socket.IO message queue |
| **Nginx** | Docker container | Reverse proxy, SSL, WebSocket |
| **Route53** | DNS | jagadishvarma.xyz |
| **ACM** | SSL certificate | HTTPS |

**Region**: `ap-south-2` (Hyderabad)

---

## 🚀 Deployment Steps

### Step 1: Prerequisites

```bash
# Install AWS CLI and Terraform
aws configure   # Set your AWS credentials
terraform -v    # Verify Terraform is installed
```

### Step 2: Create SSH Key Pair

```bash
aws ec2 create-key-pair \
  --region ap-south-2 \
  --key-name jv-cricket-key \
  --query 'KeyMaterial' \
  --output text > jv-cricket-key.pem

chmod 400 jv-cricket-key.pem
```

### Step 3: Deploy Infrastructure with Terraform

```bash
cd terraform

# Create terraform.tfvars with your secrets
cat > terraform.tfvars <<EOF
db_password      = "your-strong-db-password"
app_secret       = "$(openssl rand -hex 32)"
jwt_secret       = "$(openssl rand -hex 32)"
manager_email    = "jagadishvarma99@gmail.com"
manager_password = "your-manager-password"
key_name         = "jv-cricket-key"
EOF

# Deploy
terraform init
terraform plan
terraform apply
```

Terraform will:
1. Create Security Group (ports 22, 80, 443)
2. Create S3 bucket with public read + CORS
3. Create IAM role for EC2 → S3 access
4. Launch EC2 instance (t3.medium, 30GB gp3)
5. Assign Elastic IP
6. Configure Route53 DNS records
7. Request ACM SSL certificate
8. Run userdata.sh (installs Docker, clones repo, starts app)

### Step 4: Set Up SSL (Let's Encrypt)

After Terraform completes and DNS propagates:

```bash
# SSH into EC2
ssh -i jv-cricket-key.pem ubuntu@<EC2_IP>

# Stop nginx temporarily
cd /var/www/jv-cricket-auction
docker compose -f docker-compose.prod.yml stop nginx

# Get real SSL cert
sudo certbot certonly --standalone \
  -d jagadishvarma.xyz \
  -d www.jagadishvarma.xyz

# Copy certs
sudo cp /etc/letsencrypt/live/jagadishvarma.xyz/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/jagadishvarma.xyz/privkey.pem nginx/ssl/

# Restart nginx
docker compose -f docker-compose.prod.yml up -d nginx
```

### Step 5: Set Up GitHub Actions CI/CD

Go to **GitHub → Repo → Settings → Secrets and variables → Actions** and add:

| Secret | Value |
|--------|-------|
| `EC2_HOST` | EC2 Elastic IP (from `terraform output`) |
| `SSH_PRIVATE_KEY` | Contents of `jv-cricket-key.pem` |
| `DB_PASSWORD` | Same as terraform.tfvars |
| `SECRET_KEY` | Random 64-char hex string |
| `JWT_SECRET_KEY` | Random 64-char hex string |
| `FRONTEND_URL` | `https://jagadishvarma.xyz` |
| `NEXT_PUBLIC_API_URL` | `https://jagadishvarma.xyz` |
| `MANAGER_EMAIL` | `jagadishvarma99@gmail.com` |
| `MANAGER_PASSWORD` | Your manager password |
| `AWS_S3_BUCKET` | `jv-cricket-auction-uploads` (from `terraform output`) |
| `AWS_ACCESS_KEY_ID` | Your AWS access key |
| `AWS_SECRET_ACCESS_KEY` | Your AWS secret key |

Now every push to `main` will auto-deploy via GitHub Actions.

---

## 📁 S3 Image Upload Flow

```
User uploads photo → Flask Backend → boto3 → S3 Bucket
                                           → Returns full S3 URL
                                           → Stored in DB as https://bucket.s3.ap-south-2.amazonaws.com/...
Frontend displays → Detects https:// prefix → Uses S3 URL directly (no proxy)
```

In development (no S3 configured), images are saved locally to `uploads/` directory.

---

## 🔧 Terraform Outputs

```bash
terraform output
# server_public_ip    = "x.x.x.x"
# route53_dns_record  = "jagadishvarma.xyz"
# s3_bucket_name      = "jv-cricket-auction-uploads"
# s3_bucket_url       = "https://jv-cricket-auction-uploads.s3.ap-south-2.amazonaws.com"
# ssh_command          = "ssh -i jv-cricket-key.pem ubuntu@x.x.x.x"
```

## 🔄 Manual Redeployment

```bash
ssh -i jv-cricket-key.pem ubuntu@<EC2_IP>
cd /var/www/jv-cricket-auction
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
```
