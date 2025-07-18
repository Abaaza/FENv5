# 🔗 Connecting EC2 Backend to AWS Amplify Frontend

## 📋 Current Setup
- **Backend API**: http://13.218.146.247/api (EC2)
- **Frontend**: Can be deployed on AWS Amplify
- **Architecture**: Decoupled frontend/backend

## 🚀 Option 1: Direct Connection (Recommended for Now)

### 1. Update Your Frontend Code

In your frontend React app, update the API configuration:

```javascript
// frontend/src/config/api.js
const API_CONFIG = {
  // For development
  development: {
    baseURL: 'http://localhost:5000/api'
  },
  // For production (your EC2 instance)
  production: {
    baseURL: 'http://13.218.146.247/api'
  }
};

export const API_URL = process.env.NODE_ENV === 'production' 
  ? API_CONFIG.production.baseURL 
  : API_CONFIG.development.baseURL;
```

### 2. Update Your API Service Files

```javascript
// frontend/src/services/api.js
import axios from 'axios';
import { API_URL } from '../config/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
```

### 3. Build Your Frontend

```bash
cd frontend
npm run build
```

### 4. Deploy to Amplify

```bash
# Initialize Amplify (if not already done)
amplify init

# Add hosting
amplify add hosting

# Choose:
# - Hosting with Amplify Console
# - Manual deployment

# Deploy
amplify publish
```

## 🔒 Option 2: Secure Connection with HTTPS (Recommended for Production)

### Problem: Mixed Content
- Amplify serves via HTTPS
- Your EC2 API is HTTP
- Browsers block mixed content

### Solutions:

#### A. Quick Fix - Use CloudFront (Free Tier Eligible)
```bash
# 1. Create CloudFront distribution for your EC2
# 2. Point it to 13.218.146.247
# 3. Enable HTTPS
# 4. Update frontend to use CloudFront URL
```

#### B. Better Solution - Application Load Balancer + ACM
```bash
# 1. Create ALB
# 2. Add SSL certificate from ACM (free)
# 3. Point ALB to your EC2
# 4. Update frontend to use ALB URL
```

## 🛠️ Step-by-Step Amplify Connection

### 1. Prepare Frontend for Amplify

```bash
# In your frontend directory
cd frontend

# Create environment file
echo "REACT_APP_API_URL=http://13.218.146.247/api" > .env.production

# Update your API calls to use process.env.REACT_APP_API_URL
```

### 2. Create Amplify App

**Option A: Via AWS Console**
1. Go to AWS Amplify Console
2. Click "New app" > "Host web app"
3. Choose "Deploy without Git provider"
4. Upload your build folder
5. Set environment variable: `REACT_APP_API_URL = http://13.218.146.247/api`

**Option B: Via Amplify CLI**
```bash
# Install Amplify CLI
npm install -g @aws-amplify/cli

# Configure
amplify configure

# Initialize
amplify init
# Choose:
# - Name: boq-matching-frontend
# - Environment: prod
# - Default editor: Visual Studio Code
# - App type: javascript
# - Framework: react
# - Source: src
# - Distribution: build
# - Build: npm run build
# - Start: npm start

# Add hosting
amplify add hosting
# Choose: Manual Deployment

# Deploy
amplify publish
```

### 3. Handle CORS on Your EC2 Backend

Make sure your backend allows Amplify domain:

```javascript
// backend/src/server.js
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://13.218.146.247',
    'https://your-amplify-app.amplifyapp.com', // Add your Amplify URL
    /\.amplifyapp\.com$/ // Or allow all Amplify domains
  ],
  credentials: true
}));
```

Then redeploy your backend:
```bash
ssh -i boq-key-202507161911.pem ec2-user@13.218.146.247
cd /home/ec2-user/app/backend
# Edit server.js to add CORS
pm2 restart all
```

## 📝 Environment Variables for Amplify

In Amplify Console, add these environment variables:

```
REACT_APP_API_URL=http://13.218.146.247/api
REACT_APP_ENV=production
```

## ⚠️ Important Considerations

### 1. HTTPS Issue
Modern browsers may block HTTP API calls from HTTPS Amplify app. Solutions:
- Enable HTTPS on your EC2 (using Let's Encrypt)
- Use AWS CloudFront
- Use Application Load Balancer with ACM certificate

### 2. CORS Configuration
Ensure your EC2 backend allows requests from your Amplify domain.

### 3. API Gateway Alternative
Consider using API Gateway instead of direct EC2:
- Auto-scaling
- Built-in HTTPS
- Better integration with Amplify
- Usage-based pricing

## 🎯 Recommended Architecture

```
[Amplify Frontend] 
    ↓ HTTPS
[CloudFront Distribution]
    ↓ HTTP (internal)
[EC2 Backend API]
    ↓
[Convex Database]
```

## 🚀 Quick Start Commands

```bash
# 1. Update frontend API URL
cd frontend
echo "REACT_APP_API_URL=http://13.218.146.247/api" > .env.production

# 2. Build frontend
npm run build

# 3. Deploy to Amplify
amplify init
amplify add hosting
amplify publish

# 4. Update backend CORS
ssh -i boq-key-202507161911.pem ec2-user@13.218.146.247
# Add Amplify URL to CORS whitelist
pm2 restart all
```

## 💡 Pro Tips

1. **Use Environment Variables**: Don't hardcode API URLs
2. **Enable CORS**: Configure backend to accept Amplify domain
3. **Add HTTPS**: Required for production
4. **Monitor Costs**: EC2 runs 24/7, consider Lambda for cost optimization
5. **Add Custom Domain**: Both for Amplify and API

Would you like me to help you set up the Amplify deployment with your EC2 backend?