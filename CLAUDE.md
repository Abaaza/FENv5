# CLAUDE.md

This file provides comprehensive guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a BOQ (Bill of Quantities) Matching System for The Fencing People. It is a duplicate of the MJD system, customized for fencing industry pricing. It uses AI-powered matching to map items from construction BOQ Excel files to an internal price list database. The system is designed to handle large Excel files with thousands of items and match them against a price database using multiple methods.

## Architecture Overview

### Technology Stack
- **Frontend**: React 19 with Vite, TypeScript, TailwindCSS, Shadcn/ui components
- **Backend**: Express 5.x with TypeScript, JWT authentication
- **Database**: Convex (real-time database with TypeScript-first API)
- **AI Services**: V1 and V2 for embeddings-based matching
- **Infrastructure**: 
  - Frontend: AWS Amplify (auto-deploys from GitHub)
  - Backend: AWS EC2 instance with PM2 process manager
  - SSL: Nginx reverse proxy with self-signed certificates
- **File Storage**: Local storage on EC2 (can be configured for S3)

### Deployment Architecture

```
Frontend (React) → AWS Amplify → HTTPS → EC2 Instance → Nginx → Express Backend → Convex DB
                                              ↓
                                          PM2 Process Manager
```

## Key Features

1. **Excel File Processing**
   - Supports multiple Excel formats (XLS, XLSX, CSV)
   - Dynamic header detection
   - Handles files with 10,000+ items
   - Context header support (items without quantities)

2. **Matching Methods**
   - LOCAL: Fuzzy string matching with construction-specific patterns
   - V2: AI embeddings using V2 API
   - V1: AI embeddings using V1 API
   - MANUAL: User can manually select matches

3. **Real-time Progress Tracking**
   - WebSocket-like polling for job status
   - Progress bars with percentage completion
   - Live logs display
   - Queue position for pending jobs

4. **Rate Limiting & Error Handling**
   - Exponential backoff for API calls
   - 429 error handling with automatic retry
   - Convex rate limit management
   - Frontend polling optimization

## Critical Configuration

### Environment Variables

**Backend (.env)**
```env
# Database
CONVEX_URL=https://bright-scorpion-424.convex.cloud

# JWT Configuration (minimum 32 characters)
JWT_ACCESS_SECRET=tfp-boq-matching-access-secret-key-2025-secure
JWT_REFRESH_SECRET=tfp-boq-matching-refresh-secret-key-2025-secure
JWT_ACCESS_EXPIRY=16h
JWT_REFRESH_EXPIRY=30d

# API Keys
V2_API_KEY=your-v2-api-key
V1_API_KEY=your-v1-api-key

# Server Configuration
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://main.d3j084kic0l1ff.amplifyapp.com
CORS_ORIGIN=https://main.d3j084kic0l1ff.amplifyapp.com
COOKIE_SECURE=true
```

**Frontend (.env)**
```env
VITE_API_URL=https://13.218.146.247/api
VITE_CONVEX_URL=https://bright-scorpion-424.convex.cloud
```

### EC2 Backend Configuration

**Location**: `/home/ec2-user/app/backend/`

**Key Files**:
- `index.js`: Entry point with environment setup and fetch polyfill
- `dist/`: Compiled TypeScript output
- `.env`: Environment variables

**PM2 Process**: Named `boq-backend`

**Nginx Configuration**: `/etc/nginx/conf.d/boq.conf`
- Proxies HTTPS (443) to backend (5000)
- Handles CORS headers
- SSL with self-signed certificate

### Important Rate Limits

1. **Convex Database**
   - Batch size: 5 items per mutation
   - Delay between batches: 5 seconds
   - Retry attempts: 5 with exponential backoff

2. **Frontend Polling**
   - Job status: 5 seconds
   - Job logs: 10 seconds
   - Dashboard stats: 30 seconds

3. **API Rate Limits**
   - General: 100 requests/minute
   - Job status: 300 requests/minute
   - Job logs: 600 requests/minute

## Key Commands

### Development
```bash
# Install all dependencies
npm run install:all

# Start development servers
npm run dev              # Starts all services
npm run dev:backend      # Backend only
npm run dev:frontend     # Frontend only

# Build for production
npm run build            # Build all
cd backend && npm run build  # Backend only
cd frontend && npm run build # Frontend only
```

### Deployment

**Backend to EC2**:
```powershell
# From project root
powershell -File deploy-backend-ec2-fix.ps1
```

**Frontend to Amplify**:
```bash
# Automatic deployment on git push
git add .
git commit -m "Your changes"
git push origin main
```

### EC2 Management
```bash
# SSH into EC2
ssh -i boq-key-202507161911.pem ec2-user@13.218.146.247

# Check backend status
pm2 status
pm2 logs boq-backend

# Restart backend
pm2 restart boq-backend

# Check Nginx
sudo systemctl status nginx
sudo nginx -t  # Test configuration
```

## Project Structure

```
boq-matching-system/
├── frontend/
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/         # Route pages
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utilities and API client
│   │   └── types/         # TypeScript definitions
│   ├── package.json
│   └── vite.config.ts
├── backend/
│   ├── src/
│   │   ├── controllers/   # Route handlers
│   │   ├── services/      # Business logic
│   │   ├── middleware/    # Express middleware
│   │   ├── utils/         # Utility functions
│   │   ├── config/        # Configuration files
│   │   └── server.ts      # Express app setup
│   ├── index.js           # Entry point for EC2
│   └── package.json
├── convex/
│   ├── schema.ts          # Database schema
│   └── *.ts              # Convex functions
└── amplify.yml           # Amplify build configuration
```

## Critical Implementation Details

