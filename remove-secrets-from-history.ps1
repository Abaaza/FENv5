# Remove Secrets from Git History

Write-Host "`n=== Removing Secrets from Git History ===" -ForegroundColor Cyan
Write-Host "[WARNING] This will rewrite Git history!" -ForegroundColor Yellow

# Check current status
Write-Host "`nCurrent branch: " -NoNewline
git branch --show-current

Write-Host "`nThe error shows secrets in these files:" -ForegroundColor Yellow
Write-Host "- add-github-secrets.ps1 (line 19 and 25)" -ForegroundColor White
Write-Host "- Commit: b2f2b72e660305740171026fe3579a69abce1fb4" -ForegroundColor DarkGray

$continue = Read-Host "`nContinue with removing secrets? (y/n)"
if ($continue -ne 'y') { exit }

# Option 1: Remove the file completely from history
Write-Host "`n[1] Removing add-github-secrets.ps1 from Git history..." -ForegroundColor Yellow

# Use git filter-branch to remove the file
git filter-branch --force --index-filter `
  "git rm --cached --ignore-unmatch add-github-secrets.ps1" `
  --prune-empty --tag-name-filter cat -- --all

Write-Host "[SUCCESS] File removed from history" -ForegroundColor Green

# Clean up
Write-Host "`n[2] Cleaning up Git..." -ForegroundColor Yellow
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push
Write-Host "`n[3] Force pushing to GitHub..." -ForegroundColor Yellow
Write-Host "[WARNING] This will overwrite remote history!" -ForegroundColor Red

$push = Read-Host "`nForce push to main branch? (y/n)"
if ($push -eq 'y') {
    git push origin main --force
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[SUCCESS] History rewritten and pushed!" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] Push failed" -ForegroundColor Red
    }
}

Write-Host "`n[DONE] Secrets removed from history" -ForegroundColor Green
Write-Host "`nYou can now:" -ForegroundColor Yellow
Write-Host "1. Check deployment status: .\check-deployment-status.ps1" -ForegroundColor White
Write-Host "2. Trigger new deployment: .\trigger-backend-deployment.ps1" -ForegroundColor White