# Install Node.js from Binary
param([string]$IP = "13.218.146.247")

$key = Get-ChildItem -Path . -Filter "*.pem" | Select-Object -First 1
Write-Host "Installing Node.js from binary..." -ForegroundColor Green

# Install Node.js 16 (compatible with Amazon Linux 2)
Write-Host "`nInstalling Node.js 16..." -ForegroundColor Cyan

$installScript = @'
#!/bin/bash
echo "Downloading Node.js 16..."
cd /tmp
wget https://nodejs.org/dist/v16.20.2/node-v16.20.2-linux-x64.tar.xz
echo "Extracting..."
tar -xf node-v16.20.2-linux-x64.tar.xz
echo "Installing..."
sudo rm -rf /usr/local/node
sudo mv node-v16.20.2-linux-x64 /usr/local/node
echo "Creating symlinks..."
sudo ln -sf /usr/local/node/bin/node /usr/bin/node
sudo ln -sf /usr/local/node/bin/npm /usr/bin/npm
sudo ln -sf /usr/local/node/bin/npx /usr/bin/npx
echo "Verifying installation..."
node --version
npm --version
echo "Done!"
'@

# Save and execute script
$installScript | Out-File -FilePath "install-node.sh" -Encoding ASCII -NoNewline

# Upload and run
Write-Host "Uploading install script..." -ForegroundColor Cyan
scp -o StrictHostKeyChecking=no -i $key.Name install-node.sh "ec2-user@${IP}:~/"

Write-Host "Running installation..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "chmod +x install-node.sh && ./install-node.sh"

# Cleanup
Remove-Item "install-node.sh" -Force

Write-Host "`n✅ Node.js installation complete!" -ForegroundColor Green