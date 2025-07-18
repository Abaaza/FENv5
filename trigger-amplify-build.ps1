# Trigger Amplify Build Manually

Write-Host "Triggering Amplify Build..." -ForegroundColor Cyan

# Get the latest commit hash
$commitHash = git rev-parse HEAD
Write-Host "Latest commit: $commitHash" -ForegroundColor Yellow

# Start a new build job
Write-Host "`nStarting build job..." -ForegroundColor Yellow
$result = aws amplify start-job `
    --app-id d3j084kic0l1ff `
    --branch-name main `
    --job-type RELEASE `
    --commit-id $commitHash `
    --no-cli-pager 2>&1

if ($LASTEXITCODE -eq 0) {
    $job = $result | ConvertFrom-Json
    Write-Host "[SUCCESS] Build job started!" -ForegroundColor Green
    Write-Host "Job ID: $($job.jobSummary.jobId)" -ForegroundColor Cyan
    Write-Host "Status: $($job.jobSummary.status)" -ForegroundColor Cyan
    Write-Host "`nView build progress at:" -ForegroundColor Yellow
    Write-Host "https://console.aws.amazon.com/amplify/home?region=us-east-1#/d3j084kic0l1ff/main" -ForegroundColor Cyan
} else {
    Write-Host "[ERROR] Failed to start build job:" -ForegroundColor Red
    Write-Host $result -ForegroundColor Red
    
    # Try to check webhook configuration
    Write-Host "`nChecking webhook configuration..." -ForegroundColor Yellow
    $webhooks = aws amplify list-webhooks --app-id d3j084kic0l1ff --no-cli-pager 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Webhooks:" -ForegroundColor Cyan
        Write-Host $webhooks
    }
}