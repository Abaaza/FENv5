# Manual HTTPS Fix Using AWS Console

Since SSH isn't working, here's how to fix HTTPS using EC2 Instance Connect:

## Step 1: Connect to EC2 via AWS Console
1. Go to [AWS EC2 Console](https://console.aws.amazon.com/ec2/)
2. Find your instance (IP: 54.90.3.22)
3. Select it and click "Connect"
4. Choose "EC2 Instance Connect"
5. Click "Connect"

## Step 2: Run These Commands in the Browser Terminal

Copy and paste these commands one by one:

```bash
# 1. Create SSL certificate
sudo mkdir -p /etc/pki/tls/private /etc/pki/tls/certs
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/pki/tls/private/nginx-selfsigned.key \
  -out /etc/pki/tls/certs/nginx-selfsigned.crt \
  -subj "/C=US/ST=State/L=City/O=TFP/CN=54.90.3.22"

# 2. Create nginx HTTPS config
sudo tee /etc/nginx/conf.d/boq-ssl.conf > /dev/null << 'EOF'
server {
    listen 443 ssl;
    server_name _;
    client_max_body_size 50M;

    ssl_certificate /etc/pki/tls/certs/nginx-selfsigned.crt;
    ssl_certificate_key /etc/pki/tls/private/nginx-selfsigned.key;

    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    location /health {
        return 200 '{"status":"ok"}';
        add_header Content-Type application/json;
    }
}

server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}
EOF

# 3. Remove old config and restart nginx
sudo rm -f /etc/nginx/conf.d/boq.conf
sudo nginx -t
sudo systemctl restart nginx

# 4. Update backend CORS
cd /home/ec2-user/app/backend
echo "FRONTEND_URL=https://main.d2devufp71564t.amplifyapp.com" >> .env
echo "CORS_ORIGIN=https://main.d2devufp71564t.amplifyapp.com" >> .env
pm2 restart boq-backend

# 5. Test
curl -k https://localhost/api/health
```

## Step 3: Trust the Certificate in Your Browser
1. Open https://54.90.3.22/api/health in your browser
2. You'll see a certificate warning
3. Click "Advanced" → "Proceed to 54.90.3.22 (unsafe)"
4. You should see: `{"status":"ok"}`

## Step 4: Test Your Application
1. Go to https://main.d2devufp71564t.amplifyapp.com
2. Try logging in - it should work now!

## If nginx fails to start:
Check if another process is using port 443:
```bash
sudo lsof -i :443
sudo fuser -k 443/tcp  # Kill process using port 443
sudo systemctl restart nginx
```

## Alternative: Use EC2 Security Group
Make sure your EC2 security group allows:
- Port 443 (HTTPS) from anywhere (0.0.0.0/0)
- Port 80 (HTTP) from anywhere (0.0.0.0/0)
- Port 22 (SSH) from your IP

## Why This Works
This is exactly how MJDv9 was fixed:
1. Self-signed SSL certificate on nginx
2. nginx proxies HTTPS (443) → HTTP (5000)
3. Browser trusts the certificate after manual acceptance
4. No more mixed content errors!