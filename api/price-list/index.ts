import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api.js';
import { requireAuth } from '../_utils/auth.js';

const convex = new ConvexHttpClient(process.env.CONVEX_URL!);

async function handler(
  req: VercelRequest & { user: any },
  res: VercelResponse
) {
  switch (req.method) {
    case 'GET':
      return handleGet(req, res);
    case 'POST':
      return handlePost(req, res);
    default:
      return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
}

async function handleGet(
  req: VercelRequest & { user: any },
  res: VercelResponse
) {
  try {
    const { search, category, page = '1', limit = '50' } = req.query;

    const items = await convex.query(api.priceItems.list, {
      search: search as string,
      category: category as string,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    });

    return res.status(200).json({
      success: true,
      data: items,
    });
  } catch (error) {
    console.error('Get price items error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch price items',
    });
  }
}

async function handlePost(
  req: VercelRequest & { user: any },
  res: VercelResponse
) {
  try {
    // Only admins can create price items
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
      });
    }

    const itemId = await convex.mutation(api.priceItems.create, {
      ...req.body,
      createdBy: req.user.userId,
    });

    // Log activity
    await convex.mutation(api.activityLogs.create, {
      userId: req.user.userId,
      action: 'create_price_item',
      details: `Created price item: ${req.body.description}`,
      ipAddress: req.headers['x-forwarded-for']?.toString() || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    });

    return res.status(201).json({
      success: true,
      data: { id: itemId },
    });
  } catch (error) {
    console.error('Create price item error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create price item',
    });
  }
}

export default requireAuth(handler);