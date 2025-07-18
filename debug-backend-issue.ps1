$sshKey = "C:\Users\abaza\OneDrive\Desktop\MJDv9\boq-matching-system\boq-key-202507161911.pem"

Write-Host "Debugging why backend isn't listening..." -ForegroundColor Yellow

# Check server.js around the listen call
Write-Host "1. Server.js listen code:" -ForegroundColor Cyan
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 "tail -20 /home/ec2-user/app/backend/dist/server.js"

# Kill existing and start minimal server
Write-Host "`n2. Starting minimal test server:" -ForegroundColor Cyan
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 "pkill node; cd /home/ec2-user && npm install express"

$minimalServer = @'
cd /home/ec2-user
cat > test-api.js << 'JSEOF'
const express = require('express');
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://main.d3j084kic0l1ff.amplifyapp.com');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.get('/api/health', (req, res) => res.json({status: 'ok'}));
app.post('/api/auth/login', (req, res) => {
  console.log('Login:', req.body);
  res.json({token: 'test-' + Date.now(), user: {email: 'admin@test.com'}});
});
app.listen(5000, () => console.log('Test API on port 5000'));
JSEOF
node test-api.js &
echo "Started test server"
sleep 3
curl http://localhost:5000/api/health
'@

& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 $minimalServer

# Check if it's running
Write-Host "`n3. Checking test server:" -ForegroundColor Cyan
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 "ps aux | grep node && sudo netstat -tlpn | grep 5000"

# Test through nginx
Write-Host "`n4. Testing through HTTPS:" -ForegroundColor Cyan
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 "curl -k https://localhost/api/health"

Write-Host "`nMinimal server should be running. Try logging in!" -ForegroundColor Green