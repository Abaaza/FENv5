# Install Node.js using Amazon Linux Extras
param([string]$IP = "13.218.146.247")

$key = Get-ChildItem -Path . -Filter "*.pem" | Select-Object -First 1
Write-Host "Installing Node.js via Amazon Linux Extras..." -ForegroundColor Green

# Step 1: List available Node.js versions
Write-Host "`nStep 1: Checking available Node.js versions..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "sudo amazon-linux-extras list | grep -i node"

# Step 2: Enable EPEL first
Write-Host "`nStep 2: Enabling EPEL from Amazon extras..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "sudo amazon-linux-extras install -y epel"

# Step 3: Install Node.js from EPEL
Write-Host "`nStep 3: Installing Node.js..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "sudo yum install -y nodejs npm"

# Step 4: Verify
Write-Host "`nStep 4: Verifying installation..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "node --version && npm --version"

# If that fails, try alternative method
Write-Host "`nIf above failed, trying alternative method..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" @"
if ! command -v node &> /dev/null; then
    echo 'Installing Node.js 16 from binary...'
    cd /tmp
    wget https://nodejs.org/dist/v16.20.2/node-v16.20.2-linux-x64.tar.xz
    tar -xf node-v16.20.2-linux-x64.tar.xz
    sudo cp -r node-v16.20.2-linux-x64/{bin,include,lib,share} /usr/
    node --version
    npm --version
fi
"@

Write-Host "`n✅ Done!" -ForegroundColor Green