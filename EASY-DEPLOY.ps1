# ========================================================
# EASY EC2 DEPLOYMENT - Just fill in your details below!
# ========================================================

# STEP 1: FILL IN YOUR AWS DETAILS HERE
# =====================================

$EC2_PUBLIC_IP = "44.223.70.138"              # Replace with your EC2 IP (e.g., "54.123.456.789")
$PEM_FILE_PATH = "C:\\Users\\abaza\\Downloads\\tfp-boq-key.pem"      # Replace with path to your .pem file
$AMPLIFY_URL = "YOUR-AMPLIFY-URL-HERE"          # Replace with your Amplify URL

# Optional: Add your API keys (or leave as is to add them later)
$V2_API_KEY = "your-v2-api-key-here"            
$V1_API_KEY = "your-v1-api-key-here"            

# ========================================================
# DO NOT MODIFY BELOW - Just run the script!
# ========================================================

Clear-Host
Write-Host @"
╔═══════════════════════════════════════════════════════╗
║     THE FENCING PEOPLE - EASY EC2 DEPLOYMENT          ║
╚═══════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

# Validate inputs
$errors = @()
if ($EC2_PUBLIC_IP -eq "44.223.70.138") {
    $errors += "❌ EC2_PUBLIC_IP not set - please add your EC2 IP address"
}
if ($PEM_FILE_PATH -eq "C:\\Users\\abaza\\Downloads\\tfp-boq-key.pem") {
    $errors += "❌ PEM_FILE_PATH not set - please add path to your .pem key file"
}
if ($AMPLIFY_URL -eq "YOUR-AMPLIFY-URL-HERE") {
    $errors += "❌ AMPLIFY_URL not set - please add your Amplify URL"
}
if (!(Test-Path $PEM_FILE_PATH) -and $PEM_FILE_PATH -ne "C:\\Users\\abaza\\Downloads\\tfp-boq-key.pem") {
    $errors += "❌ PEM file not found at: $PEM_FILE_PATH"
}

if ($errors.Count -gt 0) {
    Write-Host "`n⚠️  Please fix these issues:" -ForegroundColor Red
    $errors | ForEach-Object { Write-Host $_ -ForegroundColor Red }
    Write-Host "`nEdit this file and update the values at the top." -ForegroundColor Yellow
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-Host "✅ Configuration validated!" -ForegroundColor Green
Write-Host ""
Write-Host "📍 EC2 IP: $EC2_PUBLIC_IP" -ForegroundColor White
Write-Host "🌐 Amplify URL: $AMPLIFY_URL" -ForegroundColor White
Write-Host "🔑 PEM File: $PEM_FILE_PATH" -ForegroundColor White
Write-Host ""
Write-Host "Ready to deploy? This will:" -ForegroundColor Yellow
Write-Host "  1. Set up Node.js, PM2, and Nginx on your EC2" -ForegroundColor Gray
Write-Host "  2. Configure SSL certificates" -ForegroundColor Gray
Write-Host "  3. Deploy the backend application" -ForegroundColor Gray
Write-Host "  4. Start the application with PM2" -ForegroundColor Gray
Write-Host ""
Write-Host "Press any key to start deployment (or Ctrl+C to cancel)..." -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Execute the deployment
try {
    $deployScript = Join-Path $PSScriptRoot "deploy-to-ec2-automated.ps1"
    
    if (!(Test-Path $deployScript)) {
        Write-Host "`n❌ Error: deploy-to-ec2-automated.ps1 not found!" -ForegroundColor Red
        Write-Host "Make sure both deployment scripts are in the same folder." -ForegroundColor Yellow
        exit 1
    }
    
    & $deployScript -EC2_IP $EC2_PUBLIC_IP -PEM_FILE $PEM_FILE_PATH -AMPLIFY_URL $AMPLIFY_URL
    
    # Update API keys if provided
    if ($V2_API_KEY -ne "your-v2-api-key-here" -or $V1_API_KEY -ne "your-v1-api-key-here") {
        Write-Host "`n🔑 Updating API keys..." -ForegroundColor Yellow
        
        ssh -i $PEM_FILE_PATH ec2-user@$EC2_PUBLIC_IP @"
cd /home/ec2-user/app/backend
cp .env .env.backup
sed -i 's/V2_API_KEY=.*/V2_API_KEY=$V2_API_KEY/' .env
sed -i 's/V1_API_KEY=.*/V1_API_KEY=$V1_API_KEY/' .env
pm2 restart tfp-backend
echo '✅ API keys updated'
"@
    }
    
    Write-Host "`n╔═══════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║         🎉 DEPLOYMENT COMPLETED SUCCESSFULLY! 🎉        ║" -ForegroundColor Green
    Write-Host "╚═══════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    Write-Host "Your backend is now live at:" -ForegroundColor Cyan
    Write-Host "👉 https://$EC2_PUBLIC_IP/api" -ForegroundColor White
    Write-Host ""
    Write-Host "⚠️  IMPORTANT NEXT STEPS:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Update your Amplify app:" -ForegroundColor White
    Write-Host "   - Go to AWS Amplify Console" -ForegroundColor Gray
    Write-Host "   - Set environment variable: VITE_API_URL = https://$EC2_PUBLIC_IP/api" -ForegroundColor Gray
    Write-Host "   - Redeploy your frontend" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. To monitor your backend:" -ForegroundColor White
    Write-Host "   ssh -i `"$PEM_FILE_PATH`" ec2-user@$EC2_PUBLIC_IP 'pm2 logs tfp-backend'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. To restart the backend:" -ForegroundColor White
    Write-Host "   ssh -i `"$PEM_FILE_PATH`" ec2-user@$EC2_PUBLIC_IP 'pm2 restart tfp-backend'" -ForegroundColor Gray
    
} catch {
    Write-Host "`n❌ Deployment failed with error:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

Write-Host "`nPress any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
