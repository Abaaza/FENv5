import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getConvexClient } from '../config/convex';
import { generateTokens, verifyRefreshToken } from '../utils/jwt';
import { api } from '../lib/convex-api';
import type { LoginRequest, RegisterRequest } from '../types/auth';
import { toConvexId } from '../utils/convexId';

const convex = getConvexClient();

export async function register(req: Request<{}, {}, RegisterRequest>, res: Response): Promise<void> {
  try {
    const { email, password, name } = req.body;

    // Check if user exists
    const existingUser = await convex.query(api.users.getByEmail, { email });
    if (existingUser) {
      res.status(400).json({ error: 'User already exists' });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user (not approved by default)
    const userId = await convex.mutation(api.users.create, {
      email,
      password: hashedPassword,
      name,
      role: 'user',
      isApproved: false,
    });

    res.status(201).json({
      message: 'Registration successful. Please wait for admin approval.',
      userId,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
}

export async function login(req: Request<{}, {}, LoginRequest>, res: Response): Promise<void> {
  try {
    console.log('[Auth] Login request received');
    console.log('[Auth] Request body:', req.body);
    console.log('[Auth] Content-Type:', req.headers['content-type']);
    
    const { email, password } = req.body;

    // Get user
    const user = await convex.query(api.users.getByEmail, { email });
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Check password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Check if approved
    if (!user.isApproved) {
      res.status(403).json({ error: 'Account pending approval' });
      return;
    }

    // Generate tokens
    const tokens = generateTokens({
      id: user._id,
      email: user.email,
      role: user.role,
    });

    // Update last login and refresh token
    await convex.mutation(api.users.updateLastLogin, {
      userId: user._id,
      refreshToken: tokens.refreshToken,
    });

    // Log login activity
    await convex.mutation(api.activityLogs.create, {
      userId: user._id,
      action: 'user_login',
      entityType: 'users',
      entityId: user._id,
      details: 'User logged in',
      ipAddress: 'REDACTED',
      userAgent: 'REDACTED',
    });

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      accessToken: tokens.accessToken,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
}

export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    console.log('[Auth] Refresh request received');
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      console.log('[Auth] No refresh token in cookies');
      res.status(401).json({ error: 'No refresh token' });
      return;
    }

    console.log('[Auth] Refresh token found, verifying...');
    let payload;
    try {
      // Verify refresh token
      payload = verifyRefreshToken(refreshToken);
      console.log('[Auth] Refresh token verified successfully');
    } catch (verifyError: any) {
      console.log('[Auth] Refresh token verification failed');
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    // Check if token exists in database
    console.log('[Auth] Checking refresh token in database...');
    const user = await convex.query(api.users.getByRefreshToken, { refreshToken });
    if (!user || user._id !== payload.id) {
      console.log('[Auth] Refresh token not found in database or user mismatch');
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    console.log('[Auth] User found, generating new tokens...');
    // Generate new tokens
    const tokens = generateTokens({
      id: user._id,
      email: user.email,
      role: user.role,
    });

    // Update refresh token
    await convex.mutation(api.users.updateRefreshToken, {
      userId: user._id,
      refreshToken: tokens.refreshToken,
    });

    // Set new refresh token
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    console.log('[Auth] Token refresh successful');
    res.json({ accessToken: tokens.accessToken });
  } catch (error) {
    console.error('[Auth] Refresh error:', error);
    res.status(401).json({ error: 'Token refresh failed' });
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  try {
    const { refreshToken } = req.cookies;

    if (refreshToken && req.user) {
      // Clear refresh token in database
      await convex.mutation(api.users.clearRefreshToken, {
        userId: req.user.id as any,
      });
    }

    // Clear cookie
    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
}

export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const user = await convex.query(api.users.getById, { 
      userId: toConvexId<'users'>(req.user.id)
    });
    
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      user: {
        id: (user as any)._id,
        email: (user as any).email,
        name: (user as any).name,
        role: (user as any).role,
      },
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { name } = req.body;
    const updates: any = {};

    if (name) updates.name = name;

    await convex.mutation(api.users.updateProfile, {
      userId: toConvexId<'users'>(req.user.id),
      updates,
    });

    const updatedUser = await convex.query(api.users.getById, { userId: req.user.id as any });
    res.json({
      user: {
        id: updatedUser._id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await convex.query(api.users.getById, { userId: req.user.id as any });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await convex.mutation(api.users.updatePassword, {
      userId: toConvexId<'users'>(req.user.id),
      password: hashedPassword,
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
}
