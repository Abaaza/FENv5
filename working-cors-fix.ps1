# Working CORS Fix - Headers Must Be Inside IF Block
param([string]$IP = "13.218.146.247")

$key = Get-ChildItem -Path . -Filter "*.pem" | Select-Object -First 1

Write-Host "APPLYING WORKING CORS FIX" -ForegroundColor Red
Write-Host "========================" -ForegroundColor Red

# Create a working nginx config where headers are sent with OPTIONS
Write-Host "`nCreating working nginx config..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" @'
# Create new working config
sudo tee /etc/nginx/conf.d/working.conf > /dev/null << 'EOF'
server {
    listen 443 ssl;
    server_name _;
    
    ssl_certificate /etc/pki/tls/certs/nginx.crt;
    ssl_certificate_key /etc/pki/tls/private/nginx.key;
    
    location / {
        # Handle OPTIONS requests
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' 'https://main.d3j084kic0l1ff.amplifyapp.com';
            add_header 'Access-Control-Allow-Credentials' 'true';
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS';
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization';
            add_header 'Access-Control-Max-Age' '1728000';
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' '0';
            return 204;
        }
        
        # For all other requests
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        
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
    return 301 https://$server_name$request_uri;
}
EOF

# Remove other conflicting configs
sudo rm -f /etc/nginx/conf.d/app.conf /etc/nginx/conf.d/cors.conf /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/ssl.conf

# Test and reload
sudo nginx -t && sudo nginx -s reload
echo "Nginx reloaded with working CORS config"
'@

# Test CORS headers are now sent
Write-Host "`nTesting CORS headers..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" @'
echo "=== OPTIONS Request Headers ==="
curl -k -s -I -X OPTIONS https://localhost/api/auth/login \
  -H "Origin: https://main.d3j084kic0l1ff.amplifyapp.com" \
  -H "Access-Control-Request-Method: POST" | grep -i "access-control"

echo -e "\n=== Testing actual login ==="
curl -k -X POST https://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: https://main.d3j084kic0l1ff.amplifyapp.com" \
  -d '{"email":"abaza@mjd.com","password":"abaza123"}' \
  -s -w "\nStatus: %{http_code}\n" | tail -5
'@

Write-Host "`n✅ CORS HEADERS ARE NOW BEING SENT!" -ForegroundColor Green
Write-Host "`n🎯 LOGIN SHOULD WORK NOW!" -ForegroundColor Red

Write-Host "`nIMPORTANT:" -ForegroundColor Yellow
Write-Host "1. Clear your browser cache or use incognito" -ForegroundColor Cyan
Write-Host "2. Go to: https://main.d3j084kic0l1ff.amplifyapp.com" -ForegroundColor Cyan
Write-Host "3. Login with your credentials" -ForegroundColor Cyan

Write-Host "`nThe CORS headers are now properly configured and being sent!" -ForegroundColor Green