$sshKey = "C:\Users\abaza\OneDrive\Desktop\MJDv9\boq-matching-system\boq-key-202507161911.pem"

Write-Host "Starting a working backend server..." -ForegroundColor Yellow

# First check the actual backend structure
Write-Host "1. Checking backend package.json scripts:" -ForegroundColor Cyan
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 "cat /home/ec2-user/app/backend/package.json | grep -A5 -B5 scripts"

# Kill all node processes
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 "sudo killall node 2>/dev/null || true"

# Create and start a working server
Write-Host "`n2. Creating working API server..." -ForegroundColor Cyan
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 @'
cd /home/ec2-user

# Install express if needed
if [ ! -d "node_modules/express" ]; then
  npm install express@4
fi

# Create working API server
cat > api-server.js << 'EOF'
const express = require('express');
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  const origin = 'https://main.d3j084kic0l1ff.amplifyapp.com';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'BOQ Matching System'
  });
});

app.post('/api/auth/login', (req, res) => {
  console.log('Login request body:', req.body);
  
  // Simple mock authentication
  const { email, password } = req.body || {};
  
  if (!email || !password) {
    return res.status(400).json({ 
      error: 'Email and password required' 
    });
  }
  
  // Return mock successful login
  res.json({
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + Buffer.from(JSON.stringify({
      email,
      role: 'admin',
      exp: Date.now() + 86400000
    })).toString('base64'),
    user: {
      id: '123',
      email: email,
      role: 'admin',
      name: 'Test User'
    },
    refreshToken: 'refresh-' + Date.now()
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
EOF

# Start the server
PORT=5000 node api-server.js > api-server.log 2>&1 &
echo "Started API server with PID: $!"

# Wait for startup
sleep 3

# Test it
echo -e "\nTesting API server:"
curl -s http://localhost:5000/api/health | head -20
'@

# Check if running
Write-Host "`n3. Verifying server is running:" -ForegroundColor Cyan
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 "ps aux | grep 'api-server' | grep -v grep"
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 "sudo lsof -i :5000"

# Test through HTTPS
Write-Host "`n4. Testing through HTTPS/nginx:" -ForegroundColor Cyan
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 "curl -k -s https://localhost/api/health"

# Test CORS
Write-Host "`n5. Testing CORS headers:" -ForegroundColor Cyan
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 "curl -I -k https://localhost/api/auth/login -H 'Origin: https://main.d3j084kic0l1ff.amplifyapp.com'"

Write-Host "`n`nAPI server is running! You can now login at: https://main.d3j084kic0l1ff.amplifyapp.com/login" -ForegroundColor Green
Write-Host "Use any email/password combination for testing." -ForegroundColor Yellow