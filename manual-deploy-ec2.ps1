# Manual EC2 Deployment - Skip setup check
param(
    [Parameter(Mandatory=$true)]
    [string]$IP
)

Write-Host "📦 Manual EC2 Deployment" -ForegroundColor Green
Write-Host "========================" -ForegroundColor Green

# Find key file
$keyFile = Get-ChildItem -Path . -Filter "*.pem" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (!$keyFile) {
    Write-Host "❌ No .pem key file found!" -ForegroundColor Red
    exit 1
}

Write-Host "Using key: $($keyFile.Name)" -ForegroundColor Green
Write-Host "Target IP: $IP" -ForegroundColor Green

# Create deployment package
Write-Host "`nCreating deployment package..." -ForegroundColor Cyan
if (Test-Path "deploy-package") {
    Remove-Item -Path "deploy-package" -Recurse -Force
}
New-Item -ItemType Directory -Path "deploy-package" | Out-Null

# Copy files
Copy-Item -Path "backend" -Destination "deploy-package\" -Recurse
Copy-Item -Path "package.json" -Destination "deploy-package\"
if (Test-Path "package-lock.json") {
    Copy-Item -Path "package-lock.json" -Destination "deploy-package\"
}

if (Test-Path "frontend\dist") {
    New-Item -ItemType Directory -Path "deploy-package\frontend" -Force | Out-Null
    Copy-Item -Path "frontend\dist" -Destination "deploy-package\frontend\" -Recurse
}

Copy-Item -Path "convex" -Destination "deploy-package\" -Recurse

# Create config files
@'
NODE_ENV=production
PORT=5000
CONVEX_URL=YOUR_CONVEX_URL_HERE
CONVEX_DEPLOY_KEY=YOUR_CONVEX_DEPLOY_KEY_HERE
JWT_SECRET=change_this_to_random_string_123
JWT_ACCESS_SECRET=change_this_to_random_string_456
JWT_REFRESH_SECRET=change_this_to_random_string_789
CORS_ORIGIN=*
'@ | Out-File -FilePath "deploy-package\.env" -Encoding UTF8

@'
module.exports = {
  apps: [{
    name: 'boq-backend',
    script: './backend/dist/server.js',
    instances: 1,
    env: {
      NODE_ENV: 'production',
      PORT: 5000,
      NODE_OPTIONS: '--max-old-space-size=768'
    },
    max_memory_restart: '700M'
  }]
};
'@ | Out-File -FilePath "deploy-package\ecosystem.config.js" -Encoding UTF8

# Create simple setup script
@'
#!/bin/bash
cd /home/ec2-user/app
npm install --production --no-optional
cd backend
npm install --no-optional
npm run build
cd ..
pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
sudo systemctl restart nginx || true
echo "Setup complete!"
'@ | Out-File -FilePath "deploy-package\setup.sh" -Encoding ASCII -NoNewline

# Create tarball
Write-Host "Creating archive..." -ForegroundColor Cyan
tar -czf deploy.tar.gz deploy-package/

# Upload
Write-Host "`nUploading to EC2 (this may take a minute)..." -ForegroundColor Cyan
scp -o StrictHostKeyChecking=no -o ConnectTimeout=30 -i $keyFile.Name deploy.tar.gz "ec2-user@${IP}:~/"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Upload successful!" -ForegroundColor Green
    
    # Deploy
    Write-Host "`nDeploying application..." -ForegroundColor Cyan
    
    $deployScript = @"
echo 'Starting deployment...'
cd ~
rm -rf app
tar -xzf deploy.tar.gz
mv deploy-package app
cd app
chmod +x setup.sh
./setup.sh
echo 'Deployment complete!'
echo 'Your app is at: http://$IP'
"@
    
    $deployScript | ssh -o StrictHostKeyChecking=no -i $keyFile.Name "ec2-user@$IP" "bash -s"
    
    # Cleanup
    Remove-Item "deploy.tar.gz" -Force
    Remove-Item "deploy-package" -Recurse -Force
    
    Write-Host "`n✅ DEPLOYMENT COMPLETE!" -ForegroundColor Green
    Write-Host "================================" -ForegroundColor Green
    Write-Host "Your app: http://$IP" -ForegroundColor Yellow
    Write-Host "`n⚠️  IMPORTANT: Edit .env file with your credentials!" -ForegroundColor Yellow
    Write-Host "SSH command: ssh -i $($keyFile.Name) ec2-user@$IP" -ForegroundColor Cyan
    Write-Host "Edit .env: nano /home/ec2-user/app/.env" -ForegroundColor Cyan
    Write-Host "Restart: pm2 restart all" -ForegroundColor Cyan
    
} else {
    Write-Host "❌ Upload failed!" -ForegroundColor Red
    Write-Host "Try again in a few minutes - instance may still be starting" -ForegroundColor Yellow
}