# Monitor Lambda logs in real-time

Write-Host "`n=== Lambda Live Log Monitor ===`n" -ForegroundColor Cyan

$logGroupName = "/aws/lambda/boq-matching-system-prod-api"

Write-Host "Starting live log stream for: $logGroupName" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop monitoring" -ForegroundColor Gray
Write-Host "`n" -ForegroundColor White

# Start tailing logs
aws logs tail $logGroupName --follow --format short