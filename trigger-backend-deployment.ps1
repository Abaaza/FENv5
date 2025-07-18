# Trigger Backend-Only Deployment via GitHub Actions

Write-Host "`n=== Triggering Backend Deployment on GitHub ===" -ForegroundColor Cyan

# Check current branch
$branch = git branch --show-current
Write-Host "Current branch: $branch" -ForegroundColor Yellow

# Push any pending changes
$changes = git status --porcelain
if ($changes) {
    Write-Host "`nYou have uncommitted changes:" -ForegroundColor Yellow
    git status --short
    
    $commit = Read-Host "`nCommit and push changes? (y/n)"
    if ($commit -eq 'y') {
        git add .
        git commit -m "Update backend for deployment"
        git push origin $branch
    }
}

# Trigger the BACKEND-ONLY workflow (not the full stack one)
Write-Host "`n[DEPLOY] Triggering backend-only deployment..." -ForegroundColor Cyan
gh workflow run deploy-backend-simple.yml --ref $branch

if ($LASTEXITCODE -eq 0) {
    Write-Host "[SUCCESS] Backend deployment triggered!" -ForegroundColor Green
    
    # Get the run ID
    Start-Sleep -Seconds 3
    $run = gh run list --workflow=deploy-backend-simple.yml --limit=1 --json databaseId,webUrl | ConvertFrom-Json
    
    if ($run) {
        $runId = $run[0].databaseId
        $webUrl = $run[0].webUrl
        
        Write-Host "`nWorkflow started!" -ForegroundColor Green
        Write-Host "Run ID: $runId" -ForegroundColor DarkGray
        Write-Host "View in browser: $webUrl" -ForegroundColor Cyan
        
        # Ask if user wants to watch
        $watch = Read-Host "`nWatch deployment progress? (y/n)"
        if ($watch -eq 'y') {
            Write-Host "`nMonitoring deployment..." -ForegroundColor Yellow
            gh run watch $runId
            
            # Check final status
            $result = gh run view $runId --json conclusion | ConvertFrom-Json
            if ($result.conclusion -eq "success") {
                Write-Host "`n[SUCCESS] Backend deployed successfully!" -ForegroundColor Green
                
                # Test
                Write-Host "`nTesting deployment..." -ForegroundColor Yellow
                Start-Sleep -Seconds 10
                try {
                    $response = Invoke-RestMethod -Uri "https://ls4380art0.execute-api.us-east-1.amazonaws.com/health"
                    Write-Host "[SUCCESS] API is working!" -ForegroundColor Green
                    $response | ConvertTo-Json
                } catch {
                    Write-Host "[WARNING] API test failed - may still be initializing" -ForegroundColor Yellow
                }
            } else {
                Write-Host "`n[ERROR] Deployment failed!" -ForegroundColor Red
                Write-Host "Check logs at: $webUrl" -ForegroundColor Yellow
            }
        } else {
            Write-Host "`nYou can monitor progress at:" -ForegroundColor Yellow
            Write-Host $webUrl -ForegroundColor Cyan
        }
    }
} else {
    Write-Host "[ERROR] Failed to trigger workflow" -ForegroundColor Red
    Write-Host "Make sure the workflow file exists in .github/workflows/" -ForegroundColor Yellow
}

Write-Host "`n[DONE]" -ForegroundColor Green