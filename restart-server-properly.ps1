# Restart Server Properly
param([string]$IP = "13.218.146.247")

$key = Get-ChildItem -Path . -Filter "*.pem" | Select-Object -First 1

Write-Host "Restarting server properly..." -ForegroundColor Green

# Stop current PM2 process
Write-Host "`nStopping current process..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "pm2 stop all && pm2 delete all"

# Start with a simple command
Write-Host "`nStarting server with PM2..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "cd /home/ec2-user/app && pm2 start backend/dist/server.js --name boq-backend -i 1"

# Save PM2 config
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "pm2 save --force"

# Wait for startup
Write-Host "`nWaiting for server startup..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

# Check if it's running
Write-Host "`nChecking server status..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "pm2 list"

# Check if listening on port
Write-Host "`nChecking if server is listening..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "sudo lsof -i :5000 || echo 'Not listening on 5000'"

# Check logs for server started message
Write-Host "`nChecking logs for startup message..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "pm2 logs --lines 50 --nostream | grep -i 'backend server started\\|http server\\|listening' || echo 'No server started message found'"

# Final test
Write-Host "`nTesting endpoints..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "curl -s http://localhost:5000/api/health && echo '' || echo 'API not responding'"

# Test from outside
Write-Host "`nTesting from internet..." -ForegroundColor Cyan
$testUrl = "http://$IP/api/health"
try {
    $response = Invoke-RestMethod -Uri $testUrl -Method Get -TimeoutSec 5
    Write-Host "✅ SUCCESS! API is working!" -ForegroundColor Green
    Write-Host "Response: $($response | ConvertTo-Json -Compress)" -ForegroundColor Gray
    Write-Host "`nYour application is now accessible at: http://$IP" -ForegroundColor Green
} catch {
    Write-Host "❌ Still cannot access from internet" -ForegroundColor Red
    Write-Host "But the server might be running locally. Check logs above." -ForegroundColor Yellow
}

Write-Host "`nTo check logs: ssh -i $($key.Name) ec2-user@$IP 'pm2 logs'" -ForegroundColor Cyan