### Authentication Flow
1. User logs in with email/password
2. Backend verifies credentials against Convex
3. JWT access token (16h) and refresh token (30d) generated
4. Access token stored in localStorage
5. Refresh token in httpOnly cookie
6. Auto-refresh on 401 responses

### File Upload & Processing Flow
1. User uploads Excel/CSV file
2. File parsed on backend with dynamic header detection
3. Job created in Convex with status tracking
4. Items processed in batches (5 items/batch)
5. Progress updated every 25 items
6. Results saved to Convex
7. User can view, edit, and export results

### Matching Algorithm
1. **LOCAL Method**:
   - Fuzzy string matching
   - Construction-specific patterns
   - Unit normalization
   - Abbreviation expansion

2. **AI Methods (V2/V1)**:
   - Generate embeddings for BOQ items
   - Compare with pre-computed price list embeddings
   - Cosine similarity scoring
   - Cache embeddings for performance

### Error Handling Patterns

1. **429 Rate Limit Errors**:
```typescript
await retryWithBackoff(
  () => api.call(),
  {
    maxRetries: 5,
    initialDelay: 2000,
    shouldRetry: (error) => error?.response?.status === 429
  }
);
```

2. **Connection Errors**:
- Automatic retry with exponential backoff
- No error display to user during retries
- Fallback to cached data when available

### Performance Optimizations

1. **Console Log Removal**:
   - Use `backend/remove-console-logs.js` script
   - Removes logs from performance-critical files

2. **Batch Processing**:
   - Process items in batches of 5
   - Save results every 25 items
   - Delay between Convex operations

3. **Caching**:
   - LRU cache for AI embeddings
   - In-memory job status cache
   - Frontend query caching with React Query

## Known Issues & Solutions

1. **Job Progress Reset**
   - Caused by aggressive polling
   - Solution: Reduced polling to 10s intervals

2. **429 Errors from Convex**
   - Caused by too many simultaneous requests
   - Solution: Batch operations with delays

3. **Connection Refused**
   - Intermittent EC2/network issues
   - Solution: Retry logic with backoff

4. **JWT Expiry**
   - Users logged out after 15 minutes
   - Solution: Extended to 16 hours

## Security Considerations

1. **Authentication**:
   - JWT secrets must be 32+ characters
   - Refresh tokens in httpOnly cookies
   - CORS restricted to Amplify domain

2. **File Upload**:
   - Size limit: 50MB
   - Type validation for Excel/CSV only
   - Sanitized filenames

3. **API Security**:
   - All endpoints require authentication
   - Rate limiting implemented
   - Input validation with Zod

## Monitoring & Debugging

1. **Check Backend Health**:
```bash
curl -k https://13.218.146.247/api/health
```

2. **View Logs**:
```bash
# On EC2
pm2 logs boq-backend --lines 100
tail -f /home/ec2-user/.pm2/logs/boq-backend-error.log
```

3. **Monitor Jobs**:
- Check Projects page for job status
- View browser console for API errors
- Check Network tab for 429 errors

## Testing

### Test Credentials
- Email: `abaza@tfp.com`
- Password: `abaza123`
- Role: Admin

### API Testing
```bash
# Login
curl -k -X POST https://13.218.146.247/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"abaza@tfp.com","password":"abaza123"}'

# Health check
curl -k https://13.218.146.247/api/health
```

## Deployment Checklist

When deploying to a new environment:

1. **Backend Setup**:
   - [ ] Install Node.js 16+ on EC2
   - [ ] Install PM2 globally
   - [ ] Configure Nginx with SSL
   - [ ] Set up environment variables
   - [ ] Install cross-fetch polyfill
   - [ ] Configure firewall for ports 443, 5000

2. **Frontend Setup**:
   - [ ] Update API URL in amplify.yml
   - [ ] Configure Amplify app
   - [ ] Connect GitHub repository
   - [ ] Set up automatic deployments

3. **Database Setup**:
   - [ ] Create Convex project
   - [ ] Deploy schema
   - [ ] Create admin user
   - [ ] Import price list data

4. **Post-Deployment**:
   - [ ] Test authentication
   - [ ] Upload test Excel file
   - [ ] Verify matching works
   - [ ] Check rate limiting
   - [ ] Monitor for errors

## Common Operations

### Update JWT Expiry
```javascript
// In backend/src/config/env.ts
JWT_ACCESS_EXPIRY: z.string().default('16h'),  // Change this value
```

### Change Convex Database
1. Update CONVEX_URL in backend .env
2. Update backend/index.js
3. Restart PM2: `pm2 restart boq-backend`

### Fix Rate Limit Issues
1. Increase delays in jobProcessor.service.ts
2. Reduce batch sizes
3. Implement caching
4. Use ConvexWrapper for automatic retry

### Add New Matching Method
1. Add to MatchingMethod type
2. Implement in matching.service.ts
3. Add UI option in MatchingMethodSelector
4. Update job processor logic

## Tips for Duplication

1. **Change Branding**:
   - Update `frontend/index.html` title
   - Change logo in `frontend/src/components/Layout.tsx`
   - Update color scheme in `frontend/tailwind.config.js`

2. **New Convex Project**:
   - Create new Convex project
   - Update CONVEX_URL everywhere
   - Deploy schema: `npx convex deploy`
   - Create new admin user

3. **New AWS Resources**:
   - Launch new EC2 instance
   - Create new Amplify app
   - Update all URLs and IDs

4. **Domain-Specific Changes**:
   - Modify `constructionPatterns.service.ts` for your industry
   - Update price item schema if needed
   - Adjust matching algorithms

Remember: Always test thoroughly in a staging environment before going to production!