# Complete Application Setup
param([string]$IP = "13.218.146.247")

$key = Get-ChildItem -Path . -Filter "*.pem" | Select-Object -First 1
Write-Host "Completing application setup..." -ForegroundColor Green

# Step 1: Install PM2
Write-Host "`nStep 1: Installing PM2..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "sudo npm install -g pm2"

# Step 2: Install app dependencies
Write-Host "`nStep 2: Installing app dependencies..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "cd ~/app && npm install --production"

# Step 3: Build backend
Write-Host "`nStep 3: Building backend..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "cd ~/app/backend && npm install && npm run build"

# Step 4: Start with PM2
Write-Host "`nStep 4: Starting application with PM2..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "cd ~/app && pm2 delete all 2>/dev/null; pm2 start ecosystem.config.js && pm2 save"

# Step 5: Setup PM2 startup
Write-Host "`nStep 5: Setting up PM2 startup..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "sudo env PATH=`$PATH:/usr/bin pm2 startup systemd -u ec2-user --hp /home/ec2-user"

# Step 6: Configure nginx
Write-Host "`nStep 6: Configuring nginx..." -ForegroundColor Cyan
$nginxConfig = @'
cat > /tmp/boq.conf << 'NGINX_EOF'
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
NGINX_EOF
sudo cp /tmp/boq.conf /etc/nginx/conf.d/
sudo nginx -t && sudo systemctl restart nginx
'@

ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" $nginxConfig

# Step 7: Check status
Write-Host "`nStep 7: Checking application status..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "pm2 status && echo '---' && curl -s http://localhost:5000/api/health || echo 'API not responding yet'"

Write-Host "`n✅ Application setup complete!" -ForegroundColor Green
Write-Host "`nYour application is available at:" -ForegroundColor Yellow
Write-Host "http://$IP" -ForegroundColor Cyan
Write-Host "`n⚠️  IMPORTANT: Update your .env file with Convex credentials!" -ForegroundColor Red
Write-Host "ssh -i $($key.Name) ec2-user@$IP" -ForegroundColor Yellow
Write-Host "nano /home/ec2-user/app/.env" -ForegroundColor Yellow