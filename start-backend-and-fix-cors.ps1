$sshKey = "C:\Users\abaza\OneDrive\Desktop\MJDv9\boq-matching-system\boq-key-202507161911.pem"

Write-Host "Finding backend files..." -ForegroundColor Yellow
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 @'
echo "Looking for backend server files:"
find /home/ec2-user/app -name "server.js" -o -name "server.ts" 2>/dev/null | grep -E "(dist|src)" | head -10
'@

Write-Host "`nStarting backend server..." -ForegroundColor Yellow
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 @'
# Kill any process on port 5000
sudo lsof -ti:5000 | xargs -r sudo kill -9 2>/dev/null

# Start backend
cd /home/ec2-user/app/backend
if [ -f "dist/server.js" ]; then
    echo "Starting compiled server..."
    pm2 delete all 2>/dev/null
    pm2 start dist/server.js --name boq-server
    pm2 logs boq-server --lines 5 --nostream
elif [ -f "src/server.ts" ]; then
    echo "Starting TypeScript server..."
    pm2 delete all 2>/dev/null
    npm run build 2>/dev/null || npx tsc 2>/dev/null || echo "Build failed, trying direct start"
    if [ -f "dist/server.js" ]; then
        pm2 start dist/server.js --name boq-server
    else
        # Try running TS directly
        pm2 start npm --name boq-server -- start
    fi
else
    echo "Server files not found!"
    ls -la
fi

sleep 3
pm2 list
echo ""
echo "Checking port 5000:"
sudo lsof -i :5000 || echo "Still nothing on port 5000"
'@

Write-Host "`nFixing nginx configuration..." -ForegroundColor Yellow
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 @'
# Create clean nginx config
sudo tee /etc/nginx/conf.d/boq-app.conf > /dev/null << 'EOFNGINX'
server {
    listen 443 ssl;
    server_name _;
    
    ssl_certificate /etc/pki/tls/certs/nginx.crt;
    ssl_certificate_key /etc/pki/tls/private/nginx.key;
    
    # CORS configuration
    location / {
        # Simple CORS headers  
        add_header Access-Control-Allow-Origin https://main.d3j084kic0l1ff.amplifyapp.com always;
        add_header Access-Control-Allow-Credentials true always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Authorization,Content-Type,Accept,Origin,User-Agent,DNT,Cache-Control,X-Mx-ReqToken,Keep-Alive,X-Requested-With,If-Modified-Since" always;
        
        # OPTIONS handling
        if ($request_method = OPTIONS) {
            return 204;
        }
        
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
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
EOFNGINX

# Remove old configs
sudo rm -f /etc/nginx/conf.d/app.conf /etc/nginx/conf.d/ssl.conf /etc/nginx/conf.d/cors*.conf

# Test and reload
sudo nginx -t && sudo systemctl reload nginx
'@

Write-Host "`nTesting the setup..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 @'
echo "Testing health endpoint:"
curl -s https://localhost/api/health -k | head -20

echo -e "\n\nTesting CORS on OPTIONS:"
curl -I -X OPTIONS https://localhost/api/auth/login \
  -H "Origin: https://main.d3j084kic0l1ff.amplifyapp.com" \
  -H "Access-Control-Request-Method: POST" \
  -k 2>&1 | grep -i "access-control"
'@

Write-Host "`nSetup complete! Try logging in at: https://main.d3j084kic0l1ff.amplifyapp.com/login" -ForegroundColor Green