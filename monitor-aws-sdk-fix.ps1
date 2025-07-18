# Monitor the aws-sdk fix deployment

Write-Host "`n=== Monitoring AWS SDK Fix Deployment ===`n" -ForegroundColor Cyan

# Get the latest run
$runs = gh run list --workflow=deploy-backend-simple.yml --limit=1 --json databaseId,status,conclusion | ConvertFrom-Json

if ($runs -and $runs.Count -gt 0) {
    $latestRun = $runs[0]
    $runId = $latestRun.databaseId
    
    Write-Host "Latest deployment run ID: $runId" -ForegroundColor Yellow
    Write-Host "Status: $($latestRun.status)" -ForegroundColor White
    
    if ($latestRun.status -eq "in_progress" -or $latestRun.status -eq "queued") {
        Write-Host "`nWatching deployment progress..." -ForegroundColor Yellow
        gh run watch $runId
    }
    
    # Check final status
    $finalRun = gh run view $runId --json conclusion,status | ConvertFrom-Json
    
    if ($finalRun.conclusion -eq "success") {
        Write-Host "`n✅ Deployment successful!" -ForegroundColor Green
        
        # Wait for Lambda to update
        Write-Host "`nWaiting 30 seconds for Lambda to fully update..." -ForegroundColor Yellow
        Start-Sleep -Seconds 30
        
        # Test the API
        Write-Host "`n=== Testing Fixed API ===`n" -ForegroundColor Cyan
        
        try {
            $response = Invoke-RestMethod -Uri "https://ls4380art0.execute-api.us-east-1.amazonaws.com/health" -TimeoutSec 30
            Write-Host "✅ API IS NOW WORKING!" -ForegroundColor Green
            Write-Host "Health Check Response:" -ForegroundColor Yellow
            $response | ConvertTo-Json
            
            # Test /api/health too
            Write-Host "`nTesting /api/health endpoint..." -ForegroundColor Yellow
            $apiResponse = Invoke-RestMethod -Uri "https://ls4380art0.execute-api.us-east-1.amazonaws.com/api/health" -TimeoutSec 30
            Write-Host "✅ /api/health is also working!" -ForegroundColor Green
            $apiResponse | ConvertTo-Json
            
            Write-Host "`n🎉 BACKEND IS FULLY OPERATIONAL!" -ForegroundColor Green
            Write-Host "`n=== Your API Endpoints ===" -ForegroundColor Cyan
            Write-Host "Base URL: https://ls4380art0.execute-api.us-east-1.amazonaws.com" -ForegroundColor White
            Write-Host "Health: https://ls4380art0.execute-api.us-east-1.amazonaws.com/health" -ForegroundColor White
            Write-Host "API Health: https://ls4380art0.execute-api.us-east-1.amazonaws.com/api/health" -ForegroundColor White
            Write-Host "Login: POST https://ls4380art0.execute-api.us-east-1.amazonaws.com/api/auth/login" -ForegroundColor White
            Write-Host "Upload: POST https://ls4380art0.execute-api.us-east-1.amazonaws.com/api/price-matching/upload" -ForegroundColor White
            
            Write-Host "`n=== Next Step ===" -ForegroundColor Yellow
            Write-Host "Run the comprehensive price matching test:" -ForegroundColor White
            Write-Host "cd backend && node test-price-matching.js" -ForegroundColor Cyan
            
        } catch {
            Write-Host "❌ API test failed: $_" -ForegroundColor Red
            
            # Check logs again
            Write-Host "`nChecking Lambda logs for details..." -ForegroundColor Yellow
            $logGroupName = "/aws/lambda/boq-matching-system-prod-api"
            $logStreams = aws logs describe-log-streams --log-group-name $logGroupName --order-by LastEventTime --descending --limit 1 | ConvertFrom-Json
            
            if ($logStreams.logStreams) {
                $latestStream = $logStreams.logStreams[0].logStreamName
                $logs = aws logs get-log-events --log-group-name $logGroupName --log-stream-name $latestStream --limit 20 | ConvertFrom-Json
                
                foreach ($event in $logs.events) {
                    Write-Host $event.message -ForegroundColor DarkGray
                }
            }
        }
    } else {
        Write-Host "`n❌ Deployment failed with conclusion: $($finalRun.conclusion)" -ForegroundColor Red
        Write-Host "Checking deployment logs..." -ForegroundColor Yellow
        gh run view $runId --log-failed
    }
} else {
    Write-Host "No recent deployments found" -ForegroundColor Yellow
}

Write-Host "`n[DONE]" -ForegroundColor Green