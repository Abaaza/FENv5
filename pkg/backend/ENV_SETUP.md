# Environment Variables Setup Guide

## Quick Start

1. **Copy the appropriate template:**
   ```bash
   # For local development
   cp .env.example .env

   # For production/Lambda deployment
   cp .env.production.example .env
   ```

2. **Edit the `.env` file** with your values

3. **Never commit `.env` files** to version control

## Required Environment Variables

### 1. Database Configuration
```env
CONVEX_URL=your_convex_url_here
```
Get this from your Convex dashboard.

### 2. JWT Secrets (Required)
```env
JWT_ACCESS_SECRET=your_32_char_secret_here
JWT_REFRESH_SECRET=your_32_char_secret_here
```

**Generate strong secrets:**
```bash
# Using OpenSSL
openssl rand -base64 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 3. AWS Configuration (For Lambda/S3)
```env
AWS_REGION=us-east-1
AWS_S3_BUCKET=mjd-boq-uploads-prod
```

For local development with AWS:
```env
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
```

**Note:** In Lambda, these are provided by IAM roles automatically.

### 4. Frontend URL
```env
# Local development
FRONTEND_URL=http://localhost:5173

# Production
FRONTEND_URL=https://main.d3j084kic0l1ff.amplifyapp.com
```

## API Keys Management

**IMPORTANT:** API keys are no longer stored in environment variables. They are managed through the database for security.

### Setting API Keys After Deployment

1. **Via Admin Panel:**
   - Login as admin
   - Navigate to Settings > API Keys
   - Update Cohere or OpenAI keys

2. **Via API:**
   ```bash
   # Get your access token first
   ACCESS_TOKEN="your_jwt_token"

   # Update Cohere API key
   curl -X PUT https://your-api-url/api/settings/api-keys/cohere \
     -H "Authorization: Bearer $ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"apiKey": "your-cohere-api-key"}'

   # Update OpenAI API key
   curl -X PUT https://your-api-url/api/settings/api-keys/openai \
     -H "Authorization: Bearer $ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"apiKey": "your-openai-api-key"}'
   ```

## Environment-Specific Settings

### Local Development
```env
NODE_ENV=development
COOKIE_SECURE=false
COOKIE_SAMESITE=lax
ENABLE_DETAILED_LOGGING=true
```

### Production/Lambda
```env
NODE_ENV=production
COOKIE_SECURE=true
COOKIE_SAMESITE=none
ENABLE_DETAILED_LOGGING=false
```

## File Storage

The system uses S3 for file storage. Ensure your S3 bucket exists:

```bash
# Create S3 bucket
aws s3 mb s3://mjd-boq-uploads-prod --region us-east-1

# Set bucket lifecycle (optional)
aws s3api put-bucket-lifecycle-configuration \
  --bucket mjd-boq-uploads-prod \
  --lifecycle-configuration file://s3-lifecycle.json
```

## Troubleshooting

### Missing Environment Variables
- Check `.env` file exists in backend directory
- Verify all required variables are set
- Restart the server after changes

### JWT Errors
- Ensure secrets are at least 32 characters
- Use different secrets for access and refresh tokens
- Don't use special characters that need escaping

### AWS/S3 Errors
- Verify AWS credentials are correct
- Check S3 bucket exists and has proper permissions
- Ensure region matches your bucket location

### Cookie Issues in Production
- Set `COOKIE_SECURE=true` for HTTPS
- Use `COOKIE_SAMESITE=none` for cross-origin requests
- Verify frontend URL is correctly set

## Security Best Practices

1. **Never commit `.env` files**
2. **Use strong, unique JWT secrets**
3. **Rotate API keys regularly**
4. **Use IAM roles in production** instead of access keys
5. **Enable S3 encryption** for file storage
6. **Restrict CORS origins** to your frontend URLs only