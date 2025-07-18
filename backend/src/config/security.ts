import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

// CSRF token storage (in production, use Redis or similar)
const csrfTokens = new Map<string, { token: string; expires: number }>();

// Clean up expired tokens periodically
setInterval(() => {
  const now = Date.now();
  for (const [userId, data] of csrfTokens.entries()) {
    if (data.expires < now) {
      csrfTokens.delete(userId);
    }
  }
}, 60 * 60 * 1000); // Every hour

export function generateCSRFToken(userId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  
  csrfTokens.set(userId, { token, expires });
  return token;
}

export function validateCSRFToken(userId: string, token: string): boolean {
  const stored = csrfTokens.get(userId);
  if (!stored) return false;
  
  if (stored.expires < Date.now()) {
    csrfTokens.delete(userId);
    return false;
  }
  
  return crypto.timingSafeEqual(
    Buffer.from(stored.token),
    Buffer.from(token)
  );
}

// CSRF middleware
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Skip CSRF for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Skip CSRF for public endpoints
  const publicEndpoints = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh'];
  if (publicEndpoints.includes(req.path)) {
    return next();
  }
  
  // Extract user ID from JWT (assumes auth middleware has already run)
  const userId = (req as any).user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Get CSRF token from header or body
  const token = req.headers['x-csrf-token'] as string || req.body._csrf;
  if (!token) {
    return res.status(403).json({ error: 'CSRF token missing' });
  }
  
  // Validate token
  if (!validateCSRFToken(userId, token)) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  
  next();
}

// Security headers middleware
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Additional security headers not covered by Helmet
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Remove sensitive headers
  res.removeHeader('X-Powered-By');
  
  next();
}

// Input sanitization middleware
export function sanitizeInput(req: Request, res: Response, next: NextFunction) {
  // Sanitize query parameters
  if (req.query) {
    for (const key in req.query) {
      if (typeof req.query[key] === 'string') {
        // Remove potential NoSQL injection patterns
        req.query[key] = (req.query[key] as string).replace(/[${}]/g, '');
      }
    }
  }
  
  // Sanitize body parameters
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }
  
  next();
}

function sanitizeObject(obj: any): void {
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      // Remove potential NoSQL injection patterns
      obj[key] = obj[key].replace(/[${}]/g, '');
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
}

// Password policy validation
export function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  // Check for common weak passwords
  const commonPasswords = ['password', '12345678', 'qwerty', 'admin', 'letmein'];
  if (commonPasswords.some(weak => password.toLowerCase().includes(weak))) {
    errors.push('Password is too common or weak');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
