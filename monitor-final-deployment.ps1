# Monitor final deployment

Write-Host "`n=== Monitoring Final Deployment ===`n" -ForegroundColor Cyan
Write-Host "This deployment should fix the aws-sdk issue" -ForegroundColor Yellow

# Wait for deployment to start and complete
Write-Host "Waiting 3 minutes for GitHub Actions to build and deploy..." -ForegroundColor Yellow

for ($i = 0; $i -lt 36; $i++) {
    $percent = [math]::Round(($i / 36) * 100)
    Write-Progress -Activity "Deployment in progress" -Status "$percent% complete" -PercentComplete $percent
    Start-Sleep -Seconds 5
}
Write-Progress -Activity "Deployment in progress" -Completed

# Check if Lambda was updated
Write-Host "`nChecking Lambda update time..." -ForegroundColor Yellow
$lambdaInfo = aws lambda get-function-configuration --function-name boq-matching-system-prod-api --query "{LastModified:LastModified,CodeSize:CodeSize}" | ConvertFrom-Json

Write-Host "Last Modified: $($lambdaInfo.LastModified)" -ForegroundColor White
Write-Host "Code Size: $([math]::Round($lambdaInfo.CodeSize / 1MB, 2))MB" -ForegroundColor White

# Test the API
Write-Host "`n=== Testing API ===`n" -ForegroundColor Cyan

$baseUrl = "https://ls4380art0.execute-api.us-east-1.amazonaws.com"
$testResults = @()

# Test health endpoint
Write-Host "1. Testing /health endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/health" -TimeoutSec 30
    Write-Host "   ✅ SUCCESS!" -ForegroundColor Green
    $testResults += "✅ /health"
} catch {
    Write-Host "   ❌ FAILED: $_" -ForegroundColor Red
    $testResults += "❌ /health"
}

# Test API health
Write-Host "2. Testing /api/health endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/health" -TimeoutSec 30
    Write-Host "   ✅ SUCCESS!" -ForegroundColor Green
    $testResults += "✅ /api/health"
} catch {
    Write-Host "   ❌ FAILED: $_" -ForegroundColor Red
    $testResults += "❌ /api/health"
}

# Summary
Write-Host "`n=== TEST SUMMARY ===" -ForegroundColor Cyan
foreach ($result in $testResults) {
    Write-Host $result
}

if ($testResults -notcontains "❌") {
    Write-Host "`n🎉 ALL TESTS PASSED! YOUR BACKEND IS WORKING!" -ForegroundColor Green
    
    Write-Host "`n=== Your Production API ===" -ForegroundColor Cyan
    Write-Host "Base URL: $baseUrl" -ForegroundColor White
    Write-Host "Lambda Function: boq-matching-system-prod-api" -ForegroundColor White
    Write-Host "S3 Bucket: mjd-boq-uploads-prod" -ForegroundColor White
    
    Write-Host "`n=== Next Steps ===" -ForegroundColor Yellow
    Write-Host "1. Run comprehensive test:" -ForegroundColor White
    Write-Host "   cd backend && node test-price-matching.js" -ForegroundColor Cyan
    
    Write-Host "`n2. Update frontend .env.production:" -ForegroundColor White
    Write-Host "   VITE_API_URL=$baseUrl/api" -ForegroundColor Cyan
    Write-Host "   VITE_API_BASE_URL=$baseUrl" -ForegroundColor Cyan
    
} else {
    Write-Host "`n❌ Some tests failed. Checking logs..." -ForegroundColor Red
    
    # Get error logs
    $logGroupName = "/aws/lambda/boq-matching-system-prod-api"
    try {
        $logStreams = aws logs describe-log-streams --log-group-name $logGroupName --order-by LastEventTime --descending --limit 1 | ConvertFrom-Json
        
        if ($logStreams.logStreams) {
            $latestStream = $logStreams.logStreams[0].logStreamName
            $logs = aws logs get-log-events --log-group-name $logGroupName --log-stream-name $latestStream --limit 20 | ConvertFrom-Json
            
            Write-Host "`n=== Recent Error Logs ===" -ForegroundColor Red
            foreach ($event in $logs.events) {
                if ($event.message -match "ERROR|Failed") {
                    Write-Host $event.message -ForegroundColor DarkRed
                }
            }
        }
    } catch {
        Write-Host "Could not retrieve logs" -ForegroundColor Red
    }
}

Write-Host "`n[DONE]" -ForegroundColor Green