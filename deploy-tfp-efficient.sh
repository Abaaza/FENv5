#!/bin/bash

EC2_IP="54.90.3.22"
KEY_FILE="./tfp-boq-key.pem"

echo "🚀 Deploying FENv5 to TFP EC2 instance at $EC2_IP"

# Clean up old deployment files
rm -rf deploy-package deploy-package.tar.gz 2>/dev/null

# Create deployment package
echo "📦 Creating deployment package..."
mkdir -p deploy-package

# Copy backend (excluding node_modules and other unnecessary files)
echo "Copying backend source files..."
mkdir -p deploy-package/backend
cp -r backend/src deploy-package/backend/
cp -r backend/dist deploy-package/backend/ 2>/dev/null
cp backend/package.json deploy-package/backend/
cp backend/package-lock.json deploy-package/backend/ 2>/dev/null
cp backend/tsconfig*.json deploy-package/backend/ 2>/dev/null
cp backend/index.js deploy-package/backend/ 2>/dev/null

# Copy root package files if they exist
cp package.json deploy-package/ 2>/dev/null
cp package-lock.json deploy-package/ 2>/dev/null

# Copy frontend dist
echo "Copying frontend build..."
mkdir -p deploy-package/frontend
cp -r frontend/dist deploy-package/frontend/

# Copy convex
echo "Copying Convex files..."
cp -r convex deploy-package/

# Create .env with correct configuration
cat > deploy-package/.env << 'EOF'
# Backend Configuration
NODE_ENV=production
PORT=5000

# Database (Convex) - TFP Instance
CONVEX_URL=https://bright-scorpion-424.convex.cloud
CONVEX_DEPLOY_KEY=prod:giddy-dachshund-854:61dd8bb8c94e582b95f7c43c1f00c951c88e5e96b0f46d3b5f88e6c0c956bb72

# JWT Secrets
JWT_ACCESS_SECRET=tfp-boq-matching-access-secret-key-2025-secure
JWT_REFRESH_SECRET=tfp-boq-matching-refresh-secret-key-2025-secure
JWT_ACCESS_EXPIRY=16h
JWT_REFRESH_EXPIRY=30d

# CORS
CORS_ORIGIN=*
FRONTEND_URL=https://main.d3j084kic0l1ff.amplifyapp.com
EOF

# Create PM2 ecosystem config
cat > deploy-package/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'tfp-backend',
    script: './backend/index.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    max_memory_restart: '700M',
    min_uptime: '10s',
    max_restarts: 10
  }]
};
EOF

# Create setup script
cat > deploy-package/setup.sh << 'EOF'
#!/bin/bash
echo "Setting up TFP BOQ application..."
cd /home/ec2-user/app

# Create logs directory
mkdir -p logs

# Install backend dependencies
cd backend
echo "Installing backend dependencies..."
npm install --production --no-optional

# Build backend if dist doesn't exist
if [ ! -d "dist" ]; then
  echo "Building backend..."
  npm install --no-optional
  npm run build
fi
cd ..

# Install root dependencies if package.json exists
if [ -f "package.json" ]; then
  echo "Installing root dependencies..."
  npm install --production --no-optional
fi

# Stop existing PM2 processes
pm2 delete tfp-backend 2>/dev/null || true
pm2 delete all 2>/dev/null || true

# Start with PM2
echo "Starting application with PM2..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u ec2-user --hp /home/ec2-user || true

# Configure Nginx if needed
if [ -f "/etc/nginx/nginx.conf" ]; then
  echo "Nginx is already configured"
else
  echo "Nginx not found, app will run on port 5000"
fi

echo "✅ Setup complete!"
echo "Application running on port 5000"
pm2 status
EOF

chmod +x deploy-package/setup.sh

# Create tarball (excluding large files)
echo "📦 Creating archive..."
tar -czf deploy-package.tar.gz deploy-package/

# Show package size
echo "Package size: $(du -h deploy-package.tar.gz | cut -f1)"

# Upload to EC2
echo "⬆️ Uploading to EC2..."
scp -o StrictHostKeyChecking=no -i "$KEY_FILE" deploy-package.tar.gz "ec2-user@$EC2_IP:/home/ec2-user/"

# Deploy on EC2
echo "🚀 Deploying on EC2..."
ssh -o StrictHostKeyChecking=no -i "$KEY_FILE" "ec2-user@$EC2_IP" << 'REMOTE_COMMANDS'
cd /home/ec2-user

# Backup old version
echo "Backing up old version..."
rm -rf app-backup
mv app app-backup 2>/dev/null || true

# Extract new version
echo "Extracting new version..."
tar -xzf deploy-package.tar.gz
mv deploy-package app
rm deploy-package.tar.gz

# Run setup
cd app
chmod +x setup.sh
./setup.sh

# Test the application
echo ""
echo "Testing application health..."
sleep 3
curl -s http://localhost:5000/api/health || echo "Health check endpoint not responding yet"

echo ""
echo "Checking PM2 logs..."
pm2 logs tfp-backend --nostream --lines 5
REMOTE_COMMANDS

# Cleanup local files
rm -rf deploy-package deploy-package.tar.gz

echo ""
echo "✅ Deployment complete!"
echo "📍 Application URL: https://$EC2_IP"
echo ""
echo "📝 Quick commands:"
echo "  SSH: ssh -i $KEY_FILE ec2-user@$EC2_IP"
echo "  Logs: ssh -i $KEY_FILE ec2-user@$EC2_IP 'pm2 logs tfp-backend'"
echo "  Status: ssh -i $KEY_FILE ec2-user@$EC2_IP 'pm2 status'"
echo "  Restart: ssh -i $KEY_FILE ec2-user@$EC2_IP 'pm2 restart tfp-backend'"