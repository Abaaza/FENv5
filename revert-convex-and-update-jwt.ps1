# Revert to old Convex URL and update JWT timeout to 16 hours

Write-Host "Reverting to old Convex URL and updating JWT timeout..." -ForegroundColor Cyan

$sshKey = "C:\Users\abaza\OneDrive\Desktop\MJDv9\boq-matching-system\boq-key-202507161911.pem"
$ec2Instance = "ec2-user@13.218.146.247"

# Script to update Convex URL and JWT timeout
$updateScript = @'
cd /home/ec2-user/app/backend

# Backup current files
cp index.js index.js.backup.$(date +%Y%m%d_%H%M%S)
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

# Update index.js with old Convex URL and 16h JWT timeout
cat > index.js << 'EOF'
// Add fetch polyfill for Node 16
require("cross-fetch/polyfill");

// Set required environment variables with proper lengths
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "mjd-boq-matching-access-secret-key-2025-secure";
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "mjd-boq-matching-refresh-secret-key-2025-secure";
process.env.CONVEX_URL = process.env.CONVEX_URL || "https://good-dolphin-454.convex.cloud";
process.env.FRONTEND_URL = process.env.FRONTEND_URL || "https://main.d3j084kic0l1ff.amplifyapp.com";
process.env.NODE_ENV = process.env.NODE_ENV || "production";
process.env.PORT = process.env.PORT || "5000";
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || "https://main.d3j084kic0l1ff.amplifyapp.com";
process.env.COOKIE_SECURE = process.env.COOKIE_SECURE || "true";
process.env.JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || "16h";
process.env.JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || "30d";

const { app } = require("./dist/server");

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log("[Server] Backend server started on port " + PORT);
    console.log("[Server] Environment: " + (process.env.NODE_ENV || "development"));
    console.log("[Server] Convex URL: " + process.env.CONVEX_URL);
    console.log("[Server] JWT Access Token Expiry: " + process.env.JWT_ACCESS_EXPIRY);
});
EOF

echo "Updated index.js with old Convex URL and 16h JWT timeout"

# Update .env file
# Update Convex URL
if grep -q "CONVEX_URL" .env; then
    sed -i 's|CONVEX_URL=.*|CONVEX_URL=https://good-dolphin-454.convex.cloud|' .env
else
    echo "CONVEX_URL=https://good-dolphin-454.convex.cloud" >> .env
fi

# Update JWT expiry times
if grep -q "JWT_ACCESS_EXPIRY" .env; then
    sed -i 's/JWT_ACCESS_EXPIRY=.*/JWT_ACCESS_EXPIRY=16h/' .env
else
    echo "JWT_ACCESS_EXPIRY=16h" >> .env
fi

if grep -q "JWT_REFRESH_EXPIRY" .env; then
    sed -i 's/JWT_REFRESH_EXPIRY=.*/JWT_REFRESH_EXPIRY=30d/' .env
else
    echo "JWT_REFRESH_EXPIRY=30d" >> .env
fi

echo "Updated .env file"
echo "Current configuration:"
grep -E "CONVEX_URL|JWT_ACCESS_EXPIRY|JWT_REFRESH_EXPIRY" .env

# Also update the default value in the TypeScript config file
if [ -f "src/config/env.ts" ]; then
    sed -i "s/JWT_ACCESS_EXPIRY: z.string().default('.*')/JWT_ACCESS_EXPIRY: z.string().default('16h')/" src/config/env.ts
    echo "Updated src/config/env.ts with new default"
fi

# Restart PM2
pm2 restart boq-backend --update-env
pm2 save

# Wait and check status
sleep 5
pm2 status boq-backend

# Check logs for confirmation
echo -e "\nChecking backend logs..."
pm2 logs boq-backend --lines 10 --nostream | grep -E "Convex URL|JWT Access Token"

echo "Configuration update complete!"
'@

Write-Host "Applying changes on EC2..." -ForegroundColor Yellow
& ssh -i $sshKey -o StrictHostKeyChecking=no $ec2Instance $updateScript

Write-Host "`n[SUCCESS] Configuration updated!" -ForegroundColor Green
Write-Host "- Convex URL reverted to: https://good-dolphin-454.convex.cloud" -ForegroundColor Cyan
Write-Host "- JWT Access Token expiry set to: 16 hours" -ForegroundColor Cyan
Write-Host "- JWT Refresh Token expiry remains: 30 days" -ForegroundColor Cyan