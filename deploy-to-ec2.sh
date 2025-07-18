#!/bin/bash

# Deploy application to EC2 instance
# Usage: ./deploy-to-ec2.sh <EC2_PUBLIC_IP>

set -e

if [ -z "$1" ]; then
    echo "Usage: ./deploy-to-ec2.sh <EC2_PUBLIC_IP>"
    echo "Example: ./deploy-to-ec2.sh 54.123.45.67"
    exit 1
fi

EC2_IP=$1
KEY_FILE="boq-matching-key.pem"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if key file exists
if [ ! -f "$KEY_FILE" ]; then
    print_warning "Key file $KEY_FILE not found. Looking for any .pem file..."
    KEY_FILE=$(ls *.pem 2>/dev/null | head -n 1)
    if [ -z "$KEY_FILE" ]; then
        echo "Error: No .pem key file found in current directory"
        exit 1
    fi
    print_status "Using key file: $KEY_FILE"
fi

print_status "🚀 Deploying BOQ Matching System to EC2"
print_status "Target: ec2-user@$EC2_IP"

# Wait for instance setup to complete
print_status "Checking if instance setup is complete..."
while ! ssh -o StrictHostKeyChecking=no -i "$KEY_FILE" ec2-user@$EC2_IP "test -f /home/ec2-user/setup-complete" 2>/dev/null; do
    echo -n "."
    sleep 10
done
echo ""
print_status "Instance setup complete!"

# Create deployment package
print_status "Creating deployment package..."
rm -rf deploy-package
mkdir -p deploy-package

# Copy backend files
print_status "Copying backend files..."
cp -r backend deploy-package/
cp package.json deploy-package/
cp package-lock.json deploy-package/ 2>/dev/null || true

# Copy frontend build (if exists)
if [ -d "frontend/dist" ]; then
    print_status "Copying frontend build..."
    mkdir -p deploy-package/frontend
    cp -r frontend/dist deploy-package/frontend/
else
    print_warning "Frontend build not found. Run 'cd frontend && npm run build' first"
fi

# Copy convex files
print_status "Copying Convex files..."
cp -r convex deploy-package/

# Create .env file template
cat > deploy-package/.env << 'EOF'
# Backend Configuration
NODE_ENV=production
PORT=5000

# Database (Convex)
CONVEX_URL=${CONVEX_URL}
CONVEX_DEPLOY_KEY=${CONVEX_DEPLOY_KEY}

# JWT Secrets
JWT_SECRET=${JWT_SECRET}
JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}

# AWS (optional, for file storage)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
S3_BUCKET_NAME=mjd-boq-uploads-prod

# CORS
CORS_ORIGIN=*
EOF

# Create PM2 ecosystem file
cat > deploy-package/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'boq-matching-backend',
    script: './backend/dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=4096'
  }]
};
EOF

# Create nginx configuration
cat > deploy-package/nginx.conf << 'EOF'
server {
    listen 80;
    server_name _;
    
    # Increase timeouts for large file processing
    proxy_connect_timeout 600;
    proxy_send_timeout 600;
    proxy_read_timeout 600;
    send_timeout 600;
    client_max_body_size 100M;
    
    # Frontend
    location / {
        root /home/ec2-user/app/frontend/dist;
        try_files $uri $uri/ /index.html;
    }
    
    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Increase timeouts
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
    }
}
EOF

# Create deployment script for EC2
cat > deploy-package/setup-on-ec2.sh << 'EOF'
#!/bin/bash
set -e

echo "Setting up BOQ Matching System..."

# Create logs directory
mkdir -p /home/ec2-user/app/logs

# Install dependencies
cd /home/ec2-user/app
echo "Installing dependencies..."
npm install --production

# Build backend
cd backend
echo "Building backend..."
npm install
npm run build
cd ..

# Setup PM2
echo "Setting up PM2..."
pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u ec2-user --hp /home/ec2-user

# Setup nginx
echo "Configuring nginx..."
sudo cp nginx.conf /etc/nginx/conf.d/boq-matching.conf
sudo nginx -t
sudo systemctl restart nginx

echo "✅ Setup complete!"
echo "Application is running at http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"
EOF

chmod +x deploy-package/setup-on-ec2.sh

# Create tarball
print_status "Creating deployment archive..."
tar -czf deploy-package.tar.gz deploy-package/

# Upload to EC2
print_status "Uploading to EC2..."
scp -o StrictHostKeyChecking=no -i "$KEY_FILE" deploy-package.tar.gz ec2-user@$EC2_IP:/home/ec2-user/

# Deploy on EC2
print_status "Deploying on EC2..."
ssh -o StrictHostKeyChecking=no -i "$KEY_FILE" ec2-user@$EC2_IP << 'ENDSSH'
set -e

# Extract package
cd /home/ec2-user
rm -rf app-old
mv app app-old 2>/dev/null || true
tar -xzf deploy-package.tar.gz
mv deploy-package app
rm deploy-package.tar.gz

# Make sure .env exists
if [ ! -f app/.env ]; then
    echo "⚠️  Please configure /home/ec2-user/app/.env with your environment variables"
fi

# Run setup
cd app
chmod +x setup-on-ec2.sh
./setup-on-ec2.sh

ENDSSH

# Cleanup
rm -rf deploy-package deploy-package.tar.gz

print_status "✅ Deployment complete!"
print_status "Your application is available at:"
print_status "http://$EC2_IP"
print_status ""
print_status "⚠️  IMPORTANT: Configure environment variables:"
print_status "1. SSH into the server: ssh -i $KEY_FILE ec2-user@$EC2_IP"
print_status "2. Edit the .env file: nano /home/ec2-user/app/.env"
print_status "3. Add your Convex credentials and JWT secrets"
print_status "4. Restart the app: pm2 restart all"
print_status ""
print_status "To view logs: pm2 logs"
print_status "To monitor: pm2 monit"