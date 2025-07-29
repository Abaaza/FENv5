#!/bin/bash

echo "Restoring original nginx configuration..."

ssh -i "$HOME/Downloads/tfp-boq-key.pem" ec2-user@54.90.3.22 << 'ENDSSH'
echo "Restoring original tfp-api.conf..."

# Restore from backup if it exists
if [ -f "/etc/nginx/conf.d/tfp-api.conf.backup-cors" ]; then
    sudo cp /etc/nginx/conf.d/tfp-api.conf.backup-cors /etc/nginx/conf.d/tfp-api.conf
    echo "Restored from backup"
else
    # Recreate the original configuration
    sudo tee /etc/nginx/conf.d/tfp-api.conf > /dev/null << 'EOF'
# CloudFront origin access (HTTP only)
server {
    listen 80;
    server_name origin-tfp.braunwell.io;
    
    # Add CORS headers for CloudFront
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, PATCH, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;
    add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range,X-Total-Count' always;
    
    location / {
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '*' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, PATCH, DELETE, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }
        
        proxy_pass http://localhost:5000;
        proxy_set_header Host api-tfp.braunwell.io;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
    }
}

# Direct IP HTTPS access
server {
    listen 443 ssl;
    server_name 54.90.3.22;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    # Add CORS headers
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, PATCH, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;
    add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range,X-Total-Count' always;
    
    location / {
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '*' always;
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

# Direct IP HTTP to HTTPS redirect
server {
    listen 80;
    server_name 54.90.3.22;
    return 301 https://$server_name$request_uri;
}

# Default server block for other requests (don't redirect)
server {
    listen 80 default_server;
    server_name _;
    return 444;  # Close connection without response
}
EOF
    echo "Created new configuration with CORS headers"
fi

echo "Testing nginx configuration..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "Reloading nginx..."
    sudo systemctl reload nginx
    echo "Configuration reloaded successfully!"
    
    # Test the endpoints
    echo -e "\nTesting origin endpoint (CloudFront):"
    curl -s -I -X OPTIONS http://origin-tfp.braunwell.io/api/auth/login \
      -H "Origin: https://tfp.braunwell.io" | head -20
    
    echo -e "\nTesting direct IP endpoint:"
    curl -s -I -X OPTIONS https://54.90.3.22/api/auth/login -k \
      -H "Origin: https://tfp.braunwell.io" | head -20
else
    echo "Configuration test failed!"
fi

ENDSSH

echo -e "\nConfiguration updated. The CORS headers should now be properly set."