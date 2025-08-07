# Quick HTTPS Workaround for BOQ System

## The Problem
Your frontend (Amplify) is served over HTTPS but your backend (EC2) is on HTTP, causing mixed content errors.

## Quick Solutions

### Option 1: Use CloudFront (Recommended)
1. Create a CloudFront distribution for your EC2 backend
2. CloudFront will provide HTTPS endpoint that proxies to your HTTP backend
3. Update frontend to use CloudFront URL

### Option 2: Manual Browser Override (Temporary)
1. Open Chrome/Edge
2. Navigate to: https://44.223.70.138/api/health
3. You'll see a certificate warning
4. Click "Advanced" → "Proceed to 44.223.70.138 (unsafe)"
5. This will allow your browser to accept the self-signed certificate
6. Now your login should work

### Option 3: Use AWS Application Load Balancer
1. Create an ALB with SSL certificate
2. Point it to your EC2 instance
3. Update frontend to use ALB URL

### Option 4: Update Backend on EC2 Manually
SSH into your EC2 instance and run:
```bash
# Install nginx
sudo yum install -y nginx

# Create SSL certificate
sudo mkdir -p /etc/nginx/ssl
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/key.pem \
    -out /etc/nginx/ssl/cert.pem \
    -subj "/C=US/ST=State/L=City/O=TFP/CN=44.223.70.138"

# Create nginx config
sudo tee /etc/nginx/conf.d/boq-https.conf << 'EOF'
server {
    listen 443 ssl;
    server_name _;
    client_max_body_size 50M;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

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
}

server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}
EOF

# Remove old config and restart
sudo rm -f /etc/nginx/conf.d/boq.conf
sudo nginx -t
sudo systemctl restart nginx

# Update backend environment
cd /home/ec2-user/app/backend
echo "FRONTEND_URL=https://main.d2devufp71564t.amplifyapp.com" >> .env
echo "CORS_ORIGIN=https://main.d2devufp71564t.amplifyapp.com" >> .env
pm2 restart boq-backend
```

## Immediate Workaround
While you set up a proper solution, you can:

1. **Allow Insecure Content (Chrome)**:
   - Click the lock icon in the address bar
   - Click "Site settings"
   - Find "Insecure content" and change to "Allow"
   - Reload the page

2. **Use Firefox**: Often more lenient with mixed content

3. **Test locally**: Run the backend locally with ngrok for HTTPS

## Next Steps
The best long-term solution is to use CloudFront or an Application Load Balancer with a proper SSL certificate from AWS Certificate Manager.