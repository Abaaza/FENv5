#!/bin/bash
# Fix HTTPS Setup on EC2 - Based on MJDv9 solution

echo "=== Setting up HTTPS on EC2 (MJDv9 method) ==="

# Your current EC2 IP
EC2_IP="44.223.70.138"
AMPLIFY_URL="https://main.d2devufp71564t.amplifyapp.com"

# 1. Create self-signed certificate
echo "Creating SSL certificate for $EC2_IP..."
sudo mkdir -p /etc/pki/tls/private /etc/pki/tls/certs
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/pki/tls/private/nginx-selfsigned.key \
  -out /etc/pki/tls/certs/nginx-selfsigned.crt \
  -subj "/C=US/ST=State/L=City/O=TFP/CN=$EC2_IP"

# 2. Create nginx SSL configuration
echo "Creating nginx HTTPS configuration..."
sudo tee /etc/nginx/conf.d/boq-ssl.conf > /dev/null << EOF
server {
    listen 443 ssl;
    server_name _;
    client_max_body_size 50M;

    ssl_certificate /etc/pki/tls/certs/nginx-selfsigned.crt;
    ssl_certificate_key /etc/pki/tls/private/nginx-selfsigned.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # API proxy
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        
        # CORS headers - let backend handle them
    }

    # Health check endpoint
    location /health {
        return 200 '{"status":"ok","server":"nginx-ssl"}';
        add_header Content-Type application/json;
    }

    location / {
        return 404;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name _;
    return 301 https://\$host\$request_uri;
}
EOF

# 3. Remove old nginx config if exists
echo "Removing old nginx configurations..."
sudo rm -f /etc/nginx/conf.d/boq.conf
sudo rm -f /etc/nginx/conf.d/default.conf

# 4. Test nginx configuration
echo "Testing nginx configuration..."
sudo nginx -t

if [ $? -eq 0 ]; then
    # 5. Restart nginx
    echo "Restarting nginx..."
    sudo systemctl restart nginx
    sudo systemctl enable nginx

    # 6. Update backend environment
    echo "Updating backend CORS settings..."
    cd /home/ec2-user/app/backend
    
    # Update .env file
    if grep -q "FRONTEND_URL" .env; then
        sed -i "s|FRONTEND_URL=.*|FRONTEND_URL=$AMPLIFY_URL|" .env
    else
        echo "FRONTEND_URL=$AMPLIFY_URL" >> .env
    fi
    
    if grep -q "CORS_ORIGIN" .env; then
        sed -i "s|CORS_ORIGIN=.*|CORS_ORIGIN=$AMPLIFY_URL|" .env
    else
        echo "CORS_ORIGIN=$AMPLIFY_URL" >> .env
    fi

    # 7. Restart backend
    echo "Restarting backend application..."
    pm2 restart boq-backend

    echo ""
    echo "=== ✅ HTTPS Setup Complete! ==="
    echo ""
    echo "Your API is now available at:"
    echo "  https://$EC2_IP/api/health"
    echo ""
    echo "⚠️  IMPORTANT: Browser Certificate Trust"
    echo "1. Open https://$EC2_IP/api/health in your browser"
    echo "2. You'll see a certificate warning - this is normal"
    echo "3. Click 'Advanced' → 'Proceed to $EC2_IP (unsafe)'"
    echo "4. Once trusted, your Amplify app can connect"
    echo ""
    echo "Testing the endpoint..."
    curl -k https://localhost/api/health && echo " ✓ HTTPS is working!"
else
    echo "❌ Nginx configuration test failed!"
    echo "Please check the configuration and try again."
fi