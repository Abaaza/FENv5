import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory rate limiter (use Redis in production)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
}) {
  const {
    windowMs = 60000, // 1 minute
    max = 60,
    keyGenerator = (req) => req.ip || 'unknown',
    skipSuccessfulRequests = false
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator(req);
    const now = Date.now();
    const resetTime = now + windowMs;

    let entry = rateLimitStore.get(key);
    if (!entry || entry.resetTime < now) {
      entry = { count: 0, resetTime };
      rateLimitStore.set(key, entry);
    }

    // Check if limit exceeded
    if (entry.count >= max) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());
      res.setHeader('X-RateLimit-Limit', max.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', new Date(entry.resetTime).toISOString());
      
      res.status(429).json({
        error: 'Too many requests',
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        retryAfter
      });
      return;
    }

    // Increment counter
    entry.count++;

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', max.toString());
    res.setHeader('X-RateLimit-Remaining', (max - entry.count).toString());
    res.setHeader('X-RateLimit-Reset', new Date(entry.resetTime).toISOString());

    // Skip counting successful requests if configured
    if (skipSuccessfulRequests) {
      res.on('finish', () => {
        if (res.statusCode < 400 && entry) {
          entry.count--;
        }
      });
    }

    next();
  };
}

// Specific rate limiter for log endpoints
export const logRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per job
  keyGenerator: (req) => {
    // Rate limit per user + job combination
    const userId = req.user?.id || 'anonymous';
    const jobId = req.params.jobId || 'unknown';
    return `${userId}:${jobId}`;
  }
});

// General API rate limiter
export const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  keyGenerator: (req) => req.user?.id || req.ip || 'unknown'
});