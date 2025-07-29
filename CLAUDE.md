# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BOQ (Bill of Quantities) Matching System for The Fencing People - AI-powered system to match construction BOQ Excel files to internal price lists. Handles large files (10,000+ items) with multiple matching methods.

## Common Development Commands

### Local Development
```bash
# Install all dependencies
npm run install:all

# Start all services (Convex, Backend, Frontend)
npm run dev

# Individual services
npm run dev:backend      # Backend on port 5000
npm run dev:frontend     # Frontend on port 5173
npm run dev:convex       # Convex database

# Build for production
npm run build:all        # Build backend and frontend
npm run build:production # Deploy Convex + build all
```

### Backend-specific (from backend/)
```bash
npm run dev              # Start with tsx watch
npm run build            # Compile TypeScript
npm start                # Run production build
```

### Frontend-specific (from frontend/)
```bash
npm run dev              # Start Vite dev server
npm run build            # Build for production
npm run lint             # Run ESLint
npm run preview          # Preview production build
```

## High-Level Architecture

### System Flow
```
User Upload → Frontend (React) → Backend API (Express) → Job Queue → Processor → Convex DB
                    ↓                                                      ↓
                Amplify                                              AI Services (V1/V2)
```

### Key Architectural Components

1. **Frontend (React + Vite)**
   - Authentication with JWT stored in localStorage
   - Real-time job progress via polling (5-10s intervals)
   - React Query for caching and state management
   - File upload with progress tracking

2. **Backend (Express + TypeScript)**
   - JWT authentication with access (16h) and refresh (30d) tokens
   - Job processing with rate limiting and retry logic
   - Batch operations to Convex (5 items/batch, 5s delay)
   - LRU cache for AI embeddings

3. **Database (Convex)**
   - Real-time sync with TypeScript-first API
   - Rate limits: 5 items/mutation, 5s between batches
   - Schema-driven with migrations support

4. **Matching Engine**
   - LOCAL: Fuzzy matching with construction patterns
   - V2/V1: AI embeddings with cosine similarity
   - Caching layer for performance

### Critical Rate Limits & Error Handling

```typescript
// Convex operations
const BATCH_SIZE = 5;
const BATCH_DELAY = 5000; // 5 seconds
const MAX_RETRIES = 5;

// Frontend polling
const JOB_STATUS_INTERVAL = 5000;    // 5 seconds
const JOB_LOGS_INTERVAL = 10000;     // 10 seconds
const DASHBOARD_INTERVAL = 30000;    // 30 seconds

// 429 Error handling pattern
await retryWithBackoff(() => operation(), {
  maxRetries: 5,
  initialDelay: 2000,
  shouldRetry: (error) => error?.response?.status === 429
});
```

## Deployment Infrastructure

### Frontend (AWS Amplify)
- Auto-deploys from GitHub main branch
- Environment variables set in amplify.yml
- URL: https://main.d3j084kic0l1ff.amplifyapp.com

### Backend (AWS EC2)
- Location: `/home/ec2-user/app/backend/`
- PM2 process: `tfp-backend`
- Nginx reverse proxy with CloudFront origin
- Entry point: `index.js` (must set JWT secrets)
- CloudFront origin: `origin-tfp.braunwell.io`
- Public API: `api-tfp.braunwell.io`

### Key Deployment Commands
```bash
# Deploy backend to EC2
powershell -File deploy-tfp-backend-quick.ps1

# SSH to EC2
ssh -i Downloads/tfp-boq-key.pem ec2-user@54.90.3.22

# On EC2
pm2 status
pm2 logs tfp-backend --lines 100
pm2 restart tfp-backend

# Fix CORS issues on nginx
sudo nano /etc/nginx/conf.d/tfp-api.conf
sudo nginx -t
sudo systemctl reload nginx
```

### EC2 index.js Template (IMPORTANT)
```javascript
require('dotenv').config();

// JWT secrets MUST be 32+ characters
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'tfp-boq-matching-access-secret-key-2025-secure-production';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'tfp-boq-matching-refresh-secret-key-2025-secure-production-long';
process.env.PORT = process.env.PORT || 5000;
process.env.NODE_ENV = 'production';

const { app } = require("./dist/server");
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
    console.log("[Server] Backend server started on port " + PORT);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
    });
});
```

## Environment Configuration

