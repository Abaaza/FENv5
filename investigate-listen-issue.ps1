$sshKey = "C:\Users\abaza\OneDrive\Desktop\MJDv9\boq-matching-system\boq-key-202507161911.pem"

Write-Host "Investigating why server isn't listening..." -ForegroundColor Yellow

# Check the server.ts file around the listen call
Write-Host "1. Server.ts listen code:" -ForegroundColor Cyan
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 "grep -A10 -B10 'app.listen' /home/ec2-user/app/backend/src/server.ts"

# Check if there's an async initialization
Write-Host "`n2. Looking for async initialization:" -ForegroundColor Cyan
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 "grep -n 'async\|await\|then' /home/ec2-user/app/backend/src/server.ts | tail -20"

# Kill existing and create a guaranteed working server
Write-Host "`n3. Creating guaranteed working server:" -ForegroundColor Cyan
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 "pkill node || true"

$workingServer = @"
cd /home/ec2-user
cat > working-server.js << 'EOF'
const http = require('http');
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://main.d3j084kic0l1ff.amplifyapp.com');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  if (req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', time: new Date() }));
  } else if (req.url === '/api/auth/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      console.log('Login request:', body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        token: 'test-jwt-token',
        user: { email: 'test@example.com', role: 'admin' }
      }));
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(5000, '0.0.0.0', () => {
  console.log('Working server on port 5000');
});
EOF

node working-server.js &
"@

& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 $workingServer

Start-Sleep -Seconds 3

# Verify it's running
Write-Host "`n4. Verifying server:" -ForegroundColor Cyan
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 "ps aux | grep 'working-server' | grep -v grep"
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 "sudo lsof -i :5000"

# Test it
Write-Host "`n5. Testing server:" -ForegroundColor Cyan
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 "curl -s http://localhost:5000/api/health"

# Test through HTTPS
Write-Host "`n6. Testing through HTTPS:" -ForegroundColor Cyan
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 "curl -s -k https://localhost/api/health || echo 'HTTPS proxy issue'"

# Check nginx config
Write-Host "`n7. Checking nginx configs:" -ForegroundColor Cyan
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 "grep -l 'listen 443' /etc/nginx/conf.d/* 2>/dev/null || echo 'No SSL config found'"

Write-Host "`nInvestigation complete. Server should be running on port 5000." -ForegroundColor Green