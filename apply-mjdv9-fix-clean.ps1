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
    # Upload the script
    scp -o StrictHostKeyChecking=no -i $KEY_FILE fix-https-now.sh "ec2-user@${EC2_IP}:/tmp/fix-https.sh"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Script uploaded successfully!" -ForegroundColor Green
        
        Write-Host "`n2. Executing HTTPS setup on EC2..." -ForegroundColor Yellow
        ssh -o StrictHostKeyChecking=no -i $KEY_FILE ec2-user@$EC2_IP "chmod +x /tmp/fix-https.sh && sudo /tmp/fix-https.sh"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "`n=== HTTPS Setup Complete! ===" -ForegroundColor Green
            Write-Host "`nIMPORTANT NEXT STEPS:" -ForegroundColor Yellow
            Write-Host "1. Open this URL in your browser: https://$EC2_IP/api/health" -ForegroundColor Cyan
            Write-Host "2. Accept the certificate warning (click Advanced then Proceed)" -ForegroundColor Cyan
            Write-Host "3. Try logging in again at: https://main.d2devufp71564t.amplifyapp.com" -ForegroundColor Cyan
            
            # Test the endpoint
            Write-Host "`n3. Testing HTTPS endpoint..." -ForegroundColor Yellow
            try {
                if ($PSVersionTable.PSVersion.Major -ge 6) {
                    $response = Invoke-WebRequest -Uri "https://$EC2_IP/api/health" -Method GET -SkipCertificateCheck -UseBasicParsing
                    Write-Host "HTTPS is working! Status: $($response.StatusCode)" -ForegroundColor Green
                } else {
                    Write-Host "Please verify HTTPS in your browser" -ForegroundColor Yellow
                }
            } catch {
                Write-Host "Certificate not trusted yet - this is normal. Trust it in your browser first." -ForegroundColor Yellow
            }
        } else {
            Write-Host "Failed to execute setup script on EC2" -ForegroundColor Red
        }
    } else {
        Write-Host "Failed to upload script to EC2" -ForegroundColor Red
        Write-Host "SSH command failed. Please check:" -ForegroundColor Yellow
        Write-Host "- Is the EC2 instance running?" -ForegroundColor Gray
        Write-Host "- Is the SSH key correct?" -ForegroundColor Gray
        Write-Host "- Is port 22 open in security group?" -ForegroundColor Gray
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host "`n=== Alternative Manual Steps ===" -ForegroundColor Yellow
Write-Host "If the SSH connection failed, you can manually apply the fix:" -ForegroundColor Gray
Write-Host "1. Use EC2 Instance Connect in AWS Console" -ForegroundColor Gray
Write-Host "2. Copy the contents of fix-https-now.sh" -ForegroundColor Gray
Write-Host "3. Create and run the script on EC2" -ForegroundColor Gray