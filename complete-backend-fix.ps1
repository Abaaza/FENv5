# Complete Backend Fix
param([string]$IP = "13.218.146.247")

$key = Get-ChildItem -Path . -Filter "*.pem" | Select-Object -First 1

Write-Host "Complete Backend Fix" -ForegroundColor Green
Write-Host "===================" -ForegroundColor Green

# Fix the backend fetch issue and test
Write-Host "`nFixing backend and testing..." -ForegroundColor Cyan

# Create a fix script on the server
$fixScript = @'
#!/bin/bash
echo "=== Fixing Backend ==="

# Navigate to backend directory
cd /home/ec2-user/app/backend || cd /home/ec2-user/boq-matching-system/backend || exit 1

# Install node-fetch
echo "Installing node-fetch..."
npm install node-fetch@2

# Create a proper polyfill file
echo "Creating fetch polyfill..."
cat > dist/fetch-polyfill.js << 'EOF'
const fetch = require('node-fetch');
if (!global.fetch) {
  global.fetch = fetch;
  global.Headers = fetch.Headers;
  global.Request = fetch.Request;
  global.Response = fetch.Response;
}
EOF

# Update server.js to include polyfill
echo "Updating server.js..."
if ! grep -q "fetch-polyfill" dist/server.js; then
  sed -i '1s/^/require(".\/fetch-polyfill");\n/' dist/server.js
fi

# Restart backend
echo "Restarting backend..."
pm2 restart boq-server

# Wait for startup
sleep 3

# Test the endpoints
echo -e "\n=== Testing Health Endpoint ==="
curl -k https://localhost/api/health -s | jq . || curl -k https://localhost/api/health -s

echo -e "\n=== Testing Login Endpoint ==="
curl -k -X POST https://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"abaza@mjd.com","password":"abaza123"}' \
  -s | jq . || curl -k -X POST https://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"abaza@mjd.com","password":"abaza123"}' -s

echo -e "\n=== Checking Logs ==="
pm2 logs boq-server --lines 10 --nostream | grep -E "error|Error|ERROR" || echo "No errors found"

echo -e "\n=== Done ==="
'@

# Upload and run the fix script
Write-Host "`nUploading fix script..." -ForegroundColor Cyan
$fixScript | ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "cat > /tmp/fix-backend.sh && chmod +x /tmp/fix-backend.sh && /tmp/fix-backend.sh"

Write-Host "`n✅ Backend fix complete!" -ForegroundColor Green
Write-Host "`nIMPORTANT - Final steps:" -ForegroundColor Yellow
Write-Host "`n1. Open a new browser tab" -ForegroundColor Cyan
Write-Host "2. Go to: https://$IP/api/health" -ForegroundColor White
Write-Host "3. Accept the certificate warning" -ForegroundColor Cyan
Write-Host "4. Go back to: https://main.d3j084kic0l1ff.amplifyapp.com" -ForegroundColor White
Write-Host "5. Try logging in with: abaza@mjd.com / abaza123" -ForegroundColor Cyan
Write-Host "`nThe certificate acceptance is PER BROWSER - you need to do it in the same browser you're using for the app." -ForegroundColor Red