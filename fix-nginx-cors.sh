#!/bin/bash

echo "Fixing CORS on api-tfp.braunwell.io..."

ssh -i "$HOME/Downloads/tfp-boq-key.pem" ec2-user@54.90.3.22 << 'ENDSSH'
echo "Creating nginx configuration with proper CORS headers..."

# Create the correct nginx configuration
sudo tee /etc/nginx/sites-available/api-tfp.braunwell.io > /dev/null << 'EOF'
server {
    listen 443 ssl;
    server_name api-tfp.braunwell.io;

    ssl_certificate /etc/letsencrypt/live/api-tfp.braunwell.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api-tfp.braunwell.io/privkey.pem;

    # CORS headers - ALWAYS add these headers
    add_header 'Access-Control-Allow-Origin' '$http_origin' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, PATCH, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
    add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range,X-Total-Count' always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;

    # Handle preflight OPTIONS requests
    if ($request_method = 'OPTIONS') {
        add_header 'Access-Control-Allow-Origin' '$http_origin' always;
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
        
        # Pass CORS headers from backend
        proxy_pass_header Access-Control-Allow-Origin;
        proxy_pass_header Access-Control-Allow-Methods;
        proxy_pass_header Access-Control-Allow-Headers;
        proxy_pass_header Access-Control-Allow-Credentials;
    }
}

server {
    listen 80;
    server_name api-tfp.braunwell.io;
    return 301 https://$server_name$request_uri;
}
EOF

echo "Testing nginx configuration..."
sudo nginx -t

echo "Reloading nginx..."
sudo systemctl reload nginx

echo "CORS fix applied! Testing the configuration..."
curl -I -X OPTIONS https://api-tfp.braunwell.io/api/auth/login \
  -H "Origin: https://tfp.braunwell.io" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type"

ENDSSH

echo "Done! CORS should now be working properly."