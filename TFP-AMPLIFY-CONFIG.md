# The Fencing People - Amplify Configuration

## Environment Variables for AWS Amplify

Add these environment variables to your Amplify app:

### API Configuration
```
VITE_API_URL=http://44.223.70.138:5000/api
```
Note: For production, use HTTPS after configuring Nginx:
```
VITE_API_URL=https://44.223.70.138/api
```

### Convex Database Configuration
```
VITE_CONVEX_URL=https://bright-scorpion-424.convex.cloud
```

## Summary of URLs

- **Backend API (HTTP)**: `http://44.223.70.138:5000/api`
- **Backend API (HTTPS)**: `https://44.223.70.138/api` (pending Nginx configuration)
- **Convex Database**: `https://bright-scorpion-424.convex.cloud`
- **Frontend (Amplify)**: `https://main.d2devufp71564t.amplifyapp.com`

## How to Update Amplify

1. Go to AWS Amplify Console
2. Select your app
3. Go to "Environment variables" in the app settings
4. Add or update the variables above
5. Trigger a new build or redeploy

## Test Credentials
- Email: `abaza@tfp.com`
- Password: `abaza123`