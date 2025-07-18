# Direct Backend Fix
param([string]$IP = "13.218.146.247")

$key = Get-ChildItem -Path . -Filter "*.pem" | Select-Object -First 1

Write-Host "Direct Backend Fix" -ForegroundColor Green
Write-Host "=================" -ForegroundColor Green

# Fix backend directly with individual commands
Write-Host "`nStep 1: Installing node-fetch..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "cd /home/ec2-user/app/backend && npm install node-fetch@2"

# Create polyfill file
Write-Host "`nStep 2: Creating fetch polyfill..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "cd /home/ec2-user/app/backend && echo 'const fetch = require(\"node-fetch\"); if (!global.fetch) { global.fetch = fetch; global.Headers = fetch.Headers; global.Request = fetch.Request; global.Response = fetch.Response; }' > dist/fetch-polyfill.js"

# Update server.js
Write-Host "`nStep 3: Updating server.js..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" 'cd /home/ec2-user/app/backend && if ! grep -q fetch-polyfill dist/server.js; then sed -i "1s/^/require(\".\/fetch-polyfill\");\n/" dist/server.js; fi'

# Restart backend
Write-Host "`nStep 4: Restarting backend..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "pm2 restart boq-server"

# Wait for restart
Start-Sleep -Seconds 3

# Test health endpoint
Write-Host "`nStep 5: Testing health endpoint..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "curl -k https://localhost/api/health -s"

# Test login endpoint
Write-Host "`nStep 6: Testing login with your credentials..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" 'curl -k -X POST https://localhost/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"abaza@mjd.com\",\"password\":\"abaza123\"}" -s'

# Check for errors
Write-Host "`nStep 7: Checking for errors..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "pm2 logs boq-server --err --lines 5 --nostream"

Write-Host "`n✅ Backend should now be fixed!" -ForegroundColor Green
Write-Host "`nFINAL STEPS:" -ForegroundColor Red
Write-Host "1. Visit https://$IP/api/health in your browser" -ForegroundColor Yellow
Write-Host "2. Accept the certificate warning" -ForegroundColor Yellow
Write-Host "3. Go to https://main.d3j084kic0l1ff.amplifyapp.com" -ForegroundColor Yellow
Write-Host "4. Login with abaza@mjd.com / abaza123" -ForegroundColor Yellow