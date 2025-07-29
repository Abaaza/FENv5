#!/bin/bash

echo "Checking current nginx setup and fixing CORS..."

ssh -i "$HOME/Downloads/tfp-boq-key.pem" ec2-user@54.90.3.22 << 'ENDSSH'
echo "1. Checking current tfp-api.conf..."
echo "======================================="
sudo cat /etc/nginx/conf.d/tfp-api.conf

echo -e "\n2. Checking SSL certificates..."
echo "======================================="
sudo ls -la /etc/letsencrypt/live/

echo -e "\n3. Adding CORS to existing configuration..."
echo "======================================="
# First, let's see what the current config looks like
current_config=$(sudo cat /etc/nginx/conf.d/tfp-api.conf)

# Check if CORS headers already exist
if echo "$current_config" | grep -q "Access-Control-Allow-Origin"; then
    echo "CORS headers already present in configuration!"
else
    echo "Adding CORS headers to configuration..."
    # Get the server_name and ssl paths from current config
    server_names=$(echo "$current_config" | grep "server_name" | head -1 | sed 's/.*server_name\s*//; s/;//')
    ssl_cert=$(echo "$current_config" | grep "ssl_certificate " | head -1 | sed 's/.*ssl_certificate\s*//; s/;//')
    ssl_key=$(echo "$current_config" | grep "ssl_certificate_key" | head -1 | sed 's/.*ssl_certificate_key\s*//; s/;//')
    
    echo "Found server_name: $server_names"
    echo "Found ssl_certificate: $ssl_cert"
    
    # Create new config with CORS
    sudo tee /etc/nginx/conf.d/tfp-api.conf > /dev/null << EOF
server {
    listen 443 ssl;
    server_name $server_names;

    ssl_certificate $ssl_cert;
    ssl_certificate_key $ssl_key;

    # CORS headers
    add_header 'Access-Control-Allow-Origin' '\$http_origin' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, PATCH, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;
    add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range,X-Total-Count' always;

    location / {
        if (\$request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '\$http_origin' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, PATCH, DELETE, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }

        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

server {
    listen 80;
    server_name $server_names;
    return 301 https://\$server_name\$request_uri;
}
EOF
fi

echo -e "\n4. Testing nginx configuration..."
echo "======================================="
sudo nginx -t

if [ $? -eq 0 ]; then
    echo -e "\n5. Reloading nginx..."
    echo "======================================="
    sudo systemctl reload nginx
    
    echo -e "\n6. Testing CORS response..."
    echo "======================================="
    echo "Testing OPTIONS request:"
    curl -s -I -X OPTIONS https://api-tfp.braunwell.io/api/auth/login \
      -H "Origin: https://tfp.braunwell.io" \
      -H "Access-Control-Request-Method: POST" | grep -i "access-control"
    
    echo -e "\nTesting GET request:"
    curl -s -I https://api-tfp.braunwell.io/api/health \
      -H "Origin: https://tfp.braunwell.io" | grep -i "access-control"
else
    echo "Nginx configuration test failed!"
fi

ENDSSH

echo -e "\nDone checking and fixing CORS!"