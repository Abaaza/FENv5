$sshKey = "C:\Users\abaza\OneDrive\Desktop\MJDv9\boq-matching-system\boq-key-202507161911.pem"

Write-Host "Starting backend server directly..." -ForegroundColor Yellow

# Check backend structure
Write-Host "1. Checking backend files..." -ForegroundColor Cyan
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 "ls -la /home/ec2-user/app/backend/"

# Kill existing processes and start backend
Write-Host "`n2. Starting backend server..." -ForegroundColor Cyan
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 @'
cd /home/ec2-user/app/backend

# Kill any existing node process on port 5000
sudo lsof -ti:5000 | xargs -r sudo kill -9 2>/dev/null || true

# Check for server files
if [ -f "dist/server.js" ]; then
    echo "Starting compiled server..."
    PORT=5000 node dist/server.js > /home/ec2-user/server.log 2>&1 &
    echo "Server started with PID: $!"
else
    echo "No dist/server.js found. Contents:"
    ls -la
    
    # Try to build
    if [ -f "src/server.ts" ]; then
        echo "Building TypeScript..."
        npm run build || npx tsc || echo "Build failed"
        
        if [ -f "dist/server.js" ]; then
            echo "Starting newly built server..."
            PORT=5000 node dist/server.js > /home/ec2-user/server.log 2>&1 &
            echo "Server started with PID: $!"
        fi
    fi
fi

# Wait for server to start
sleep 5

# Check if running
echo "Checking if server is running:"
ps aux | grep -v grep | grep "node.*server.js" || echo "No node server found"
echo ""
echo "Port 5000 status:"
sudo lsof -i :5000 || echo "Nothing on port 5000"
echo ""
echo "Server logs:"
tail -20 /home/ec2-user/server.log 2>/dev/null || echo "No log file"
'@

# Test the endpoints
Write-Host "`n3. Testing endpoints..." -ForegroundColor Cyan
& ssh -i $sshKey -o StrictHostKeyChecking=no ec2-user@13.218.146.247 @'
echo "Direct backend test:"
curl -s http://localhost:5000/api/health | jq . 2>/dev/null || curl -s http://localhost:5000/api/health || echo "Backend not responding"
echo ""
echo "HTTPS proxy test:"
curl -s -k https://localhost/api/health | jq . 2>/dev/null || curl -s -k https://localhost/api/health || echo "Nginx proxy not working"
echo ""
echo "CORS headers test:"
curl -s -I -X OPTIONS -k https://localhost/api/auth/login \
  -H "Origin: https://main.d3j084kic0l1ff.amplifyapp.com" \
  -H "Access-Control-Request-Method: POST" | grep -i "access-control" || echo "No CORS headers found"
'@

Write-Host "`nBackend should now be running. Try logging in at: https://main.d3j084kic0l1ff.amplifyapp.com/login" -ForegroundColor Green