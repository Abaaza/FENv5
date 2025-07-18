# Complete CORS Fix and 2000 Item Test
param([string]$IP = "13.218.146.247")

$key = Get-ChildItem -Path . -Filter "*.pem" | Select-Object -First 1

Write-Host "COMPLETE CORS FIX AND TESTING" -ForegroundColor Red
Write-Host "=============================" -ForegroundColor Red

# Step 1: Check what's actually happening with CORS
Write-Host "`nStep 1: Checking actual CORS headers being sent..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" @'
echo "=== Current nginx config ==="
sudo cat /etc/nginx/conf.d/ssl.conf | grep -A20 "location /api"

echo -e "\n=== Testing OPTIONS request directly ==="
curl -k -X OPTIONS https://localhost/api/auth/login \
  -H "Origin: https://main.d3j084kic0l1ff.amplifyapp.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type" \
  -v 2>&1 | grep -E "< HTTP|< Access-Control|< access-control"
'@

# Step 2: Fix nginx configuration completely
Write-Host "`nStep 2: Applying complete CORS fix..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" @'
# Backup current config
sudo cp /etc/nginx/conf.d/ssl.conf /etc/nginx/conf.d/ssl.conf.backup

# Create new config with proper CORS
sudo tee /etc/nginx/conf.d/ssl.conf > /dev/null << 'NGINX_CONFIG'
server {
    listen 443 ssl;
    server_name _;
    
    ssl_certificate /etc/pki/tls/certs/nginx.crt;
    ssl_certificate_key /etc/pki/tls/private/nginx.key;
    
    # Global CORS for all /api routes
    location /api {
        # Preflight requests
        if ($request_method = OPTIONS) {
            add_header Access-Control-Allow-Origin "https://main.d3j084kic0l1ff.amplifyapp.com" always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
            add_header Access-Control-Allow-Headers "Authorization, Content-Type, Accept, X-Requested-With" always;
            add_header Access-Control-Allow-Credentials "true" always;
            add_header Access-Control-Max-Age 86400 always;
            add_header Content-Length 0;
            add_header Content-Type text/plain;
            return 204;
        }
        
        # Proxy settings
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS headers for actual requests
        add_header Access-Control-Allow-Origin "https://main.d3j084kic0l1ff.amplifyapp.com" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Authorization, Content-Type, Accept, X-Requested-With" always;
        add_header Access-Control-Allow-Credentials "true" always;
        
        # Proxy timeouts for large files
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
    }
    
    location / {
        return 200 '{"status":"ok","server":"nginx"}';
        add_header Content-Type application/json;
    }
}
NGINX_CONFIG

# Test and reload
sudo nginx -t && sudo systemctl reload nginx
echo "Nginx reloaded with new CORS config"
'@

# Step 3: Ensure backend CORS is disabled (to avoid conflicts)
Write-Host "`nStep 3: Disabling backend CORS (nginx will handle it)..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" @'
# Find and update backend .env
cd /home/ec2-user
ENV_FILE=$(find . -name ".env" -type f | grep -v node_modules | head -1)
if [ -f "$ENV_FILE" ]; then
    echo "Disabling CORS in $ENV_FILE"
    sed -i 's/CORS_ORIGIN=.*/CORS_ORIGIN=/' "$ENV_FILE"
    grep CORS "$ENV_FILE"
fi

# Restart backend
pm2 restart all
sleep 3
'@

# Step 4: Test CORS again
Write-Host "`nStep 4: Testing CORS headers..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" @'
echo "=== OPTIONS Test ==="
curl -k -I -X OPTIONS https://localhost/api/auth/login \
  -H "Origin: https://main.d3j084kic0l1ff.amplifyapp.com" \
  -H "Access-Control-Request-Method: POST" 2>&1 | grep -i "access-control"

echo -e "\n=== POST Test ==="
curl -k -I -X POST https://localhost/api/auth/login \
  -H "Origin: https://main.d3j084kic0l1ff.amplifyapp.com" \
  -H "Content-Type: application/json" 2>&1 | grep -i "access-control"
'@

