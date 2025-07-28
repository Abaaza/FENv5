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
- PM2 process: `boq-backend`
- Nginx reverse proxy on port 443
- Entry point: `index.js` (with fetch polyfill)

### Key Deployment Commands
```bash
# Deploy backend to EC2
powershell -File deploy-backend-ec2-fix.ps1

# SSH to EC2
ssh -i boq-key-202507161911.pem ec2-user@13.218.146.247

# On EC2
pm2 status
pm2 logs boq-backend
pm2 restart boq-backend
```

## Environment Configuration

### Backend (.env)
```env
CONVEX_URL=https://bright-scorpion-424.convex.cloud
JWT_ACCESS_SECRET=tfp-boq-matching-access-secret-key-2025-secure
JWT_REFRESH_SECRET=tfp-boq-matching-refresh-secret-key-2025-secure
JWT_ACCESS_EXPIRY=16h
JWT_REFRESH_EXPIRY=30d
V2_API_KEY=your-v2-api-key
V1_API_KEY=your-v1-api-key
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://main.d3j084kic0l1ff.amplifyapp.com
```

### Frontend Production (set in amplify.yml)
```env
VITE_API_URL=https://54.90.3.22/api
VITE_CONVEX_URL=https://lovely-armadillo-372.convex.cloud
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