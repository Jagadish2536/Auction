# AWS Production Deployment Guide

This guide describes how to deploy the **JV Cricket Auction Platform** to AWS using the provided Terraform configuration.

## 🏗️ Architecture Overview

The production architecture consists of:
- **AWS VPC:** Default public subnet configurations.
- **AWS Security Groups:** Restricting traffic to SSH (22), HTTP (80), HTTPS (443), and communication ports.
- **AWS EC2 (t3.medium):** Hosts the monolithic Flask API (served via Gunicorn + Eventlet) and Next.js frontend (production build).
- **AWS Elastic IP:** Static public IP assigned to the EC2 server.
- **AWS S3 Bucket:** Stores user uploads (logos, player photos) permanently.
- **AWS Route53:** Configures DNS for `jagadishvarma.xyz` and `www.jagadishvarma.xyz`.
- **AWS ACM:** Issues SSL certificate for secure HTTPS connections.
- **Nginx:** Handles reverse proxying, SSL termination, and static uploads serving.

---

## 🚀 Deployment Steps

### 1. Prerequisites on Deploy Machine
Ensure you have the following installed on your deployment machine:
- **AWS CLI** configured with administrator credentials:
  ```bash
  aws configure
  ```
- **Terraform CLI** installed.

### 2. Configure Terraform Variables
Navigate to the `terraform` folder:
```bash
cd terraform
```
Modify `variables.tf` or create a `terraform.tfvars` file to customize:
- `domain_name` (default: `jagadishvarma.xyz`)
- `aws_region` (default: `ap-south-1`)
- `instance_type` (default: `t3.medium`)
- `key_name` (Name of your existing AWS SSH key pair)
- `db_password` (Secure password for PostgreSQL)

### 3. Initialize and Deploy
Initialize Terraform:
```bash
terraform init
```

Review the deployment plan:
```bash
terraform plan
```

Deploy the infrastructure:
```bash
terraform apply -auto-approve
```

Once deployment completes, Terraform outputs:
- `server_public_ip` (Elastic IP of the instance)
- `route53_dns_record` (domain endpoint)
- `s3_bucket_name` (uploads S3 bucket name)

---

## ⚙️ Server Post-Deployment Config

The provided EC2 `userdata.sh` automatically installs PostgreSQL, Node.js, Python 3, Nginx, and configures them. 

To deploy the code to the server:
1. SSH into the server:
   ```bash
   ssh -i /path/to/key.pem ubuntu@<server_public_ip>
   ```
2. Clone your repository to `/var/www/jv-cricket-auction`.
3. Set up the production builds:
   - **Frontend:**
     ```bash
     cd /var/www/jv-cricket-auction/frontend
     npm install
     npm run build
     # Start with pm2
     npm install -g pm2
     pm2 start npm --name "auction-frontend" -- start
     pm2 save
     pm2 startup
     ```
   - **Backend:**
     ```bash
     cd /var/www/jv-cricket-auction/backend
     python3 -m venv venv
     source venv/bin/activate
     pip install -r requirements.txt
     # Run systemd service
     sudo systemctl enable auction-backend
     sudo systemctl start auction-backend
     ```
4. Certbot SSL Configuration (HTTPS):
   Configure Let's Encrypt certificates using Certbot:
   ```bash
   sudo apt-get install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d jagadishvarma.xyz -d www.jagadishvarma.xyz
   ```

Now, the entire application will be live at `https://jagadishvarma.xyz` with fully configured WebSockets!
