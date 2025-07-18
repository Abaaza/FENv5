# Install Node.js Properly on EC2
param([string]$IP = "13.218.146.247")

$key = Get-ChildItem -Path . -Filter "*.pem" | Select-Object -First 1
Write-Host "Installing Node.js on EC2..." -ForegroundColor Green

# Install Node.js step by step
Write-Host "`nStep 1: Installing Node.js from Amazon Linux extras..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "sudo amazon-linux-extras list | grep -i node"

Write-Host "`nInstalling nodejs..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "sudo yum install -y nodejs npm"

Write-Host "`nStep 2: Verifying installation..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "node --version && npm --version"

Write-Host "`nStep 3: Installing PM2..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "sudo npm install -g pm2"

Write-Host "`nStep 4: Setting up application..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "cd ~/app && npm install --production"

Write-Host "`nStep 5: Building backend..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "cd ~/app/backend && npm install && npm run build"

Write-Host "`nStep 6: Starting with PM2..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "cd ~/app && pm2 start ecosystem.config.js && pm2 save"

Write-Host "`nStep 7: Configuring nginx..." -ForegroundColor Cyan
$nginxConfig = @'
sudo tee /etc/nginx/conf.d/boq.conf > /dev/null <<EOF
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
EOF
'@

ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" $nginxConfig

Write-Host "`nRestarting nginx..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "sudo nginx -t && sudo systemctl restart nginx"

Write-Host "`nChecking app status..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "pm2 status"

Write-Host "`n✅ Setup complete!" -ForegroundColor Green
Write-Host "Your app: http://$IP" -ForegroundColor Yellow
Write-Host "`nREMEMBER TO UPDATE .env FILE!" -ForegroundColor Red