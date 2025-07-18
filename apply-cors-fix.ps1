$sshKey = "C:\Users\abaza\OneDrive\Desktop\MJDv9\boq-matching-system\boq-key-202507161911.pem"

# Create nginx config file locally first
$nginxConfig = @'
server {
    listen 443 ssl;
    server_name _;
    
    ssl_certificate /etc/pki/tls/certs/nginx.crt;
    ssl_certificate_key /etc/pki/tls/private/nginx.key;
    
    location / {
        # Handle preflight
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' 'https://main.d3j084kic0l1ff.amplifyapp.com' always;
            add_header 'Access-Control-Allow-Credentials' 'true' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
            add_header 'Access-Control-Max-Age' '86400' always;
            return 204;
        }
        
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Add CORS headers to responses
        add_header 'Access-Control-Allow-Origin' 'https://main.d3j084kic0l1ff.amplifyapp.com' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
    }
}

server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}
'@

# Save to temp file
$tempFile = [System.IO.Path]::GetTempFileName()
$nginxConfig | Set-Content $tempFile -Encoding UTF8

Write-Host "Uploading nginx configuration..." -ForegroundColor Yellow
& scp -i $sshKey -o StrictHostKeyChecking=no $tempFile ec2-user@13.218.146.247:/tmp/nginx.conf

Write-Host "Applying configuration..." -ForegroundColor Yellow
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 @'
sudo cp /tmp/nginx.conf /etc/nginx/conf.d/app.conf
sudo rm -f /etc/nginx/conf.d/ssl.conf /etc/nginx/conf.d/cors*.conf /etc/nginx/conf.d/working.conf
sudo nginx -t && sudo systemctl restart nginx
'@

Write-Host "`nChecking backend..." -ForegroundColor Yellow
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 @'
# Check if PM2 is running with correct user
ps aux | grep pm2
cd /home/ec2-user/backend
pm2 list || echo "PM2 not running for this user"
# Start backend as ec2-user
pm2 delete all 2>/dev/null || true
pm2 start dist/server.js --name boq-server
pm2 list
'@

Write-Host "`nTesting CORS headers..." -ForegroundColor Yellow  
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 @'
echo "OPTIONS request test:"
curl -I -X OPTIONS https://localhost/api/auth/login -H "Origin: https://main.d3j084kic0l1ff.amplifyapp.com" -k 2>&1 | grep -i "access-control"
echo ""
echo "GET request test:"
curl -I https://localhost/api/health -H "Origin: https://main.d3j084kic0l1ff.amplifyapp.com" -k 2>&1 | grep -i "access-control"
'@

Remove-Item $tempFile

Write-Host "`nDone! Try logging in at: https://main.d3j084kic0l1ff.amplifyapp.com/login" -ForegroundColor Green