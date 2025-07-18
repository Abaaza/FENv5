#!/bin/bash
# Complete HTTPS Setup on EC2

echo "=== Completing HTTPS Setup ==="

# 1. Create self-signed certificate
echo "Creating SSL certificate..."
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/pki/tls/private/nginx-selfsigned.key \
  -out /etc/pki/tls/certs/nginx-selfsigned.crt \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=13.218.146.247"

# 2. Create strong Diffie-Hellman group
echo "Creating DH parameters (this takes a minute)..."
sudo openssl dhparam -out /etc/pki/tls/certs/dhparam.pem 2048

# 3. Create nginx SSL configuration
echo "Creating nginx SSL configuration..."
sudo tee /etc/nginx/conf.d/ssl.conf > /dev/null << 'EOF'
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name _;

    ssl_certificate /etc/pki/tls/certs/nginx-selfsigned.crt;
    ssl_certificate_key /etc/pki/tls/private/nginx-selfsigned.key;
    ssl_dhparam /etc/pki/tls/certs/dhparam.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # API proxy
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS headers for Amplify
        add_header 'Access-Control-Allow-Origin' 'https://main.d3j084kic0l1ff.amplifyapp.com' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        
        if ($request_method = 'OPTIONS') {
            return 204;
        }
    }

    # Root location
    location / {
        return 200 '{"message":"BOQ API Server","status":"HTTPS enabled","api":"/api/health"}';
        add_header Content-Type application/json;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name _;
    return 301 https://$server_name$request_uri;
}
EOF

# 4. Test nginx configuration
echo "Testing nginx configuration..."
sudo nginx -t

# 5. Reload nginx
echo "Reloading nginx..."
sudo systemctl reload nginx

# 6. Ensure nginx starts on boot
sudo systemctl enable nginx

# 7. Update backend CORS
echo "Updating backend CORS settings..."
cd /home/ec2-user/app
echo "CORS_ORIGIN=https://main.d3j084kic0l1ff.amplifyapp.com" >> .env
pm2 restart all

echo ""
echo "=== ✅ HTTPS Setup Complete! ==="
echo ""
echo "Your API is now available at:"
echo "  https://13.218.146.247/api/health"
echo ""
echo "⚠️  IMPORTANT NEXT STEPS:"
echo "1. Update your Amplify environment variable:"
echo "   REACT_APP_API_URL=https://13.218.146.247/api"
echo ""
echo "2. Your browser will show a certificate warning (normal for self-signed certs)"
echo "   Click 'Advanced' → 'Proceed to site'"
echo ""
echo "3. For production, consider using a real domain with Let's Encrypt"
echo ""
echo "Test with: curl -k https://13.218.146.247/api/health"