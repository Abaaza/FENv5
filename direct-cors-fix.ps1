$sshKey = "C:\Users\abaza\OneDrive\Desktop\MJDv9\boq-matching-system\boq-key-202507161911.pem"

Write-Host "Applying CORS fix directly..." -ForegroundColor Yellow

# Fix nginx configuration
Write-Host "1. Updating nginx configuration..." -ForegroundColor Cyan
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 @'
sudo bash -c "cat > /etc/nginx/conf.d/app.conf" << 'EOF'
server {
    listen 443 ssl;
    server_name _;
    
    ssl_certificate /etc/pki/tls/certs/nginx.crt;
    ssl_certificate_key /etc/pki/tls/private/nginx.key;
    
    location / {
        add_header Access-Control-Allow-Origin https://main.d3j084kic0l1ff.amplifyapp.com always;
        add_header Access-Control-Allow-Credentials true always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
        
        if ($request_method = OPTIONS) {
            add_header Access-Control-Allow-Origin https://main.d3j084kic0l1ff.amplifyapp.com always;
            add_header Access-Control-Allow-Credentials true always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
            add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
            add_header Access-Control-Max-Age 86400;
            add_header Content-Length 0;
            add_header Content-Type text/plain;
            return 204;
        }
        
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}
EOF
'@

# Remove old configs and reload nginx
Write-Host "2. Cleaning old configs and reloading nginx..." -ForegroundColor Cyan
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 "sudo rm -f /etc/nginx/conf.d/ssl.conf /etc/nginx/conf.d/cors*.conf /etc/nginx/conf.d/working.conf && sudo nginx -t && sudo systemctl reload nginx"

# Start backend
Write-Host "3. Starting backend server..." -ForegroundColor Cyan
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 @'
cd /home/ec2-user/app/backend
pm2 delete all 2>/dev/null || true
pm2 start dist/server.js --name boq-server
pm2 save
pm2 list
'@

# Test CORS
Write-Host "`n4. Testing CORS headers..." -ForegroundColor Cyan
Start-Sleep -Seconds 3

& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 @'
echo "Testing OPTIONS request:"
curl -s -I -X OPTIONS https://localhost/api/auth/login -H "Origin: https://main.d3j084kic0l1ff.amplifyapp.com" -H "Access-Control-Request-Method: POST" -k | grep -i access-control
echo ""
echo "Testing GET request:"
curl -s -I https://localhost/api/health -H "Origin: https://main.d3j084kic0l1ff.amplifyapp.com" -k | grep -i access-control
'@

Write-Host "`nDone! CORS should now be working." -ForegroundColor Green
Write-Host "Try logging in at: https://main.d3j084kic0l1ff.amplifyapp.com/login" -ForegroundColor Green