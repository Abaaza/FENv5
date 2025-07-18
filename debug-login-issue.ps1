# Debug Login Issue
param([string]$IP = "13.218.146.247")

$key = Get-ChildItem -Path . -Filter "*.pem" | Select-Object -First 1

Write-Host "Debugging Login Issue" -ForegroundColor Green
Write-Host "===================" -ForegroundColor Green

# Check the actual login logs
Write-Host "`nChecking login logs in detail..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "pm2 logs boq-server --lines 50 | grep -A5 -B5 'login' | tail -30"

# Test with a simpler curl command
Write-Host "`nTesting login with simple curl..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" @"
curl -k https://localhost/api/auth/login \
  -X POST \
  -H 'Content-Type: application/json' \
  -d '{"email":"abaza@mjd.com","password":"abaza123"}' \
  -v 2>&1 | tail -20
"@

# Check if there's a validation schema issue
Write-Host "`nChecking validation schema..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "grep -r 'email.*validation\\|password.*validation' /home/ec2-user/app/backend/dist/ 2>/dev/null | head -5"

Write-Host "`n📌 Summary:" -ForegroundColor Yellow
Write-Host "The health endpoint works, so HTTPS is configured correctly." -ForegroundColor Green
Write-Host "The login is returning validation errors, which suggests:" -ForegroundColor Cyan
Write-Host "1. The request is reaching the server" -ForegroundColor White
Write-Host "2. The JSON might not be parsed correctly" -ForegroundColor White
Write-Host "3. Or there is a validation schema mismatch" -ForegroundColor White

Write-Host "`nAction Required:" -ForegroundColor Red
Write-Host "1. Visit https://$IP/api/health in your browser" -ForegroundColor Yellow
Write-Host "2. Accept the certificate" -ForegroundColor Yellow
Write-Host "3. Try logging in at https://main.d3j084kic0l1ff.amplifyapp.com" -ForegroundColor Yellow
Write-Host "   Email: abaza@mjd.com" -ForegroundColor Cyan
Write-Host "   Password: abaza123" -ForegroundColor Cyan