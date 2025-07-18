import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    
    // Only log authentication issues, not successful auth for polling endpoints
    const isPollingEndpoint = req.path.includes('/status') || req.path.includes('/logs');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log(`[Auth] No valid bearer token provided for ${req.method} ${req.path}`);
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.split(' ')[1];
    
    const payload = verifyAccessToken(token);
    
    // Only log non-polling requests or important endpoints
    if (!isPollingEndpoint) {
      console.log(`[Auth] Token verified for ${req.method} ${req.path}`);
    }
    
    req.user = payload;
    next();
  } catch (error) {
    console.error(`[Auth] Authentication failed for ${req.method} ${req.path}:`, error);
    
    if (error instanceof Error && error.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Token expired' });
      return;
    }
    
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  
  next();
}
