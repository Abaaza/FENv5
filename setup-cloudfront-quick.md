# Quick CloudFront Setup for HTTPS

## The Problem
- Your backend works on HTTP (http://44.223.70.138:5000) ✓
- HTTPS is not configured properly on EC2 ✗
- Amplify frontend requires HTTPS to avoid mixed content ✗

## Fastest Solution: CloudFront (15 minutes)

### Step 1: Create CloudFront Distribution
1. Go to [AWS CloudFront Console](https://console.aws.amazon.com/cloudfront/)
2. Click "Create Distribution"
3. Configure:
   - **Origin Domain**: `44.223.70.138`
   - **Origin Path**: Leave empty
   - **Origin Port**: `5000`
   - **Protocol**: `HTTP only`
   - **Name**: `BOQ-Backend`

4. Default Cache Behavior:
   - **Viewer Protocol Policy**: `Redirect HTTP to HTTPS`
   - **Allowed HTTP Methods**: `GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE`
   - **Cache Policy**: `CachingDisabled`
   - **Origin Request Policy**: `AllViewer`

5. Settings:
   - **Price Class**: `Use only North America and Europe`
   - Leave other settings as default

6. Click "Create Distribution"

### Step 2: Wait for Deployment (10-15 minutes)
- CloudFront will give you a URL like: `d1234abcd.cloudfront.net`
- Status will change from "Deploying" to "Deployed"

### Step 3: Update Frontend
1. Update `frontend/.env`:
```
VITE_API_URL=https://d1234abcd.cloudfront.net/api
```

2. Update `amplify.yml`:
```yaml
- echo "VITE_API_URL=https://d1234abcd.cloudfront.net/api" >> .env.production
```

3. Commit and push:
```bash
git add amplify.yml
git commit -m "Use CloudFront URL for HTTPS"
git push
```

## Alternative: Quick Ngrok Solution (5 minutes)

If you need it working RIGHT NOW:

1. Install ngrok: https://ngrok.com/download
2. Run: `ngrok http 44.223.70.138:5000`
3. Use the HTTPS URL ngrok provides
4. Update frontend with ngrok URL

## Alternative: Application Load Balancer (30 minutes)

More permanent solution:

1. Go to EC2 → Load Balancers
2. Create Application Load Balancer
3. Get free SSL from ACM
4. Point to your EC2 instance
5. Update frontend with ALB URL

## Which Should You Choose?

- **CloudFront**: Best for production, automatic HTTPS, global CDN
- **Ngrok**: Best for testing immediately, temporary solution
- **ALB**: Best if you need advanced routing, health checks

The CloudFront option is recommended as it's free tier eligible and provides HTTPS automatically.