# Direct SSL Setup
param([string]$IP = "13.218.146.247")

$key = Get-ChildItem -Path . -Filter "*.pem" | Select-Object -First 1

Write-Host "Direct SSL Setup" -ForegroundColor Green
Write-Host "================" -ForegroundColor Green

# Check certificate exists
Write-Host "`nChecking SSL certificate..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "ls -la /etc/pki/tls/certs/nginx.crt /etc/pki/tls/private/nginx.key 2>&1"

# Create SSL config using multiple echo commands to avoid quote issues
Write-Host "`nCreating SSL configuration..." -ForegroundColor Cyan
$commands = @(
    "sudo rm -f /etc/nginx/conf.d/ssl.conf",
    "echo 'server {' | sudo tee /etc/nginx/conf.d/ssl.conf",
    "echo '    listen 443 ssl;' | sudo tee -a /etc/nginx/conf.d/ssl.conf",
    "echo '    server_name _;' | sudo tee -a /etc/nginx/conf.d/ssl.conf",
    "echo '    ' | sudo tee -a /etc/nginx/conf.d/ssl.conf",
    "echo '    ssl_certificate /etc/pki/tls/certs/nginx.crt;' | sudo tee -a /etc/nginx/conf.d/ssl.conf",
    "echo '    ssl_certificate_key /etc/pki/tls/private/nginx.key;' | sudo tee -a /etc/nginx/conf.d/ssl.conf",
    "echo '    ' | sudo tee -a /etc/nginx/conf.d/ssl.conf",
    "echo '    location /api {' | sudo tee -a /etc/nginx/conf.d/ssl.conf",
    "echo '        proxy_pass http://localhost:5000;' | sudo tee -a /etc/nginx/conf.d/ssl.conf",
    "echo '        proxy_set_header Host \$host;' | sudo tee -a /etc/nginx/conf.d/ssl.conf",
    "echo '        proxy_set_header X-Real-IP \$remote_addr;' | sudo tee -a /etc/nginx/conf.d/ssl.conf",
    "echo '        proxy_set_header X-Forwarded-Proto https;' | sudo tee -a /etc/nginx/conf.d/ssl.conf",
    "echo '        ' | sudo tee -a /etc/nginx/conf.d/ssl.conf",
    "echo '        add_header Access-Control-Allow-Origin https://main.d3j084kic0l1ff.amplifyapp.com always;' | sudo tee -a /etc/nginx/conf.d/ssl.conf",
    'echo "        add_header Access-Control-Allow-Methods ''GET, POST, PUT, DELETE, OPTIONS'' always;" | sudo tee -a /etc/nginx/conf.d/ssl.conf',
    'echo "        add_header Access-Control-Allow-Headers ''Authorization, Content-Type'' always;" | sudo tee -a /etc/nginx/conf.d/ssl.conf',
    "echo '        add_header Access-Control-Allow-Credentials true always;' | sudo tee -a /etc/nginx/conf.d/ssl.conf",
    "echo '        ' | sudo tee -a /etc/nginx/conf.d/ssl.conf",
    "echo '        if (\$request_method = OPTIONS) {' | sudo tee -a /etc/nginx/conf.d/ssl.conf",
    "echo '            return 204;' | sudo tee -a /etc/nginx/conf.d/ssl.conf",
    "echo '        }' | sudo tee -a /etc/nginx/conf.d/ssl.conf",
    "echo '    }' | sudo tee -a /etc/nginx/conf.d/ssl.conf",
    "echo '    ' | sudo tee -a /etc/nginx/conf.d/ssl.conf",
    "echo '    location / {' | sudo tee -a /etc/nginx/conf.d/ssl.conf",
    'echo "        return 200 ''{\"status\":\"https-enabled\"}'';" | sudo tee -a /etc/nginx/conf.d/ssl.conf',
    "echo '        add_header Content-Type application/json;' | sudo tee -a /etc/nginx/conf.d/ssl.conf",
    "echo '    }' | sudo tee -a /etc/nginx/conf.d/ssl.conf",
    "echo '}' | sudo tee -a /etc/nginx/conf.d/ssl.conf"
)

foreach ($cmd in $commands) {
    ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" $cmd | Out-Null
}

# Show the created config
Write-Host "`nCreated configuration:" -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "sudo cat /etc/nginx/conf.d/ssl.conf"

# Test and restart
Write-Host "`nTesting nginx configuration..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "sudo nginx -t"

Write-Host "`nRestarting nginx..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "sudo systemctl restart nginx"

# Verify listening on 443
Write-Host "`nVerifying HTTPS port..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "sudo ss -tlnp | grep 443"

# Test HTTPS
Write-Host "`nTesting HTTPS endpoint..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no -i $key.Name "ec2-user@$IP" "curl -k -s https://localhost/ | jq . 2>/dev/null || curl -k -s https://localhost/"

Write-Host "`n✅ HTTPS is now enabled!" -ForegroundColor Green
Write-Host "`nTest these URLs:" -ForegroundColor Yellow
Write-Host "https://$IP/" -ForegroundColor Cyan
Write-Host "https://$IP/api/health" -ForegroundColor Cyan

Write-Host "`n⚠️  Next steps:" -ForegroundColor Yellow
Write-Host "1. In AWS Amplify Console, update environment variable:" -ForegroundColor Cyan
Write-Host "   REACT_APP_API_URL=https://$IP/api" -ForegroundColor White
Write-Host "`n2. Accept the certificate warning when accessing the site" -ForegroundColor Cyan