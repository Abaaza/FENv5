# 🚀 Quick Solution: Use CloudFront for HTTPS (5 Minutes)

Since you already have Amplify running, here's the FASTEST solution using CloudFront:

## Option 1: CloudFront (Recommended - Free Tier)

### Step 1: Create CloudFront Distribution

1. Go to AWS Console → CloudFront
2. Click "Create Distribution"
3. Settings:
   - **Origin Domain**: `13.218.146.247`
   - **Protocol**: HTTP only
   - **HTTP Port**: 80
   - **Origin Path**: Leave empty
   - **Name**: `boq-api-backend`

4. Default Cache Behavior:
   - **Viewer Protocol Policy**: Redirect HTTP to HTTPS
   - **Allowed HTTP Methods**: GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE
   - **Cache Policy**: CachingDisabled
   - **Origin Request Policy**: AllViewer

5. Click "Create Distribution"
6. Wait 5-10 minutes for deployment

### Step 2: Get Your CloudFront URL

Your CloudFront URL will look like:
```
https://d1234abcd5678.cloudfront.net
```

### Step 3: Update Amplify Environment

In Amplify Console:
1. Go to your app
2. Environment variables
3. Update:
```
REACT_APP_API_URL=https://YOUR-CLOUDFRONT-ID.cloudfront.net/api
```

4. Redeploy your Amplify app

## Option 2: Quick nginx SSL (Self-Signed)

If you want immediate HTTPS on EC2:

```bash
# SSH to your server
ssh -i boq-key-202507161911.pem ec2-user@13.218.146.247

# Generate self-signed certificate
sudo mkdir -p /etc/nginx/ssl
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/nginx.key \
  -out /etc/nginx/ssl/nginx.crt \
  -subj "/CN=13.218.146.247"

# Update nginx config
sudo tee /etc/nginx/conf.d/ssl.conf << 'EOF'
server {
    listen 443 ssl;
    server_name _;
    
    ssl_certificate /etc/nginx/ssl/nginx.crt;
    ssl_certificate_key /etc/nginx/ssl/nginx.key;
    
    location /api {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto https;
    }
}
EOF

# Open port 443 in security group
# Then restart nginx
sudo nginx -t && sudo systemctl restart nginx
```

Then update Amplify to use: `https://13.218.146.247/api`

## Option 3: Quick Fix - Development Only

For testing only, you can:
1. Open Chrome with disabled security:
   ```
   chrome.exe --disable-web-security --user-data-dir="C:/Chrome dev session"
   ```

2. Or in Firefox, go to `about:config` and set:
   ```
   security.mixed_content.block_active_content = false
   ```

## 🎯 Fastest Solution: CloudFront

CloudFront is the best option because:
- ✅ Automatic HTTPS
- ✅ No certificate warnings
- ✅ Free tier (1TB/month)
- ✅ Global CDN
- ✅ No changes to EC2

Just create the distribution and update your Amplify URL!