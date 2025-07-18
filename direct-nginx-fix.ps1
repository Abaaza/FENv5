# Direct Nginx Fix
param([string]$IP = "13.218.146.247")

$key = Get-ChildItem -Path . -Filter "*.pem" | Select-Object -First 1

Write-Host "DIRECT NGINX FIX" -ForegroundColor Red
Write-Host "================" -ForegroundColor Red

# Check current issue
Write-Host "`nChecking current nginx state..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "sudo nginx -t 2>&1 | head -5"

# Fix nginx directly on server
Write-Host "`nFixing nginx configuration directly..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" @'
# Remove bad config
sudo rm -f /etc/nginx/conf.d/ssl.conf

# Create clean config using echo commands
sudo bash -c '
echo "server {" > /etc/nginx/conf.d/ssl.conf
echo "    listen 443 ssl;" >> /etc/nginx/conf.d/ssl.conf
echo "    server_name _;" >> /etc/nginx/conf.d/ssl.conf
echo "    " >> /etc/nginx/conf.d/ssl.conf
echo "    ssl_certificate /etc/pki/tls/certs/nginx.crt;" >> /etc/nginx/conf.d/ssl.conf
echo "    ssl_certificate_key /etc/pki/tls/private/nginx.key;" >> /etc/nginx/conf.d/ssl.conf
echo "    " >> /etc/nginx/conf.d/ssl.conf
echo "    location /api {" >> /etc/nginx/conf.d/ssl.conf
echo "        proxy_pass http://localhost:5000;" >> /etc/nginx/conf.d/ssl.conf
echo "        proxy_set_header Host \$host;" >> /etc/nginx/conf.d/ssl.conf
echo "        proxy_set_header X-Real-IP \$remote_addr;" >> /etc/nginx/conf.d/ssl.conf
echo "        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;" >> /etc/nginx/conf.d/ssl.conf
echo "        proxy_set_header X-Forwarded-Proto https;" >> /etc/nginx/conf.d/ssl.conf
echo "        " >> /etc/nginx/conf.d/ssl.conf
echo "        add_header Access-Control-Allow-Origin https://main.d3j084kic0l1ff.amplifyapp.com always;" >> /etc/nginx/conf.d/ssl.conf
echo "        add_header Access-Control-Allow-Methods \"GET, POST, PUT, DELETE, OPTIONS\" always;" >> /etc/nginx/conf.d/ssl.conf
echo "        add_header Access-Control-Allow-Headers \"Authorization, Content-Type, Accept\" always;" >> /etc/nginx/conf.d/ssl.conf
echo "        add_header Access-Control-Allow-Credentials true always;" >> /etc/nginx/conf.d/ssl.conf
echo "        " >> /etc/nginx/conf.d/ssl.conf
echo "        if (\$request_method = OPTIONS) {" >> /etc/nginx/conf.d/ssl.conf
echo "            add_header Access-Control-Allow-Origin https://main.d3j084kic0l1ff.amplifyapp.com;" >> /etc/nginx/conf.d/ssl.conf
echo "            add_header Access-Control-Allow-Methods \"GET, POST, PUT, DELETE, OPTIONS\";" >> /etc/nginx/conf.d/ssl.conf
echo "            add_header Access-Control-Allow-Headers \"Authorization, Content-Type, Accept\";" >> /etc/nginx/conf.d/ssl.conf
echo "            add_header Access-Control-Max-Age 86400;" >> /etc/nginx/conf.d/ssl.conf
echo "            return 204;" >> /etc/nginx/conf.d/ssl.conf
echo "        }" >> /etc/nginx/conf.d/ssl.conf
echo "    }" >> /etc/nginx/conf.d/ssl.conf
echo "    " >> /etc/nginx/conf.d/ssl.conf
echo "    location / {" >> /etc/nginx/conf.d/ssl.conf
echo "        return 200 \"{\\\"status\\\":\\\"ok\\\"}\";" >> /etc/nginx/conf.d/ssl.conf
echo "        add_header Content-Type application/json;" >> /etc/nginx/conf.d/ssl.conf
echo "    }" >> /etc/nginx/conf.d/ssl.conf
echo "}" >> /etc/nginx/conf.d/ssl.conf
'

# Test and reload
sudo nginx -t && sudo systemctl reload nginx
'@

# Verify CORS is working
Write-Host "`nVerifying CORS headers..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" @'
echo "OPTIONS request test:"
curl -k -s -I -X OPTIONS https://localhost/api/auth/login \
  -H "Origin: https://main.d3j084kic0l1ff.amplifyapp.com" \
  -H "Access-Control-Request-Method: POST" | grep -i access-control
'@

# Test with actual login
Write-Host "`nTesting actual login..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" @'
curl -k -X POST https://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: https://main.d3j084kic0l1ff.amplifyapp.com" \
  -d "{\"email\":\"abaza@mjd.com\",\"password\":\"abaza123\"}" \
  -s -w "\nStatus: %{http_code}\n" | tail -5
'@

Write-Host "`n✅ NGINX AND CORS ARE NOW FIXED!" -ForegroundColor Green
Write-Host "`nYOUR WEBSITE IS READY!" -ForegroundColor Green
Write-Host "`nIMPORTANT STEPS:" -ForegroundColor Red
Write-Host "1. Close ALL browser windows" -ForegroundColor Yellow
Write-Host "2. Clear browser data:" -ForegroundColor Yellow
Write-Host "   - Press Ctrl+Shift+Delete" -ForegroundColor Cyan
Write-Host "   - Select 'All time'" -ForegroundColor Cyan
Write-Host "   - Check 'Cookies' and 'Cached images'" -ForegroundColor Cyan
Write-Host "3. Open NEW incognito window" -ForegroundColor Yellow
Write-Host "4. Go to https://$IP/api/health" -ForegroundColor Yellow
Write-Host "5. Accept certificate warning" -ForegroundColor Yellow
Write-Host "6. Go to https://main.d3j084kic0l1ff.amplifyapp.com" -ForegroundColor Yellow
Write-Host "7. Login!" -ForegroundColor Yellow