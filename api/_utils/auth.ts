import jwt from 'jsonwebtoken';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api.js';
import type { VercelRequest } from '@vercel/node';

const convex = new ConvexHttpClient(process.env.CONVEX_URL!);

export interface AuthUser {
  userId: string;
  email: string;
  role: string;
}

export async function verifyAuth(req: VercelRequest): Promise<AuthUser | null> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

    // Verify user exists in database
    const user = await convex.query(api.users.getById, { userId: decoded.userId });
    if (!user) {
      return null;
    }

    return {
      userId: decoded.userId,
      email: user.email,
      role: user.role,
    };
  } catch (error) {
    console.error('Auth verification error:', error);
    return null;
  }
}

export function requireAuth(handler: Function) {
  return async (req: VercelRequest, res: any) => {
    const user = await verifyAuth(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Add user to request
    (req as any).user = user;
    return handler(req, res);
  };
}