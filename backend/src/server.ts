import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import path from 'path';
import { env, isDevelopment } from './config/env';
import authRoutes from './routes/auth.routes';
import dashboardRoutes from './routes/dashboard.routes';
import priceMatchingRoutes from './routes/priceMatching.routes';
import priceListRoutes from './routes/priceList.routes';
import adminRoutes from './routes/admin.routes';
import clientsRoutes from './routes/clients.routes';
import projectsRoutes from './routes/projects.routes';
import jobsRoutes from './routes/jobs.routes';
import healthRoutes from './routes/health.routes';
import monitoringRoutes from './routes/monitoring.routes';
// import asyncJobsRoutes from './routes/asyncJobs.routes';
import { fileStorage } from './services/fileStorage.service';
import { jobProcessor } from './services/jobProcessor.service';
import { convexRateLimiter } from './middleware/convexRateLimit';

// __dirname is available in CommonJS after compilation
// For TypeScript, we'll handle it conditionally
declare const __dirname: string;

const app = express();

// Export for Lambda
export { app };

// Trust proxy for rate limiting behind Nginx
app.set('trust proxy', true);

// Security middleware with enhanced configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// CORS configuration for serverless
app.use(cors({
  origin: true, // Allow all origins - serverless.yml will handle CORS at API Gateway level
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['X-Total-Count'],
  maxAge: 86400, // 24 hours
}));

// Debug middleware for Lambda - disabled to reduce log noise
// app.use((req, res, next) => {
//   console.log('[Debug] Raw request info:');
//   console.log('[Debug] Method:', req.method);
//   console.log('[Debug] URL:', req.url);
//   console.log('[Debug] Headers:', req.headers);
//   console.log('[Debug] Body (before parsing):', req.body);
//   next();
// });

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Debug middleware after body parsing - disabled to reduce log noise
// app.use((req, res, next) => {
//   if (req.method === 'POST' && req.url.includes('/auth/login')) {
//     console.log('[Debug] After body parsing:');
//     console.log('[Debug] Body:', req.body);
//     console.log('[Debug] Body type:', typeof req.body);
//   }
//   next();
// });

// Compression
app.use(compression());

// Logging with reduced verbosity for polling endpoints
const morganMiddleware = isDevelopment ? morgan('dev') : morgan('combined');
app.use((req, res, next) => {
  // Skip logging for frequent polling endpoints
  if (req.path.includes('/status') || req.path.includes('/logs')) {
    return next();
  }
  morganMiddleware(req, res, next);
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
});

// More lenient rate limit for status endpoints (polling)
const statusLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300, // Allow 300 requests per minute (5 per second)
  message: 'Too many status requests, please slow down polling',
  skipSuccessfulRequests: true, // Only count failed requests
  standardHeaders: true,
  legacyHeaders: false,
});

// Very lenient rate limit for logs endpoint (high frequency polling)
const logsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 600, // Allow 600 requests per minute (10 per second)
  message: 'Too many log requests',
  skipSuccessfulRequests: true, // Only count failed requests
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply status limiter to specific endpoints before general limiter
// Apply these limiters in all environments for now
app.use('/api/price-matching/:jobId/status', statusLimiter);
app.use('/api/price-matching/processor/status', statusLimiter);
app.use('/api/projects/:projectId/jobs', statusLimiter);
app.use('/api/jobs/:jobId/status', statusLimiter);
app.use('/api/jobs/:jobId/logs', logsLimiter);  // Special limiter for logs

// File upload rate limiter (more restrictive)
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 uploads per windowMs
  message: 'Too many file uploads, please try again later',
});

app.use('/api/projects/upload', uploadLimiter);
app.use('/api/projects/upload-and-match', uploadLimiter);
app.use('/api/price-matching/upload', uploadLimiter);
app.use('/api/price-matching/upload-and-match', uploadLimiter);

// Apply Convex-specific rate limiting
app.use(convexRateLimiter.middleware());

// Apply general rate limiting in production - TEMPORARILY DISABLED for debugging
// if (!isDevelopment) {
//   app.use('/api', limiter);
// }

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/price-matching', priceMatchingRoutes);
app.use('/api/price-list', priceListRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/monitoring', monitoringRoutes);
// app.use('/api/async-jobs', asyncJobsRoutes);
app.use('/api', healthRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend in production
// NOTE: Disabled for Lambda deployment - frontend should be served separately
// if (process.env.NODE_ENV === 'production') {
//   const publicPath = path.join(__dirname, '../../public');
//   app.use(express.static(publicPath));
//   
//   // Handle client-side routing - must be after API routes
//   app.get('/*', (req, res) => {
//     if (!req.path.startsWith('/api')) {
//       res.sendFile(path.join(publicPath, 'index.html'));
//     }
//   });
// }

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Server] An error occurred');
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
const PORT = env.PORT || 5000;

// Initialize services
fileStorage.initialize().catch(console.error);
// Removed console.log for job processor to reduce log noise

// For local development
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log('\\n=================================');
    console.log('🚀 Backend Server Started!');
    console.log('=================================');
    console.log(`📡 HTTP Server: http://localhost:${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📊 Convex URL: [CONFIGURED]`);
    console.log('=================================');
    console.log('📝 Key endpoints:');
    console.log('  - POST /api/auth/login');
    console.log('  - POST /api/price-matching/upload-and-match');
    console.log('  - GET  /api/price-matching/:jobId/status');
    console.log('  - GET  /api/price-matching/:jobId/results');
    console.log('  - GET  /api/price-matching/:jobId/export');
    console.log('=================================');
    console.log('🔍 Detailed logging enabled for:');
    console.log('  - Authentication (all requests)');
    console.log('  - File uploads and parsing');
    console.log('  - Job processing lifecycle');
    console.log('  - Matching operations');
    console.log('=================================\\n');
  });
}

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} signal received: closing HTTP server`);
  
  // No HTTP server to close for serverless
  console.log('Shutting down gracefully...');
  process.exit(0);
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Export for Vercel serverless
export default app;

