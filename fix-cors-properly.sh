#!/bin/bash

echo "Fixing CORS configuration properly..."

ssh -i "$HOME/Downloads/tfp-boq-key.pem" ec2-user@54.90.3.22 << 'ENDSSH'
echo "Checking nginx configuration..."

# Find where nginx configs are stored
echo "Looking for nginx configuration files..."
sudo find /etc/nginx -name "*.conf" -type f | head -10

# Check if there's a main nginx.conf
echo -e "\nChecking main nginx.conf..."
sudo grep -A5 -B5 "api-tfp.braunwell.io" /etc/nginx/nginx.conf || echo "Not found in nginx.conf"

# Check conf.d directory
echo -e "\nChecking conf.d directory..."
ls -la /etc/nginx/conf.d/

# If there's an api-tfp config, update it
if [ -f "/etc/nginx/conf.d/api-tfp.conf" ]; then
    echo "Found api-tfp.conf, updating..."
    sudo cp /etc/nginx/conf.d/api-tfp.conf /etc/nginx/conf.d/api-tfp.conf.backup
    
    sudo tee /etc/nginx/conf.d/api-tfp.conf > /dev/null << 'EOF'
server {
    listen 443 ssl;
    server_name api-tfp.braunwell.io;

    ssl_certificate /etc/letsencrypt/live/api-tfp.braunwell.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api-tfp.braunwell.io/privkey.pem;

    # CORS headers
    if ($http_origin ~* (https://tfp\.braunwell\.io|http://localhost:5173)) {
        set $cors "true";
    }

    if ($cors = "true") {
        add_header 'Access-Control-Allow-Origin' "$http_origin" always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, PATCH, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range,X-Total-Count' always;
    }

    if ($request_method = 'OPTIONS') {
        add_header 'Access-Control-Allow-Origin' "$http_origin" always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, PATCH, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
        add_header 'Access-Control-Max-Age' 1728000;
        add_header 'Content-Type' 'text/plain; charset=utf-8';
        add_header 'Content-Length' 0;
        return 204;
    }

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name api-tfp.braunwell.io;
    return 301 https://$server_name$request_uri;
}
EOF
else
    echo "Creating new api-tfp.conf..."
    sudo tee /etc/nginx/conf.d/api-tfp.conf > /dev/null << 'EOF'
server {
    listen 443 ssl;
    server_name api-tfp.braunwell.io;

    ssl_certificate /etc/letsencrypt/live/api-tfp.braunwell.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api-tfp.braunwell.io/privkey.pem;

    # CORS headers
    if ($http_origin ~* (https://tfp\.braunwell\.io|http://localhost:5173)) {
        set $cors "true";
    }

    if ($cors = "true") {
        add_header 'Access-Control-Allow-Origin' "$http_origin" always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, PATCH, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range,X-Total-Count' always;
    }

    if ($request_method = 'OPTIONS') {
        add_header 'Access-Control-Allow-Origin' "$http_origin" always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, PATCH, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
        add_header 'Access-Control-Max-Age' 1728000;
        add_header 'Content-Type' 'text/plain; charset=utf-8';
        add_header 'Content-Length' 0;
        return 204;
    }

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name api-tfp.braunwell.io;
    return 301 https://$server_name$request_uri;
}
EOF
fi

echo "Testing nginx configuration..."
sudo nginx -t

echo "Reloading nginx..."
sudo systemctl reload nginx

echo "Testing CORS headers..."
curl -I -X OPTIONS https://api-tfp.braunwell.io/api/auth/login \
  -H "Origin: https://tfp.braunwell.io" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" 2>/dev/null | grep -i "access-control"

ENDSSH

echo "CORS fix completed!"