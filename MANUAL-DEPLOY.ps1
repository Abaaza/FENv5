# Manual EC2 Deployment Script for The Fencing People
# This script deploys step by step to avoid syntax issues

$EC2_IP = "54.90.3.22"
$PEM_FILE = "C:\Users\abaza\Downloads\tfp-boq-key.pem"
$AMPLIFY_URL = "https://main.d2devufp71564t.amplifyapp.com"

Clear-Host
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "     THE FENCING PEOPLE - MANUAL EC2 DEPLOYMENT" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

Write-Host "`nDeployment Configuration:" -ForegroundColor Yellow
Write-Host "EC2 IP: $EC2_IP" -ForegroundColor White
Write-Host "PEM File: $PEM_FILE" -ForegroundColor White
Write-Host "Amplify URL: $AMPLIFY_URL" -ForegroundColor White

# Test SSH connection
Write-Host "`n[STEP 1] Testing SSH connection..." -ForegroundColor Yellow
$testSSH = ssh -o BatchMode=yes -o ConnectTimeout=5 -i $PEM_FILE ec2-user@$EC2_IP "echo 'Connected'" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] SSH connection successful!" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Cannot connect to EC2. Please check your connection." -ForegroundColor Red
    exit 1
}

Write-Host "`n[STEP 2] Installing Node.js and dependencies..." -ForegroundColor Yellow
ssh -i $PEM_FILE ec2-user@$EC2_IP @'
# Update system
sudo yum update -y

# Install Node.js 18
curl -sL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo yum install -y nginx

# Create app directory
mkdir -p /home/ec2-user/app/backend

echo "[OK] Dependencies installed!"
'@

Write-Host "`n[STEP 3] Creating backend .env file..." -ForegroundColor Yellow
$envContent = @"
# Database
CONVEX_URL=https://bright-scorpion-424.convex.cloud

# JWT Configuration
JWT_ACCESS_SECRET=tfp-boq-matching-access-secret-key-2025-secure
JWT_REFRESH_SECRET=tfp-boq-matching-refresh-secret-key-2025-secure
JWT_ACCESS_EXPIRY=16h
JWT_REFRESH_EXPIRY=30d

# API Keys (update these with your actual keys)
V2_API_KEY=your-v2-api-key
V1_API_KEY=your-v1-api-key

# Server Configuration
PORT=5000
NODE_ENV=production
FRONTEND_URL=$AMPLIFY_URL
CORS_ORIGIN=$AMPLIFY_URL
COOKIE_SECURE=true
"@

# Save env content to temp file and upload
$envContent | Out-File -FilePath "$env:TEMP\backend.env" -Encoding UTF8
scp -i $PEM_FILE "$env:TEMP\backend.env" ec2-user@${EC2_IP}:/home/ec2-user/app/backend/.env
Remove-Item "$env:TEMP\backend.env"

Write-Host "[OK] Backend .env file created!" -ForegroundColor Green

Write-Host "`n[STEP 4] Creating package.json files..." -ForegroundColor Yellow

# Create backend package.json
$backendPackageJson = @'
{
  "name": "tfp-backend",
  "version": "1.0.0",
  "description": "The Fencing People BOQ Backend",
  "main": "dist/server.js",
  "scripts": {
    "start": "node dist/server.js",
    "build": "tsc",
    "dev": "tsx watch src/server.ts"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "multer": "^1.4.5-lts.1",
    "xlsx": "^0.18.5",
    "zod": "^3.22.4",
    "cross-fetch": "^4.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/multer": "^1.4.11",
    "@types/bcryptjs": "^2.4.6",
    "@types/jsonwebtoken": "^9.0.5",
    "typescript": "^5.3.2",
    "tsx": "^4.6.2"
  }
}
'@

$backendPackageJson | Out-File -FilePath "$env:TEMP\package.json" -Encoding UTF8
scp -i $PEM_FILE "$env:TEMP\package.json" ec2-user@${EC2_IP}:/home/ec2-user/app/backend/package.json
Remove-Item "$env:TEMP\package.json"

