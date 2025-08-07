# Debug Login Error
$EC2_IP = "44.223.70.138"
$PEM_FILE = "C:\Users\abaza\Downloads\tfp-boq-key.pem"

Clear-Host
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "          DEBUG LOGIN ERROR" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

Write-Host "`n[1] Check recent backend logs..." -ForegroundColor Yellow
ssh -i $PEM_FILE ec2-user@$EC2_IP @'
echo "=== Recent error logs ==="
pm2 logs tfp-backend --err --lines 30 --nostream | grep -v "AWS SDK" | grep -v "NOTE:"

echo ""
echo "=== Check for login-related errors ==="
pm2 logs tfp-backend --lines 50 --nostream | grep -i "login\|auth\|error\|convex" | tail -20
'@

Write-Host "`n[2] Test Convex connection from backend..." -ForegroundColor Yellow
ssh -i $PEM_FILE ec2-user@$EC2_IP @'
cd /home/ec2-user/app/backend

# Create a test script
cat > test-convex.js << "EOF"
require("dotenv").config();
console.log("Convex URL:", process.env.CONVEX_URL);
console.log("Testing Convex connection...");

const https = require("https");
const url = new URL(process.env.CONVEX_URL);

https.get(url, (res) => {
  console.log("Convex response status:", res.statusCode);
  res.on("data", (d) => {
    console.log("Response:", d.toString().substring(0, 100));
  });
}).on("error", (err) => {
  console.error("Convex connection error:", err.message);
});
EOF

node test-convex.js
rm -f test-convex.js
'@

Write-Host "`n[3] Check if it's a password hashing issue..." -ForegroundColor Yellow
ssh -i $PEM_FILE ec2-user@$EC2_IP @'
cd /home/ec2-user/app/backend

# Create test script for bcrypt
cat > test-bcrypt.js << "EOF"
const bcrypt = require("bcryptjs");

async function test() {
  const password = "abaza123";
  const hash = await bcrypt.hash(password, 10);
  console.log("Hash:", hash);
  
  const isValid = await bcrypt.compare(password, hash);
  console.log("Password validation:", isValid);
}

test().catch(console.error);
EOF

echo "Testing bcrypt..."
node test-bcrypt.js 2>&1 || echo "Bcrypt test failed"
rm -f test-bcrypt.js
'@

Write-Host "`nPress any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")