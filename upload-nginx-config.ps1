# Upload Nginx Config
param([string]$IP = "13.218.146.247")

$key = Get-ChildItem -Path . -Filter "*.pem" | Select-Object -First 1

Write-Host "Uploading nginx configuration..." -ForegroundColor Green

# Upload nginx config
scp -o StrictHostKeyChecking=no -i $key.Name nginx-boq.conf "ec2-user@${IP}:~/"

# Install it
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "sudo cp ~/nginx-boq.conf /etc/nginx/conf.d/boq.conf"

# Test and restart
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "sudo nginx -t && sudo systemctl restart nginx && echo 'Nginx restarted successfully'"

# Check server logs to see why it's not starting
Write-Host "`nChecking why server isn't starting..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "pm2 logs --lines 30 --nostream"

# Check if server is actually running
Write-Host "`nChecking PM2 status..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "pm2 list"

Write-Host "`nApplication should be available at: http://$IP" -ForegroundColor Green