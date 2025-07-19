#!/bin/bash
echo "=== Final TFP Nginx Fix ==="

# Disable all conflicting configs
sudo mv /etc/nginx/conf.d/boq-ssl.conf /etc/nginx/conf.d/boq-ssl.conf.disabled 2>/dev/null
sudo mv /etc/nginx/conf.d/direct-access.conf /etc/nginx/conf.d/direct-access.conf.disabled 2>/dev/null

# Create single proper configuration
sudo tee /etc/nginx/conf.d/tfp-api.conf > /dev/null << 'EOF'
# CloudFront origin access (HTTP only)
server {
    listen 80;
    server_name origin-tfp.braunwell.io;
    
    location / {
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

# Test and reload
sudo nginx -t && sudo systemctl reload nginx

echo "=== Fixed! ==="
echo "- origin-tfp.braunwell.io: HTTP only for CloudFront"
echo "- 54.90.3.22: HTTPS with redirect"
echo "- No catch-all redirects"