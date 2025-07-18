import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const convex = new ConvexHttpClient(process.env.CONVEX_URL!);

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
      });
    }

    // Get user by email
    const user = await convex.query(api.users.getByEmail, { email });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.hashedPassword);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    // Generate tokens
    const accessToken = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET!,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      {
        userId: user._id,
        type: 'refresh',
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    // Log activity
    await convex.mutation(api.activityLogs.create, {
      userId: user._id,
      action: 'login',
      details: 'User logged in',
      ipAddress: req.headers['x-forwarded-for']?.toString() || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    });

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}