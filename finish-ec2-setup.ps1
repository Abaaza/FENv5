# Finish EC2 Setup
param([string]$IP = "13.218.146.247")

Write-Host "Finishing EC2 Setup" -ForegroundColor Green
Write-Host "==================" -ForegroundColor Green

# Find key
$key = Get-ChildItem -Path . -Filter "*.pem" | Select-Object -First 1
if (!$key) {
    Write-Host "No .pem key found!" -ForegroundColor Red
    exit
}

Write-Host "Using key: $($key.Name)" -ForegroundColor Yellow
Write-Host "Target: $IP" -ForegroundColor Yellow

Write-Host "`nConnecting to EC2 to complete Node.js setup..." -ForegroundColor Cyan

# Run commands directly via SSH
$commands = @"
echo 'Installing Node.js...'
sudo amazon-linux-extras install -y nodejs
node --version
npm --version
sudo npm install -g pm2
cd /home/ec2-user/app
npm install --production
cd backend && npm install && npm run build && cd ..
pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u ec2-user --hp /home/ec2-user
sudo tee /etc/nginx/conf.d/boq.conf > /dev/null <<'NGINX'
server {
    listen 80;
    server_name _;
    client_max_body_size 50M;
    location / {
        root /home/ec2-user/app/frontend/dist;
        try_files \$uri \$uri/ /index.html;
    }
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_read_timeout 300s;
    }
}
NGINX
sudo nginx -t && sudo systemctl restart nginx
echo 'Setup complete!'
echo "App URL: http://\$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"
"@

# Execute commands
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" $commands

Write-Host "`n✅ Setup completed!" -ForegroundColor Green
Write-Host "`n⚠️  Don't forget to:" -ForegroundColor Yellow
Write-Host "1. SSH in: ssh -i $($key.Name) ec2-user@$IP" -ForegroundColor Cyan
Write-Host "2. Edit config: nano /home/ec2-user/app/.env" -ForegroundColor Cyan
Write-Host "3. Add your Convex URL and keys" -ForegroundColor Cyan
Write-Host "4. Restart: pm2 restart all" -ForegroundColor Cyan