### Backend (.env)
```env
CONVEX_URL=https://lovely-armadillo-372.convex.cloud
JWT_ACCESS_SECRET=tfp-boq-matching-access-secret-key-2025-secure-production  # Must be 32+ chars
JWT_REFRESH_SECRET=tfp-boq-matching-refresh-secret-key-2025-secure-production-long  # Must be 32+ chars
JWT_ACCESS_EXPIRY=16h
JWT_REFRESH_EXPIRY=30d
V2_API_KEY=your-v2-api-key  # Stored in Convex applicationSettings
V1_API_KEY=your-v1-api-key  # Stored in Convex applicationSettings
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://tfp.braunwell.io
```

### Frontend Production
```env
# For CloudFront/Custom Domain
VITE_API_URL=https://api-tfp.braunwell.io/api
VITE_CONVEX_URL=https://lovely-armadillo-372.convex.cloud

# For direct EC2 access
VITE_API_URL=https://54.90.3.22/api
```

## Critical Implementation Details

### Authentication Flow
- Login returns access token (localStorage) and refresh token (httpOnly cookie)
- Auto-refresh on 401 responses
- Admin user: `abaza@tfp.com` / `abaza123`

### File Processing Pipeline
1. Upload Excel/CSV → Parse with dynamic header detection
2. Create job in Convex → Process in batches of 5
3. Update progress every 25 items → Save results
4. User can view/edit/export results

### Performance Optimizations
- Remove console logs: `node backend/remove-console-logs.js`
- LRU cache for embeddings (1000 items max)
- Batch processing with delays
- Frontend query caching

### Common Issues & Solutions
- **429 Errors**: Implement exponential backoff
- **Job Progress Reset**: Reduce polling frequency  
- **Connection Refused**: Add retry logic
- **JWT Expiry**: Extended to 16 hours
- **JWT Secret Length**: Must be at least 32 characters to avoid Zod validation errors
- **CORS Errors with CloudFront**: Ensure nginx adds CORS headers on origin server
- **V2/V1 Matching Fallback**: Job processor must handle both old (COHERE/OPENAI) and new (V2/V1) method names
- **PM2 Backend Crashes**: Check JWT secrets in index.js are long enough

## Project-Specific Patterns

### Error Handling
```typescript
// Always wrap Convex operations
try {
  await convexWrapper.runWithRetry(operation);
} catch (error) {
  if (error?.response?.status === 429) {
    // Exponential backoff handled automatically
  }
}
```

### Job Processing
```typescript
// Process in batches to avoid rate limits
for (let i = 0; i < items.length; i += BATCH_SIZE) {
  const batch = items.slice(i, i + BATCH_SIZE);
  await processBatch(batch);
  await delay(BATCH_DELAY);
}
```

### Frontend State Management
- Use React Query for server state
- Zustand for client state (auth, UI)
- Avoid frequent re-renders with proper memoization

## Technical Troubleshooting Guide

### AI Matching Falls Back to LOCAL
**Symptom**: All matches use fuzzy matching instead of AI
**Cause**: Job processor's `translateMethodForMatchingService` doesn't handle V2/V1
**Fix**: Update the function to handle both old and new method names:
```typescript
private translateMethodForMatchingService(method: string): 'LOCAL' | 'V2' | 'V1' {
  switch (method) {
    case 'COHERE':
    case 'V2':
      return 'V2';
    case 'OPENAI':
    case 'V1':
      return 'V1';
    case 'LOCAL':
    default:
      return 'LOCAL';
  }
}
```

### CORS Errors with CloudFront
**Symptom**: "No 'Access-Control-Allow-Origin' header" errors
**Cause**: Nginx not configured to add CORS headers for CloudFront origin
**Fix**: Update `/etc/nginx/conf.d/tfp-api.conf`:
```nginx
server {
    listen 80;
    server_name origin-tfp.braunwell.io;
    
    # Add CORS headers
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, PATCH, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;
    
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
        # ... proxy settings
    }
}
```

### Backend Crashes on EC2
**Symptom**: PM2 shows "errored" status, 502 Bad Gateway
**Cause**: JWT secrets too short (Zod validation requires 32+ characters)
**Fix**: Update `/home/ec2-user/app/backend/index.js` with longer secrets (see template above)

### Schema Migration Issues
**Symptom**: "Object is missing the required field" errors
**Cause**: Existing documents don't have new required fields
**Fix**: Make new fields optional in Convex schema:
```typescript
priceItems: defineTable({
  // New fields - all optional for backward compatibility
  name: v.optional(v.string()),
  product_template_variant_value_ids: v.optional(v.string()),
  operation_cost: v.optional(v.number()),
  uom_id: v.optional(v.string()),
  // ... existing fields
})
```