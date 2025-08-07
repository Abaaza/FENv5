# Debug TFP Backend Issues
$EC2_IP = "44.223.70.138"
$PEM_FILE = "C:\Users\abaza\Downloads\tfp-boq-key.pem"

Clear-Host
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "          DEBUG TFP BACKEND ISSUES" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

Write-Host "`n[STEP 1] Checking PM2 status..." -ForegroundColor Yellow
ssh -i $PEM_FILE ec2-user@$EC2_IP "pm2 status"

Write-Host "`n[STEP 2] Checking PM2 error logs..." -ForegroundColor Yellow
ssh -i $PEM_FILE ec2-user@$EC2_IP "pm2 logs tfp-backend --err --lines 30 --nostream"

Write-Host "`n[STEP 3] Checking PM2 output logs..." -ForegroundColor Yellow
ssh -i $PEM_FILE ec2-user@$EC2_IP "pm2 logs tfp-backend --out --lines 20 --nostream"

Write-Host "`n[STEP 4] Testing backend directly with curl..." -ForegroundColor Yellow
ssh -i $PEM_FILE ec2-user@$EC2_IP @'
echo "Testing localhost:5000:"
curl -v http://localhost:5000/api/health 2>&1 | head -20

echo ""
echo "Checking if port 5000 is listening:"
sudo netstat -tlnp | grep 5000
'@

Write-Host "`n[STEP 5] Checking .env file..." -ForegroundColor Yellow
ssh -i $PEM_FILE ec2-user@$EC2_IP "cd /home/ec2-user/app/backend && cat .env | grep -E '^[A-Z]' | head -15"

Write-Host "`n[STEP 6] Testing node directly..." -ForegroundColor Yellow
ssh -i $PEM_FILE ec2-user@$EC2_IP @'
cd /home/ec2-user/app/backend
echo "Running node directly to see errors:"
timeout 10 node index.js 2>&1 | head -50
'@

Write-Host "`n[STEP 7] Checking if dist folder exists..." -ForegroundColor Yellow
ssh -i $PEM_FILE ec2-user@$EC2_IP @'
cd /home/ec2-user/app/backend
echo "Checking dist folder:"
ls -la dist/ | head -10

echo ""
echo "Checking if server.js exists:"
ls -la dist/server.js
'@

Write-Host "`nPress any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")