#!/usr/bin/env pwsh
# Debug HTTPS Mixed Content Issue

Write-Host "=== Debugging HTTPS Issue ===" -ForegroundColor Green

# 1. Check what the frontend is actually using
Write-Host "`n1. Checking current frontend build..." -ForegroundColor Yellow
$distFile = "frontend/dist/assets/index-*.js"
if (Test-Path $distFile) {
    Write-Host "Searching for API URL in built files..." -ForegroundColor Cyan
    Get-ChildItem frontend/dist/assets/index-*.js | ForEach-Object {
        Write-Host "File: $($_.Name)" -ForegroundColor Gray
        Select-String -Path $_.FullName -Pattern "http.*54\.90\.3\.22.*api" | ForEach-Object {
            Write-Host "Found: $($_.Line.Substring(0, [Math]::Min(200, $_.Line.Length)))" -ForegroundColor Yellow
        }
    }
}

# 2. Test the backend endpoints
Write-Host "`n2. Testing backend endpoints..." -ForegroundColor Yellow

# Test HTTP
Write-Host "`nTesting HTTP endpoint:" -ForegroundColor Cyan
try {
    $httpResponse = Invoke-WebRequest -Uri "http://44.223.70.138:5000/api/health" -Method GET -UseBasicParsing -TimeoutSec 5
    Write-Host "HTTP Status: $($httpResponse.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "HTTP Error: $_" -ForegroundColor Red
}

# Test HTTPS
Write-Host "`nTesting HTTPS endpoint (ignoring certificate):" -ForegroundColor Cyan
try {
    # PowerShell Core syntax
    if ($PSVersionTable.PSVersion.Major -ge 6) {
        $httpsResponse = Invoke-WebRequest -Uri "https://44.223.70.138/api/health" -Method GET -SkipCertificateCheck -UseBasicParsing -TimeoutSec 5
    } else {
        # Windows PowerShell syntax
        [System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}
        $httpsResponse = Invoke-WebRequest -Uri "https://44.223.70.138/api/health" -Method GET -UseBasicParsing -TimeoutSec 5
    }
    Write-Host "HTTPS Status: $($httpsResponse.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($httpsResponse.Content)" -ForegroundColor Gray
} catch {
    Write-Host "HTTPS Error: $_" -ForegroundColor Red
}

# 3. Check EC2 services
Write-Host "`n3. Checking EC2 services via SSH..." -ForegroundColor Yellow
$sshCommands = @'
echo "=== Nginx Status ==="
sudo systemctl status nginx --no-pager | head -10

echo -e "\n=== Nginx Configuration ==="
sudo nginx -t

echo -e "\n=== Port Listeners ==="
sudo netstat -tlnp | grep -E ":(80|443|5000)"

echo -e "\n=== Backend Process ==="
pm2 list

echo -e "\n=== Testing Local Endpoints ==="
curl -s http://localhost:5000/api/health && echo " <- HTTP OK" || echo " <- HTTP FAILED"
curl -sk https://localhost/api/health && echo " <- HTTPS OK" || echo " <- HTTPS FAILED"

echo -e "\n=== Nginx Error Log (last 10 lines) ==="
sudo tail -10 /var/log/nginx/error.log

echo -e "\n=== Backend Environment ==="
cd /home/ec2-user/app/backend && grep -E "PORT|CORS|FRONTEND" .env | sed 's/SECRET=.*/SECRET=***/'
'@

$keyFile = "boq-key-202507161911.pem"
if (Test-Path $keyFile) {
    Write-Host "Running SSH diagnostics..." -ForegroundColor Cyan
    ssh -i $keyFile -o StrictHostKeyChecking=no ec2-user@44.223.70.138 $sshCommands
} else {
    Write-Host "SSH key not found. Skipping EC2 diagnostics." -ForegroundColor Yellow
}

# 4. Check Amplify deployment
Write-Host "`n4. Checking Amplify deployment..." -ForegroundColor Yellow
Write-Host "Visit: https://console.aws.amazon.com/amplify/" -ForegroundColor Cyan
Write-Host "Check if the latest build succeeded and what environment variables are set" -ForegroundColor Gray

# 5. Browser test
Write-Host "`n5. Browser debugging steps:" -ForegroundColor Yellow
Write-Host "1. Open Chrome DevTools (F12)" -ForegroundColor Gray
Write-Host "2. Go to Network tab" -ForegroundColor Gray
Write-Host "3. Try to login" -ForegroundColor Gray
Write-Host "4. Look for the failed request to see exact URL being called" -ForegroundColor Gray
Write-Host "5. Check Console for any errors" -ForegroundColor Gray

# 6. Quick fix attempt
Write-Host "`n6. Quick fix - Update and rebuild frontend locally..." -ForegroundColor Yellow
$quickFix = Read-Host "Do you want to try a quick local fix? (y/n)"
if ($quickFix -eq 'y') {
    Set-Location frontend
    
    # Create a hardcoded API configuration
    $apiConfigContent = @'
import axios from 'axios';
import { retryWithBackoff } from '../utils/retryWithBackoff';

// HARDCODED FOR DEBUGGING
const API_URL = 'https://44.223.70.138/api';
console.log('API URL is hardcoded to:', API_URL);

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});
'@

    Write-Host "Creating backup of api.ts..." -ForegroundColor Gray
    Copy-Item src/lib/api.ts src/lib/api.ts.backup -Force
    
    Write-Host "Would update src/lib/api.ts with hardcoded URL..." -ForegroundColor Gray
    Write-Host "Then run: npm run build" -ForegroundColor Gray
    Write-Host "And check the dist folder" -ForegroundColor Gray
    
    Set-Location ..
}

Write-Host "`n=== Debugging Complete ===" -ForegroundColor Green
Write-Host "Look for any red errors above" -ForegroundColor Yellow