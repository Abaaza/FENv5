# Upload and Run SSL Setup
param([string]$IP = "13.218.146.247")

$key = Get-ChildItem -Path . -Filter "*.pem" | Select-Object -First 1

Write-Host "Uploading and running SSL setup" -ForegroundColor Green
Write-Host "===============================" -ForegroundColor Green

# Upload the script
Write-Host "`nUploading setup script..." -ForegroundColor Cyan
scp -o StrictHostKeyChecking=no -i $key.Name setup-ssl.sh "ec2-user@${IP}:/tmp/setup-ssl.sh"

# Make it executable and run it
Write-Host "`nRunning SSL setup..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "chmod +x /tmp/setup-ssl.sh && sudo /tmp/setup-ssl.sh"

# Update backend CORS
Write-Host "`nUpdating backend CORS..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "cd /home/ec2-user/app 2>/dev/null || cd /home/ec2-user/boq-matching-system || cd /home/ec2-user; if [ -f .env ]; then grep -v CORS_ORIGIN .env > .env.tmp && echo 'CORS_ORIGIN=https://main.d3j084kic0l1ff.amplifyapp.com' >> .env.tmp && mv .env.tmp .env && pm2 restart all; fi"

Write-Host "`n✅ SSL Setup Complete!" -ForegroundColor Green
Write-Host "`nYour API endpoints:" -ForegroundColor Yellow
Write-Host "https://$IP/" -ForegroundColor Cyan
Write-Host "https://$IP/api/health" -ForegroundColor Cyan

Write-Host "`n⚠️  IMPORTANT:" -ForegroundColor Red
Write-Host "1. Update Amplify environment variable:" -ForegroundColor Yellow
Write-Host "   REACT_APP_API_URL=https://$IP/api" -ForegroundColor White
Write-Host "`n2. When you first visit the HTTPS URL, you'll see a certificate warning." -ForegroundColor Yellow
Write-Host "   Click 'Advanced' → 'Proceed to $IP (unsafe)'" -ForegroundColor Yellow