Write-Host "[OK] Package files created!" -ForegroundColor Green

Write-Host "`n[STEP 5] Uploading backend code..." -ForegroundColor Yellow

# Create a temporary deployment package
$tempDir = "$env:TEMP\tfp-backend-deploy"
if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
New-Item -ItemType Directory -Path $tempDir | Out-Null

# Copy backend files
Write-Host "Copying backend files..." -ForegroundColor Gray
Copy-Item -Path ".\backend\*" -Destination $tempDir -Recurse -Force -Exclude @("node_modules", ".env", "dist", "*.log")

# Create deployment zip
$zipPath = "$env:TEMP\tfp-backend.zip"
Compress-Archive -Path "$tempDir\*" -DestinationPath $zipPath -Force

# Upload to EC2
Write-Host "Uploading to EC2..." -ForegroundColor Gray
scp -i $PEM_FILE $zipPath ec2-user@${EC2_IP}:/home/ec2-user/app/backend.zip

# Extract on EC2
ssh -i $PEM_FILE ec2-user@$EC2_IP @'
cd /home/ec2-user/app/backend
unzip -o backend.zip
rm backend.zip
npm install --production
echo "[OK] Backend code uploaded!"
'@

# Cleanup
Remove-Item $tempDir -Recurse -Force
Remove-Item $zipPath

Write-Host "`n[STEP 6] Setting up Nginx..." -ForegroundColor Yellow

# Create Nginx config
$nginxConfig = @"
server {
    listen 80;
    listen 443 ssl;
    server_name $EC2_IP;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
"@

$nginxConfig | Out-File -FilePath "$env:TEMP\nginx.conf" -Encoding UTF8
scp -i $PEM_FILE "$env:TEMP\nginx.conf" ec2-user@${EC2_IP}:/home/ec2-user/nginx.conf
Remove-Item "$env:TEMP\nginx.conf"

# Setup Nginx on EC2
ssh -i $PEM_FILE ec2-user@$EC2_IP @'
# Create SSL directory
sudo mkdir -p /etc/nginx/ssl

# Generate self-signed certificate
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/key.pem \
    -out /etc/nginx/ssl/cert.pem \
    -subj "/C=US/ST=State/L=City/O=TheFencingPeople/CN=tfp-backend"

# Copy nginx config
sudo cp /home/ec2-user/nginx.conf /etc/nginx/conf.d/tfp.conf
sudo rm -f /etc/nginx/conf.d/default.conf

# Start Nginx
sudo systemctl enable nginx
sudo systemctl restart nginx

echo "[OK] Nginx configured!"
'@

Write-Host "`n[STEP 7] Starting backend with PM2..." -ForegroundColor Yellow

ssh -i $PEM_FILE ec2-user@$EC2_IP @'
cd /home/ec2-user/app/backend

# Build TypeScript (if needed)
if [ -f "tsconfig.json" ]; then
    npm install typescript -g
    npm run build
fi

# Start with PM2
pm2 delete tfp-backend 2>/dev/null || true
pm2 start dist/server.js --name tfp-backend
pm2 save
pm2 startup | grep sudo | bash

echo "[OK] Backend started with PM2!"
'@

Write-Host "`n========================================================" -ForegroundColor Green
Write-Host "     DEPLOYMENT COMPLETED!" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Your backend is now running at:" -ForegroundColor Cyan
Write-Host ">>> https://$EC2_IP/api" -ForegroundColor White
Write-Host ""
Write-Host "[NEXT STEPS]:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Update Amplify environment variable:" -ForegroundColor White
Write-Host "   VITE_API_URL = https://$EC2_IP/api" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Test the backend:" -ForegroundColor White
Write-Host "   curl -k https://$EC2_IP/api/health" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Monitor logs:" -ForegroundColor White
Write-Host "   ssh -i `"$PEM_FILE`" ec2-user@$EC2_IP 'pm2 logs tfp-backend'" -ForegroundColor Gray

Write-Host "`nPress any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")