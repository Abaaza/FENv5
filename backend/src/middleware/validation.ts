import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

export function validateRequest(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    console.log('[Validation] Request validation failed');
    console.log('[Validation] Path:', req.path);
    console.log('[Validation] Method:', req.method);
    console.log('[Validation] Body:', req.body);
    console.log('[Validation] Headers:', req.headers);
    console.log('[Validation] Errors:', errors.array());
    res.status(400).json({ errors: errors.array() });
    return;
  }
  
  next();
}
