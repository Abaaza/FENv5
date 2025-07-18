#!/usr/bin/env pwsh
# Apply the MJDv9 HTTPS solution to FENv5

$EC2_IP = "54.90.3.22"
$KEY_FILE = "boq-key-202507161911.pem"

Write-Host "=== Applying MJDv9 HTTPS Solution ===" -ForegroundColor Green

# Check if key file exists
if (-not (Test-Path $KEY_FILE)) {
    Write-Host "ERROR: SSH key file not found: $KEY_FILE" -ForegroundColor Red
    Write-Host "Looking for key files..." -ForegroundColor Yellow
    Get-ChildItem -Filter "*.pem" | ForEach-Object {
        Write-Host "Found: $($_.Name)" -ForegroundColor Gray
    }
    exit 1
}

Write-Host "`n1. Uploading fix script to EC2..." -ForegroundColor Yellow
try {
    # Convert script to Unix line endings
    $scriptContent = Get-Content "fix-https-now.sh" -Raw
    $scriptContent = $scriptContent -replace "`r`n", "`n"
    $scriptContent | Out-File -FilePath "fix-https-now-unix.sh" -Encoding UTF8 -NoNewline
    
    # Upload the script
    scp -o StrictHostKeyChecking=no -i $KEY_FILE fix-https-now-unix.sh ec2-user@${EC2_IP}:/tmp/fix-https.sh
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Script uploaded successfully!" -ForegroundColor Green
        
        Write-Host "`n2. Executing HTTPS setup on EC2..." -ForegroundColor Yellow
        ssh -o StrictHostKeyChecking=no -i $KEY_FILE ec2-user@$EC2_IP "chmod +x /tmp/fix-https.sh && sudo /tmp/fix-https.sh"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "`n=== HTTPS Setup Complete! ===" -ForegroundColor Green
            Write-Host "`nIMPORTANT NEXT STEPS:" -ForegroundColor Yellow
            Write-Host "1. Open this URL in your browser: https://$EC2_IP/api/health" -ForegroundColor Cyan
            Write-Host "2. Accept the certificate warning (click Advanced → Proceed)" -ForegroundColor Cyan
            Write-Host "3. Try logging in again at: https://main.d2devufp71564t.amplifyapp.com" -ForegroundColor Cyan
            
            # Test the endpoint
            Write-Host "`n3. Testing HTTPS endpoint..." -ForegroundColor Yellow
            try {
                $response = Invoke-WebRequest -Uri "https://$EC2_IP/api/health" -Method GET -SkipCertificateCheck -UseBasicParsing
                Write-Host "✓ HTTPS is working! Status: $($response.StatusCode)" -ForegroundColor Green
            } catch {
                Write-Host "Certificate not trusted yet - this is normal. Trust it in your browser first." -ForegroundColor Yellow
            }
        } else {
            Write-Host "Failed to execute setup script on EC2" -ForegroundColor Red
        }
    } else {
        Write-Host "Failed to upload script to EC2" -ForegroundColor Red
    }
    
    # Cleanup
    Remove-Item -Force "fix-https-now-unix.sh" -ErrorAction SilentlyContinue
    
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host "`n=== Alternative Manual Steps ===" -ForegroundColor Yellow
Write-Host "If the above didn't work, you can:" -ForegroundColor Gray
Write-Host "1. Copy the contents of fix-https-now.sh" -ForegroundColor Gray
Write-Host "2. SSH into EC2: ssh -i $KEY_FILE ec2-user@$EC2_IP" -ForegroundColor Gray
Write-Host "3. Create the script: nano /tmp/fix-https.sh" -ForegroundColor Gray
Write-Host "4. Paste the contents and save" -ForegroundColor Gray
Write-Host "5. Run: chmod +x /tmp/fix-https.sh && sudo /tmp/fix-https.sh" -ForegroundColor Gray