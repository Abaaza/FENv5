#!/bin/bash

EC2_IP="54.90.3.22"
KEY_FILE="./tfp-boq-key.pem"

echo "🚀 Deploying to EC2 at $EC2_IP"

# Clean up old deployment files
rm -rf deploy-package deploy-package.tar.gz 2>/dev/null

# Create deployment package
echo "📦 Creating deployment package..."
mkdir -p deploy-package

# Copy backend
echo "Copying backend..."
cp -r backend deploy-package/
cp package.json deploy-package/ 2>/dev/null
cp package-lock.json deploy-package/ 2>/dev/null

# Copy frontend dist
echo "Copying frontend build..."
mkdir -p deploy-package/frontend
cp -r frontend/dist deploy-package/frontend/

# Copy convex
echo "Copying Convex files..."
cp -r convex deploy-package/

# Create .env template
cat > deploy-package/.env << 'EOF'
# Backend Configuration
NODE_ENV=production
PORT=5000

# Database (Convex)
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
    name: 'boq-backend',
    script: './backend/dist/server.js',
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
echo "Setting up application..."
cd /home/ec2-user/app

# Create logs directory
mkdir -p logs

# Install dependencies
echo "Installing dependencies..."
npm install --production --no-optional

# Build backend
cd backend
echo "Building backend..."
npm install --no-optional
npm run build
cd ..

# Stop existing PM2 processes
pm2 delete all 2>/dev/null || true

# Start with PM2
echo "Starting application with PM2..."
pm2 start ecosystem.config.js
pm2 save

echo "✅ Setup complete!"
echo "Application running on port 5000"
EOF

chmod +x deploy-package/setup.sh

# Create tarball
echo "📦 Creating archive..."
tar -czf deploy-package.tar.gz deploy-package/

# Upload to EC2
echo "⬆️ Uploading to EC2..."
scp -o StrictHostKeyChecking=no -i "$KEY_FILE" deploy-package.tar.gz "ec2-user@$EC2_IP:/home/ec2-user/"

# Deploy on EC2
echo "🚀 Deploying on EC2..."
ssh -o StrictHostKeyChecking=no -i "$KEY_FILE" "ec2-user@$EC2_IP" << 'REMOTE_COMMANDS'
cd /home/ec2-user

# Backup old version
rm -rf app-backup
mv app app-backup 2>/dev/null || true

# Extract new version
tar -xzf deploy-package.tar.gz
mv deploy-package app
rm deploy-package.tar.gz

# Run setup
cd app
chmod +x setup.sh
./setup.sh

# Check status
pm2 status
REMOTE_COMMANDS

# Cleanup local files
rm -rf deploy-package deploy-package.tar.gz

echo "✅ Deployment complete!"
echo "📍 Application URL: https://$EC2_IP"
echo ""
echo "To check logs: ssh -i $KEY_FILE ec2-user@$EC2_IP 'pm2 logs boq-backend'"