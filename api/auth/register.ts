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
    const { email, password, firstName, lastName, company, phone } = req.body;

    // Validate required fields
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        error: 'Email, password, first name, and last name are required',
      });
    }

    // Check if user already exists
    const existingUser = await convex.query(api.users.getByEmail, { email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists',
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const userId = await convex.mutation(api.users.create, {
      email,
      hashedPassword,
      firstName,
      lastName,
      company,
      phone,
      role: 'user',
    });

    // Generate tokens
    const accessToken = jwt.sign(
      {
        userId,
        email,
        role: 'user',
      },
      process.env.JWT_SECRET!,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      {
        userId,
        type: 'refresh',
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    // Log activity
    await convex.mutation(api.activityLogs.create, {
      userId,
      action: 'register',
      details: 'User registered',
      ipAddress: req.headers['x-forwarded-for']?.toString() || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    });

    return res.status(201).json({
      success: true,
      data: {
        user: {
          id: userId,
          email,
          firstName,
          lastName,
          role: 'user',
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}