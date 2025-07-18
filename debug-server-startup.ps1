# Debug Server Startup
param([string]$IP = "13.218.146.247")

$key = Get-ChildItem -Path . -Filter "*.pem" | Select-Object -First 1

Write-Host "Debugging server startup..." -ForegroundColor Green

# Check the actual server.js file
Write-Host "`nChecking server.js content for listen call..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "grep -n 'listen\\|PORT' /home/ec2-user/app/backend/dist/server.js | head -20"

# Try running the server directly with more output
Write-Host "`nRunning server directly to see all output..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" @"
cd /home/ec2-user/app
export NODE_ENV=production
timeout 5 node backend/dist/server.js 2>&1 || true
"@

# Check if there's an app.listen call
Write-Host "`nChecking for app.listen in server files..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "grep -r 'app.listen\\|server.listen' /home/ec2-user/app/backend/dist/ | head -10"