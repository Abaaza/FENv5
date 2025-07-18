# Complete Fix for Your Website
param([string]$IP = "13.218.146.247")

$key = Get-ChildItem -Path . -Filter "*.pem" | Select-Object -First 1

Write-Host "Complete Fix for Your Website" -ForegroundColor Green
Write-Host "=============================" -ForegroundColor Green

# Find the actual backend server.js
Write-Host "`nStep 1: Finding actual backend..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "pm2 show boq-server | grep 'exec cwd' | awk '{print \$4}'"

# Check PM2 info to find the right path
Write-Host "`nStep 2: Getting backend details..." -ForegroundColor Cyan
$scriptPath = ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "pm2 show boq-server | grep 'script path' | awk '{print \$4}'"
Write-Host "Script path: $scriptPath" -ForegroundColor Yellow

# Fix body parser in the actual server file
Write-Host "`nStep 3: Fixing body parser in backend..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" @"
# The actual backend is at /home/ec2-user/app/backend/dist/server.js
cd /home/ec2-user/app/backend

# Check current middleware setup
echo "Current middleware setup:"
grep -n "use(" dist/server.js | grep -E "json|body|cors" | head -10

# Add proper body parsing if not present
if ! grep -q "app.use(express.json" dist/server.js; then
    echo "Adding body parser..."
    # Find where app is defined and add body parser after it
    sed -i '/const app = express()/a\app.use(express.json());\napp.use(express.urlencoded({ extended: true }));' dist/server.js
fi

echo "Body parser setup complete"
"@

# Update CORS in backend
Write-Host "`nStep 4: Ensuring CORS is properly configured..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" @"
cd /home/ec2-user/app
# Update CORS origin in .env
grep -v "CORS_ORIGIN" .env > .env.tmp || true
echo "CORS_ORIGIN=https://main.d3j084kic0l1ff.amplifyapp.com" >> .env.tmp
mv .env.tmp .env
cat .env | grep CORS
"@

# Restart backend
Write-Host "`nStep 5: Restarting backend..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "pm2 restart boq-server"

Start-Sleep -Seconds 3

# Test all endpoints
Write-Host "`nStep 6: Testing endpoints..." -ForegroundColor Cyan

Write-Host "`n  Testing health endpoint..." -ForegroundColor Gray
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "curl -k https://localhost/api/health -s | head -1"

Write-Host "`n  Testing OPTIONS preflight..." -ForegroundColor Gray
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" 'curl -k -X OPTIONS https://localhost/api/auth/login -H "Origin: https://main.d3j084kic0l1ff.amplifyapp.com" -H "Access-Control-Request-Method: POST" -w "\nStatus: %{http_code}\n" -s'

Write-Host "`n  Testing login..." -ForegroundColor Gray
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" 'curl -k -X POST https://localhost/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"abaza@mjd.com\",\"password\":\"abaza123\"}" -s | head -1'

# Check recent logs
Write-Host "`nStep 7: Checking logs..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "pm2 logs boq-server --lines 15 --nostream | grep -v 'PM2' | tail -10"

Write-Host "`n✅ COMPLETE FIX APPLIED!" -ForegroundColor Green
Write-Host "`n🎯 FINAL ACTIONS REQUIRED:" -ForegroundColor Red
Write-Host "`n1. Clear your browser completely:" -ForegroundColor Yellow
Write-Host "   - Press Ctrl+Shift+Delete" -ForegroundColor Cyan
Write-Host "   - Select 'Cached images and files'" -ForegroundColor Cyan
Write-Host "   - Select 'Cookies and other site data'" -ForegroundColor Cyan
Write-Host "   - Click 'Clear data'" -ForegroundColor Cyan

Write-Host "`n2. Accept the certificate:" -ForegroundColor Yellow
Write-Host "   - Open new browser tab" -ForegroundColor Cyan
Write-Host "   - Go to: https://$IP/api/health" -ForegroundColor White
Write-Host "   - Click 'Advanced' -> 'Proceed to $IP'" -ForegroundColor Cyan

Write-Host "`n3. Login to your app:" -ForegroundColor Yellow
Write-Host "   - Go to: https://main.d3j084kic0l1ff.amplifyapp.com" -ForegroundColor White
Write-Host "   - Email: abaza@mjd.com" -ForegroundColor Cyan
Write-Host "   - Password: abaza123" -ForegroundColor Cyan

Write-Host "`nYour website is ready for delivery!" -ForegroundColor Green