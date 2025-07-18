# Debug Final Issue
param([string]$IP = "13.218.146.247")

$key = Get-ChildItem -Path . -Filter "*.pem" | Select-Object -First 1

Write-Host "Debugging why server won't listen..." -ForegroundColor Green

# Check the full logs
Write-Host "`nChecking full PM2 logs..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "pm2 logs --lines 100 --nostream"

# Let me check if there's a configuration issue preventing the server from starting
Write-Host "`nLet me run the server without PM2 to see the real error..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "pm2 stop all"

Write-Host "`nRunning server directly..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" -t "cd /home/ec2-user/app && timeout 10 node backend/dist/server.js"

Write-Host "`nDone debugging." -ForegroundColor Green