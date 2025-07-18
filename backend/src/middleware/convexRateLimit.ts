import { Request, Response, NextFunction } from 'express';

interface RateLimitInfo {
  count: number;
  resetTime: number;
}

class ConvexRateLimiter {
  private limits: Map<string, RateLimitInfo> = new Map();
  private readonly windowMs = 60000; // 1 minute window
  private readonly maxRequests = 100; // Max 100 requests per minute per endpoint
  
  /**
   * Rate limit middleware for Convex operations
   */
  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Only apply to price matching endpoints that hit Convex heavily
      const convexHeavyEndpoints = [
        '/api/price-matching/upload-and-match',
        '/api/price-matching/start',
        '/api/price-matching/stop',
        '/api/price-matching/stop-all'
      ];
      
      const shouldLimit = convexHeavyEndpoints.some(endpoint => 
        req.path.includes(endpoint)
      );
      
      if (!shouldLimit) {
        return next();
      }
      
      const key = `${req.ip}-${req.path}`;
      const now = Date.now();
      
      // Get or create rate limit info
      let limitInfo = this.limits.get(key);
      
      // Reset if window expired
      if (!limitInfo || now > limitInfo.resetTime) {
        limitInfo = {
          count: 0,
          resetTime: now + this.windowMs
        };
        this.limits.set(key, limitInfo);
      }
      
      // Increment count
      limitInfo.count++;
      
      // Check if limit exceeded
      if (limitInfo.count > this.maxRequests) {
        const retryAfter = Math.ceil((limitInfo.resetTime - now) / 1000);
        
        res.status(429).json({
          error: 'Too many requests. Please wait before trying again.',
          retryAfter: retryAfter,
          message: `Rate limit exceeded. Maximum ${this.maxRequests} requests per minute allowed.`
        });
        return;
      }
      
      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', this.maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', (this.maxRequests - limitInfo.count).toString());
      res.setHeader('X-RateLimit-Reset', new Date(limitInfo.resetTime).toISOString());
      
      next();
    };
  }
  
  /**
   * Clean up expired entries periodically
   */
  startCleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [key, info] of this.limits.entries()) {
        if (now > info.resetTime + this.windowMs) {
          this.limits.delete(key);
        }
      }
    }, this.windowMs);
  }
}

// Create singleton instance
export const convexRateLimiter = new ConvexRateLimiter();

// Start cleanup
convexRateLimiter.startCleanup();