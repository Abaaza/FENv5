import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api.js';
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
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token is required',
      });
    }

    // Verify refresh token
    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET!);
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token',
      });
    }

    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token type',
      });
    }

    // Get user
    const user = await convex.query(api.users.getById, { userId: decoded.userId });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
      });
    }

    // Generate new access token
    const accessToken = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET!,
      { expiresIn: '15m' }
    );

    return res.status(200).json({
      success: true,
      data: {
        accessToken,
        refreshToken, // Return the same refresh token
      },
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}