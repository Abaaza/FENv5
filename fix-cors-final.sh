#!/bin/bash

echo "Fixing CORS configuration - Final version..."

ssh -i "$HOME/Downloads/tfp-boq-key.pem" ec2-user@54.90.3.22 << 'ENDSSH'
echo "Found existing config at tfp-api.conf - updating it with CORS headers..."

# Backup existing config
sudo cp /etc/nginx/conf.d/tfp-api.conf /etc/nginx/conf.d/tfp-api.conf.backup-cors

# Update the existing tfp-api.conf with CORS headers
sudo tee /etc/nginx/conf.d/tfp-api.conf > /dev/null << 'EOF'
server {
    listen 443 ssl;
    server_name api-tfp.braunwell.io 54.90.3.22;

    ssl_certificate /etc/letsencrypt/live/api-tfp.braunwell.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api-tfp.braunwell.io/privkey.pem;

    # Always add CORS headers
    add_header 'Access-Control-Allow-Origin' '$http_origin' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, PATCH, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;
    add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range,X-Total-Count' always;

    # Handle OPTIONS preflight requests
    location / {
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '$http_origin' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, PATCH, DELETE, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }

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
    server_name api-tfp.braunwell.io 54.90.3.22;
    return 301 https://$server_name$request_uri;
}
EOF

# Remove the api-tfp.conf if it exists (we're using tfp-api.conf)
if [ -f "/etc/nginx/conf.d/api-tfp.conf" ]; then
    echo "Removing duplicate api-tfp.conf..."
    sudo rm /etc/nginx/conf.d/api-tfp.conf
fi

echo "Testing nginx configuration..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "Configuration is valid. Reloading nginx..."
    sudo systemctl reload nginx
    
    echo -e "\nTesting CORS headers..."
    curl -s -I -X OPTIONS https://api-tfp.braunwell.io/api/auth/login \
      -H "Origin: https://tfp.braunwell.io" \
      -H "Access-Control-Request-Method: POST" \
      -H "Access-Control-Request-Headers: Content-Type" | grep -i "access-control" || echo "No CORS headers found in response"
    
    echo -e "\nTesting regular GET request..."
    curl -s -I https://api-tfp.braunwell.io/api/health \
      -H "Origin: https://tfp.braunwell.io" | grep -i "access-control" || echo "No CORS headers in GET response"
else
    echo "Configuration test failed! Restoring backup..."
    sudo cp /etc/nginx/conf.d/tfp-api.conf.backup-cors /etc/nginx/conf.d/tfp-api.conf
    sudo nginx -t
    sudo systemctl reload nginx
fi

ENDSSH

echo -e "\nCORS fix completed! You should now be able to access the API from tfp.braunwell.io"