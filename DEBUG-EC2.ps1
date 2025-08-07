# Debug EC2 Backend Script
# This will help us figure out what's wrong

$EC2_IP = "44.223.70.138"
$PEM_FILE = "C:\Users\abaza\Downloads\tfp-boq-key.pem"

Clear-Host
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "          DEBUG EC2 BACKEND" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

Write-Host "`n[STEP 1] Checking PM2 status..." -ForegroundColor Yellow
ssh -i $PEM_FILE ec2-user@$EC2_IP "pm2 status"

Write-Host "`n[STEP 2] Checking if backend directory exists..." -ForegroundColor Yellow
ssh -i $PEM_FILE ec2-user@$EC2_IP "ls -la /home/ec2-user/app/"

Write-Host "`n[STEP 3] Checking backend files..." -ForegroundColor Yellow
ssh -i $PEM_FILE ec2-user@$EC2_IP "ls -la /home/ec2-user/app/backend/"

Write-Host "`n[STEP 4] Checking if .env file exists..." -ForegroundColor Yellow
ssh -i $PEM_FILE ec2-user@$EC2_IP "ls -la /home/ec2-user/app/backend/.env"

Write-Host "`n[STEP 5] Checking Node.js version..." -ForegroundColor Yellow
ssh -i $PEM_FILE ec2-user@$EC2_IP "node --version && npm --version"

Write-Host "`n[STEP 6] Checking Nginx status..." -ForegroundColor Yellow
ssh -i $PEM_FILE ec2-user@$EC2_IP "sudo systemctl status nginx"

Write-Host "`n[STEP 7] Checking Nginx configuration..." -ForegroundColor Yellow
ssh -i $PEM_FILE ec2-user@$EC2_IP "sudo nginx -t"

Write-Host "`n[STEP 8] Checking if port 5000 is listening..." -ForegroundColor Yellow
ssh -i $PEM_FILE ec2-user@$EC2_IP "sudo netstat -tlnp | grep 5000"

Write-Host "`n[STEP 9] Checking PM2 error logs..." -ForegroundColor Yellow
ssh -i $PEM_FILE ec2-user@$EC2_IP "pm2 logs --err --lines 20"

Write-Host "`n[STEP 10] Checking system logs..." -ForegroundColor Yellow
ssh -i $PEM_FILE ec2-user@$EC2_IP "sudo journalctl -u pm2-ec2-user -n 20"

Write-Host "`nPress any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")