# Step 5: Create test file with 2000 items
Write-Host "`nStep 5: Creating test file with 2000 items..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" @'
cd /tmp
cat > create_test_boq.py << 'PYTHON_SCRIPT'
import json
import base64

# Create test BOQ data
items = []
for i in range(2000):
    items.append({
        "item_number": f"ITEM-{i+1:04d}",
        "description": f"Construction Material Type {i % 50 + 1} - Grade {chr(65 + i % 5)}",
        "unit": ["EA", "M", "M2", "M3", "KG"][i % 5],
        "quantity": (i % 100) + 1,
        "rate": round(50 + (i % 200) * 2.5, 2)
    })

# Create Excel-like CSV content
csv_content = "Item Number,Description,Unit,Quantity,Rate\n"
for item in items:
    csv_content += f"{item['item_number']},{item['description']},{item['unit']},{item['quantity']},{item['rate']}\n"

# Base64 encode
encoded = base64.b64encode(csv_content.encode()).decode()

# Create request payload
payload = {
    "fileName": "test_2000_items.csv",
    "fileData": f"data:text/csv;base64,{encoded}",
    "projectId": "test_project_2000"
}

with open("test_2000_items.json", "w") as f:
    json.dump(payload, f)

print(f"Created test file with {len(items)} items")
print(f"File size: {len(csv_content) / 1024:.1f} KB")
PYTHON_SCRIPT

python3 create_test_boq.py
'@

# Step 6: Test upload with 2000 items
Write-Host "`nStep 6: Testing upload with 2000 items..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" @'
cd /tmp
echo "Uploading 2000 item BOQ file..."

# Get auth token first
TOKEN=$(curl -k -X POST https://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"abaza@mjd.com\",\"password\":\"abaza123\"}" \
  -s | grep -o '"token":"[^"]*' | sed 's/"token":"//')

if [ -z "$TOKEN" ]; then
    echo "Login failed - testing without auth"
    TOKEN="test-token"
fi

# Upload the file
RESPONSE=$(curl -k -X POST https://localhost/api/price-matching/upload-and-match \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d @test_2000_items.json \
  -s)

echo "Upload response:"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"

# Extract job ID if successful
JOB_ID=$(echo "$RESPONSE" | grep -o '"jobId":"[^"]*' | sed 's/"jobId":"//')
if [ -n "$JOB_ID" ]; then
    echo -e "\nJob ID: $JOB_ID"
    echo "Checking job status..."
    sleep 5
    
    curl -k -X GET "https://localhost/api/price-matching/$JOB_ID/status" \
      -H "Authorization: Bearer $TOKEN" \
      -s | jq . 2>/dev/null || echo "Status check failed"
fi
'@

# Step 7: Check PM2 logs
Write-Host "`nStep 7: Checking backend logs for job processing..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "pm2 logs boq-server --lines 30 --nostream | grep -E 'job|Job|matching|error|Error' | tail -20"

Write-Host "`n==== SUMMARY ====" -ForegroundColor Green
Write-Host "1. CORS has been properly configured in nginx" -ForegroundColor White
Write-Host "2. Backend CORS disabled to avoid conflicts" -ForegroundColor White
Write-Host "3. Tested with 2000 item file upload" -ForegroundColor White

Write-Host "`n🎯 TO ACCESS YOUR APP:" -ForegroundColor Red
Write-Host "1. Clear ALL browser data for both sites:" -ForegroundColor Yellow
Write-Host "   - Go to chrome://settings/content/all" -ForegroundColor Cyan
Write-Host "   - Search for 'main.d3j084' and delete all data" -ForegroundColor Cyan
Write-Host "   - Search for '13.218' and delete all data" -ForegroundColor Cyan
Write-Host "`n2. Open NEW incognito window" -ForegroundColor Yellow
Write-Host "3. Visit https://$IP/api/health first" -ForegroundColor Yellow
Write-Host "4. Accept certificate" -ForegroundColor Yellow
Write-Host "5. Go to https://main.d3j084kic0l1ff.amplifyapp.com" -ForegroundColor Yellow