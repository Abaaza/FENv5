$sshKey = "C:\Users\abaza\OneDrive\Desktop\MJDv9\boq-matching-system\boq-key-202507161911.pem"

Write-Host "Debugging backend startup..." -ForegroundColor Yellow

# Direct SSH commands to avoid script issues
Write-Host "1. Checking environment..." -ForegroundColor Cyan
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 "cd /home/ec2-user/app && cat .env"

Write-Host "`n2. Checking if dist/server.js exists..." -ForegroundColor Cyan
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 "ls -la /home/ec2-user/app/backend/dist/server.js"

Write-Host "`n3. Killing old processes..." -ForegroundColor Cyan
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 "sudo lsof -ti:5000 | xargs -r sudo kill -9 2>/dev/null || echo 'No process on 5000'"

Write-Host "`n4. Starting backend with explicit environment..." -ForegroundColor Cyan
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 "cd /home/ec2-user/app/backend && source /home/ec2-user/app/.env 2>/dev/null; PORT=5000 NODE_ENV=production nohup node dist/server.js > /home/ec2-user/backend.log 2>&1 & echo 'Started backend with PID: '$!"

Write-Host "`n5. Waiting for startup..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

Write-Host "`n6. Checking if backend is running..." -ForegroundColor Cyan
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 "ps aux | grep 'node.*server.js' | grep -v grep"

Write-Host "`n7. Checking port 5000..." -ForegroundColor Cyan
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 "sudo netstat -tlpn | grep :5000"

Write-Host "`n8. Checking backend logs..." -ForegroundColor Cyan
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 "tail -30 /home/ec2-user/backend.log"

Write-Host "`n9. Testing API directly..." -ForegroundColor Cyan
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 "curl -s http://localhost:5000/api/health || echo 'API not responding'"

Write-Host "`n10. Testing through HTTPS..." -ForegroundColor Cyan
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 "curl -s -k -I https://localhost/api/health"

Write-Host "`nBackend debugging complete." -ForegroundColor Green