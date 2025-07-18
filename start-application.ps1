# Start Application with PM2
param([string]$IP = "13.218.146.247")

$key = Get-ChildItem -Path . -Filter "*.pem" | Select-Object -First 1
Write-Host "Starting application..." -ForegroundColor Green

# Start application
Write-Host "`nStarting application with PM2..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "cd ~/app && pm2 start ecosystem.config.js"

# Setup PM2 startup
Write-Host "`nSetting up PM2 startup..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "pm2 startup systemd -u ec2-user --hp /home/ec2-user | tail -n 1 | sudo bash"

# Save PM2 configuration
Write-Host "`nSaving PM2 configuration..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "pm2 save"

# Fix nginx configuration
Write-Host "`nFixing nginx configuration..." -ForegroundColor Cyan
$nginxFix = @'
sudo rm -f /etc/nginx/conf.d/boq.conf
cat << 'EOF' | sudo tee /etc/nginx/conf.d/boq.conf
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
sudo nginx -t && sudo systemctl restart nginx
'@

ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" $nginxFix

# Check status
Write-Host "`nChecking application status..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "pm2 status"

# Test API
Write-Host "`nTesting API..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "sleep 5 && curl -s http://localhost:5000/api/health || echo 'API starting up...'"

Write-Host "`n✅ Application started!" -ForegroundColor Green
Write-Host "`nYour application: http://$IP" -ForegroundColor Yellow
Write-Host "`n⚠️  Remember to update .env with Convex credentials!" -ForegroundColor Red