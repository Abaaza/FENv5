# Get Convex Information Helper
Write-Host "`n=== CONVEX CREDENTIALS HELPER ===" -ForegroundColor Green
Write-Host "Follow these steps to get your Convex credentials:" -ForegroundColor Yellow

Write-Host "`n1. Open your browser and go to:" -ForegroundColor Cyan
Write-Host "   https://dashboard.convex.dev/" -ForegroundColor White

Write-Host "`n2. Sign in (if not already signed in)" -ForegroundColor Cyan

Write-Host "`n3. Select your project (or create a new one)" -ForegroundColor Cyan

Write-Host "`n4. Click on 'Settings' in the left sidebar" -ForegroundColor Cyan

Write-Host "`n5. Click on 'URL & Deploy Key'" -ForegroundColor Cyan

Write-Host "`n6. You'll see two values:" -ForegroundColor Cyan
Write-Host "   - Deployment URL: Something like https://good-dolphin-454.convex.cloud" -ForegroundColor White
Write-Host "   - Deploy Key: A long string starting with 'prod:' or 'dev:'" -ForegroundColor White

Write-Host "`n7. Copy these values exactly as shown" -ForegroundColor Yellow

Write-Host "`nNOTE: The Convex URL must be at least 32 characters long" -ForegroundColor Red
Write-Host "      The Deploy Key is usually 64+ characters long" -ForegroundColor Red

Write-Host "`nPress Enter when you have both values ready..." -ForegroundColor Green
Read-Host

# Now update the environment
Write-Host "`nLet's update your environment now:" -ForegroundColor Green
& .\update-env-simple.ps1