# 🚀 Fix HTTPS Error with CloudFront (5 Minutes)

## The Problem
Your Amplify app (HTTPS) is blocked from calling your EC2 API (HTTP).

## The Solution: CloudFront (Free & Fast)

### Step 1: Create CloudFront Distribution

1. **Open AWS Console** → Search "CloudFront" → Click "Create Distribution"

2. **Configure Origin:**
   - Origin domain: `13.218.146.247` (your EC2 IP)
   - Protocol: **HTTP only**
   - HTTP port: **80**
   - Origin path: Leave empty
   - Name: `boq-api-origin`

3. **Default Cache Behavior:**
   - Path pattern: **Default (*)**
   - Compress objects: **Yes**
   - Viewer protocol policy: **Redirect HTTP to HTTPS**
   - Allowed HTTP methods: **GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE**
   
4. **Cache Key and Origin Requests:**
   - Cache policy: **CachingDisabled** (important!)
   - Origin request policy: **AllViewer**

5. **Settings:**
   - Price class: **Use only North America and Europe** (cheaper)
   - Alternate domain name: Leave empty
   - Custom SSL certificate: Leave default

6. Click **Create Distribution**

### Step 2: Wait for Deployment (5-10 minutes)

CloudFront will show "Deploying". Get coffee ☕

### Step 3: Get Your CloudFront URL

Once deployed, you'll see:
- Distribution Domain Name: `dxxxxxxxxxx.cloudfront.net`

### Step 4: Update Amplify

1. Go to **AWS Amplify Console**
2. Select your app
3. Go to **Environment variables**
4. Update or add:
   ```
   REACT_APP_API_URL=https://dxxxxxxxxxx.cloudfront.net/api
   ```
   (Replace dxxxxxxxxxx with your actual CloudFront domain)

5. Click **Save** and Amplify will auto-redeploy

### Step 5: Test

After Amplify redeploys (~2 mins), your app should work!

Visit: https://main.d3j084kic0l1ff.amplifyapp.com/login

## ✅ Benefits of CloudFront

- **Free Tier**: 1TB data transfer/month
- **HTTPS**: Automatic SSL certificate
- **Fast**: Global CDN
- **Simple**: No changes to EC2
- **Reliable**: AWS managed

## 🔧 Troubleshooting

If it doesn't work:
1. Make sure CloudFront status is "Deployed" (not "In Progress")
2. Check Amplify environment variables are saved
3. Hard refresh your browser (Ctrl+F5)
4. Check browser console for the new HTTPS URL

## 📝 What Happens Next?

Your app flow will be:
```
Amplify (HTTPS) → CloudFront (HTTPS) → EC2 (HTTP)
     ✅                    ✅              ✅
```

No more mixed content errors!

## Alternative: Quick nginx Solution

If you prefer not to use CloudFront, SSH to your EC2 and run:

```bash
# Install certbot
sudo yum install -y certbot python2-certbot-nginx

# Get free SSL certificate
sudo certbot --nginx -d your-domain.com --non-interactive --agree-tos --email your-email@example.com

# Or for IP (self-signed)
sudo mkdir -p /etc/nginx/ssl
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/nginx.key \
  -out /etc/nginx/ssl/nginx.crt \
  -subj "/CN=13.218.146.247"
```

But CloudFront is easier and better!