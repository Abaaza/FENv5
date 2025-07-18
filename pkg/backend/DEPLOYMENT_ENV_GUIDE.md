# Environment Variables Deployment Guide

## Overview
This guide explains where and how to set environment variables for your BOQ Matching System.

## Architecture
- **Frontend**: Hosted on AWS Amplify
- **Backend**: AWS Lambda functions (via API Gateway)
- **Database**: Convex
- **File Storage**: AWS S3

## Where to Set Environment Variables

### 1. **For Local Development** → `.env` file
```bash
cd backend
cp .env.example .env
# Edit .env with your local values
```

### 2. **For Production** → Use one of these methods:

#### Option A: AWS Lambda Console (Easiest)
1. Go to AWS Lambda Console
2. Find your function (e.g., `boq-matching-system-prod-app`)
3. Configuration → Environment variables
4. Add:
   ```
   CONVEX_URL=your_convex_url
   JWT_ACCESS_SECRET=your_32_char_secret
   JWT_REFRESH_SECRET=your_32_char_secret
   ```

#### Option B: Using AWS CLI
```bash
aws lambda update-function-configuration \
  --function-name boq-matching-system-prod-app \
  --environment Variables="{
    CONVEX_URL=your_convex_url,
    JWT_ACCESS_SECRET=your_32_char_secret,
    JWT_REFRESH_SECRET=your_32_char_secret
  }"
```

#### Option C: During Deployment (Recommended)
Set them in your terminal before deploying:
```bash
# Windows
set CONVEX_URL=your_convex_url
set JWT_ACCESS_SECRET=your_32_char_secret
set JWT_REFRESH_SECRET=your_32_char_secret

# Mac/Linux
export CONVEX_URL=your_convex_url
export JWT_ACCESS_SECRET=your_32_char_secret
export JWT_REFRESH_SECRET=your_32_char_secret

# Then deploy
npm run deploy:lambda
```

## DO NOT Set These In:

### ❌ **Amplify Environment Variables**
- Amplify env vars are for the frontend only
- Your backend runs on Lambda, not Amplify
- Setting them in Amplify won't affect your Lambda functions

### ❌ **Committed .env Files**
- Never commit .env files with real values
- Use .env.example as a template only

## Required Environment Variables

| Variable | Where to Set | Description |
|----------|--------------|-------------|
| `CONVEX_URL` | Lambda | Your Convex database URL |
| `JWT_ACCESS_SECRET` | Lambda | 32+ character secret for access tokens |
| `JWT_REFRESH_SECRET` | Lambda | 32+ character secret for refresh tokens |

## Optional Environment Variables

These have defaults in serverless.yml:
- `FRONTEND_URL` - Defaults to your Amplify URL
- `AWS_S3_BUCKET` - Defaults to mjd-boq-uploads-prod
- `NODE_ENV` - Set to production automatically

## API Keys (Cohere/OpenAI)

**DO NOT set as environment variables!** 
They are stored in the database for security.

After deployment, set them via:
1. Admin Panel: Settings → API Keys
2. API call:
   ```bash
   curl -X PUT https://your-api-url/api/settings/api-keys/cohere \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"apiKey": "your-cohere-key"}'
   ```

## Step-by-Step Deployment

1. **Set environment variables in your terminal:**
   ```bash
   export CONVEX_URL="your-convex-url"
   export JWT_ACCESS_SECRET="your-32-char-secret"
   export JWT_REFRESH_SECRET="your-32-char-secret"
   ```

2. **Deploy to Lambda:**
   ```bash
   cd backend
   npm run deploy:lambda
   ```

3. **After deployment, set API keys:**
   - Login to your app as admin
   - Go to Settings → API Keys
   - Add your Cohere and OpenAI keys

## Verification

Check if environment variables are set correctly:

```bash
# Check Lambda function configuration
aws lambda get-function-configuration \
  --function-name boq-matching-system-prod-app \
  --query 'Environment.Variables'
```

## Common Issues

### "Environment variable not found"
- Make sure you set them in Lambda, not Amplify
- Verify they're set using AWS Console or CLI

### "JWT secret too short"
- Ensure secrets are at least 32 characters
- Generate with: `openssl rand -base64 32`

### "Cannot connect to Convex"
- Verify CONVEX_URL is correct
- Check it starts with https://

## Security Best Practices

1. **Use AWS Systems Manager Parameter Store** for production:
   ```bash
   aws ssm put-parameter \
     --name "/boq-system/jwt-access-secret" \
     --value "your-secret" \
     --type "SecureString"
   ```

2. **Use IAM roles** instead of AWS access keys
3. **Rotate secrets** regularly
4. **Never expose** secrets in logs or error messages