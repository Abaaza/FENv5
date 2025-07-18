# Complete EC2 Setup Script
param([string]$IP = "13.218.146.247")

Write-Host "Complete EC2 Setup" -ForegroundColor Green
Write-Host "==================" -ForegroundColor Green

# Find key
$key = Get-ChildItem -Path . -Filter "*.pem" | Select-Object -First 1
if (!$key) {
    Write-Host "No .pem key found!" -ForegroundColor Red
    exit
}

Write-Host "Using key: $($key.Name)" -ForegroundColor Yellow
Write-Host "Target: $IP" -ForegroundColor Yellow

# Create setup commands
$setupCommands = @'
#!/bin/bash
echo "Installing Node.js using Amazon Linux extras..."

# Clean up any previous attempts
sudo rm -f /etc/yum.repos.d/nodesource*.repo
sudo yum clean all

# Install Node.js 16 from Amazon Linux extras (compatible with glibc 2.26)
sudo amazon-linux-extras install -y nodejs

# Verify installation
node_version=$(node --version 2>/dev/null)
npm_version=$(npm --version 2>/dev/null)

if [ -z "$node_version" ]; then
    echo "Node.js installation failed, trying alternative method..."
    
    # Alternative: Install from EPEL
    sudo yum install -y epel-release
    sudo yum install -y nodejs npm
    
    node_version=$(node --version 2>/dev/null)
    npm_version=$(npm --version 2>/dev/null)
fi

echo "Node.js version: $node_version"
echo "npm version: $npm_version"

# Install PM2 globally
echo "Installing PM2..."
sudo npm install -g pm2

# Install nginx if not already installed
if ! command -v nginx &> /dev/null; then
    echo "Installing nginx..."
    sudo amazon-linux-extras install -y nginx1
    sudo systemctl enable nginx
    sudo systemctl start nginx
fi

# Setup application
echo "Setting up application..."
cd /home/ec2-user/app

# Install dependencies
echo "Installing root dependencies..."
npm install --production

# Build backend
echo "Building backend..."
cd backend
npm install
npm run build
cd ..

# Configure PM2
echo "Starting application with PM2..."
pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u ec2-user --hp /home/ec2-user

# Configure nginx
echo "Configuring nginx..."
sudo tee /etc/nginx/conf.d/boq.conf > /dev/null <<'EOF'
server {
    listen 80;
    server_name _;
    
    client_max_body_size 50M;
    
    location / {
        root /home/ec2-user/app/frontend/dist;
        try_files $uri $uri/ /index.html;
    }
    
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
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
EOF

# Test and restart nginx
sudo nginx -t && sudo systemctl restart nginx

# Get public IP
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)

echo ""
echo "========================================="
echo "✅ Setup complete!"
echo "========================================="
echo ""
echo "Application URL: http://$PUBLIC_IP"
echo ""
echo "⚠️  IMPORTANT NEXT STEPS:"
echo "1. Edit the .env file:"
echo "   nano /home/ec2-user/app/.env"
echo ""
echo "2. Add your Convex credentials"
echo ""
echo "3. Restart the application:"
echo "   pm2 restart all"
echo ""
echo "To view logs: pm2 logs"
echo "To check status: pm2 status"
'@

# Save setup script to file
$setupCommands | Out-File -FilePath "setup-node.sh" -Encoding ASCII -NoNewline

Write-Host "`nUploading setup script..." -ForegroundColor Cyan
scp -o StrictHostKeyChecking=no -i $key.Name setup-node.sh "ec2-user@${IP}:~/"

if ($LASTEXITCODE -eq 0) {
    Write-Host "Running setup on server..." -ForegroundColor Cyan
    
    # Make executable and run
    ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "chmod +x setup-node.sh && ./setup-node.sh"
    
    Write-Host "`n✅ Setup script executed!" -ForegroundColor Green
    Write-Host "`nYour application should now be accessible at:" -ForegroundColor Yellow
    Write-Host "http://$IP" -ForegroundColor Cyan
    
    Write-Host "`n📝 Remember to configure your Convex credentials!" -ForegroundColor Yellow
    Write-Host "SSH back in and edit the .env file:" -ForegroundColor White
    Write-Host "ssh -i $($key.Name) ec2-user@$IP" -ForegroundColor Cyan
    Write-Host "nano /home/ec2-user/app/.env" -ForegroundColor Cyan
    
    # Cleanup
    Remove-Item "setup-node.sh" -Force
} else {
    Write-Host "Failed to upload setup script!" -ForegroundColor Red
}
}