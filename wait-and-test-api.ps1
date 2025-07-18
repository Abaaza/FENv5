# Wait for deployment and test API

Write-Host "`n=== Waiting for Deployment to Complete ===`n" -ForegroundColor Cyan

# Wait for deployment to complete
Write-Host "Waiting 3 minutes for GitHub Actions deployment..." -ForegroundColor Yellow
$startTime = Get-Date

for ($i = 0; $i -lt 18; $i++) {
    $elapsed = [math]::Round(((Get-Date) - $startTime).TotalSeconds)
    Write-Progress -Activity "Waiting for deployment" -Status "$elapsed seconds elapsed" -PercentComplete (($i / 18) * 100)
    Start-Sleep -Seconds 10
}

Write-Progress -Activity "Waiting for deployment" -Completed

Write-Host "`n=== Testing API ===`n" -ForegroundColor Cyan

# Test health endpoint
Write-Host "Testing /health endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "https://ls4380art0.execute-api.us-east-1.amazonaws.com/health" -TimeoutSec 30
    Write-Host "✅ Health endpoint is working!" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Yellow
    $response | ConvertTo-Json
    
    # Test API health
    Write-Host "`nTesting /api/health endpoint..." -ForegroundColor Yellow
    $apiResponse = Invoke-RestMethod -Uri "https://ls4380art0.execute-api.us-east-1.amazonaws.com/api/health" -TimeoutSec 30
    Write-Host "✅ API Health endpoint is working!" -ForegroundColor Green
    $apiResponse | ConvertTo-Json
    
    Write-Host "`n🎉 YOUR BACKEND IS DEPLOYED AND WORKING!" -ForegroundColor Green
    
    Write-Host "`n=== API Endpoints ===" -ForegroundColor Cyan
    Write-Host "Base URL: https://ls4380art0.execute-api.us-east-1.amazonaws.com" -ForegroundColor White
    Write-Host "Health: https://ls4380art0.execute-api.us-east-1.amazonaws.com/health" -ForegroundColor White
    Write-Host "API Health: https://ls4380art0.execute-api.us-east-1.amazonaws.com/api/health" -ForegroundColor White
    Write-Host "Login: POST https://ls4380art0.execute-api.us-east-1.amazonaws.com/api/auth/login" -ForegroundColor White
    Write-Host "Upload: POST https://ls4380art0.execute-api.us-east-1.amazonaws.com/api/price-matching/upload" -ForegroundColor White
    
    Write-Host "`n=== Next Steps ===" -ForegroundColor Yellow
    Write-Host "1. Update your frontend .env with the API URL" -ForegroundColor White
    Write-Host "2. Run the comprehensive test: cd backend && node test-price-matching.js" -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ API test failed: $_" -ForegroundColor Red
    
    # Check Lambda logs
    Write-Host "`nChecking Lambda logs..." -ForegroundColor Yellow
    $logGroupName = "/aws/lambda/boq-matching-system-prod-api"
    
    try {
        $logStreams = aws logs describe-log-streams --log-group-name $logGroupName --order-by LastEventTime --descending --limit 1 | ConvertFrom-Json
        
        if ($logStreams.logStreams) {
            $latestStream = $logStreams.logStreams[0].logStreamName
            Write-Host "Latest log stream: $latestStream" -ForegroundColor Gray
            
            $logs = aws logs get-log-events --log-group-name $logGroupName --log-stream-name $latestStream --limit 30 | ConvertFrom-Json
            
            Write-Host "`n=== Recent Lambda Logs ===" -ForegroundColor Yellow
            foreach ($event in $logs.events) {
                $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds($event.timestamp).LocalDateTime
                Write-Host "[$timestamp] $($event.message)" -ForegroundColor DarkGray
            }
        }
    } catch {
        Write-Host "Could not retrieve logs: $_" -ForegroundColor Red
    }
}

Write-Host "`n[DONE]" -ForegroundColor Green