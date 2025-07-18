$sshKey = "C:\Users\abaza\OneDrive\Desktop\MJDv9\boq-matching-system\boq-key-202507161911.pem"

Write-Host "Direct backend check..." -ForegroundColor Yellow

# Simple direct commands
Write-Host "1. Looking for server.js in logs:" -ForegroundColor Cyan
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 "grep -i 'listening\|started\|server.*running' /tmp/backend.log || echo 'No server start message found'"

Write-Host "`n2. Checking all node processes:" -ForegroundColor Cyan
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 "ps aux | grep node"

Write-Host "`n3. Checking all listening ports:" -ForegroundColor Cyan
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 "sudo netstat -tlpn | grep -E '(LISTEN|node)'"

Write-Host "`n4. Looking for errors in backend log:" -ForegroundColor Cyan
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 "grep -i 'error\|fail\|exception' /tmp/backend.log | tail -10"

Write-Host "`n5. Checking server.js file for listen call:" -ForegroundColor Cyan
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 "grep -n 'listen' /home/ec2-user/app/backend/dist/server.js | tail -5"

Write-Host "`n6. Starting a simple test server to verify connectivity:" -ForegroundColor Cyan
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 "pkill -f test-server.js; cd /home/ec2-user && echo 'const http = require(""http""); http.createServer((req,res) => res.end(JSON.stringify({status:""ok""}))).listen(5000, () => console.log(""Test server on 5000""));' > test-server.js && node test-server.js > test-server.log 2>&1 & sleep 2 && curl http://localhost:5000"

Write-Host "`nDirect check complete." -ForegroundColor Green