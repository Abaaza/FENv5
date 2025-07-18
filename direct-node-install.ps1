# Direct Node.js Installation
param([string]$IP = "13.218.146.247")

$key = Get-ChildItem -Path . -Filter "*.pem" | Select-Object -First 1
Write-Host "Installing Node.js directly on EC2..." -ForegroundColor Green

# Run commands directly via SSH
Write-Host "`nStep 1: Downloading Node.js..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "cd /tmp && wget -q https://nodejs.org/dist/v16.20.2/node-v16.20.2-linux-x64.tar.xz && echo 'Download complete'"

Write-Host "`nStep 2: Extracting..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "cd /tmp && tar -xf node-v16.20.2-linux-x64.tar.xz"

Write-Host "`nStep 3: Installing..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "sudo rm -rf /usr/local/node && sudo mv /tmp/node-v16.20.2-linux-x64 /usr/local/node"

Write-Host "`nStep 4: Creating symlinks..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "sudo ln -sf /usr/local/node/bin/node /usr/bin/node && sudo ln -sf /usr/local/node/bin/npm /usr/bin/npm && sudo ln -sf /usr/local/node/bin/npx /usr/bin/npx"

Write-Host "`nStep 5: Verifying..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "node --version && npm --version"

Write-Host "`n✅ Node.js installed!" -ForegroundColor Green