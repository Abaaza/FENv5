import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api.js';
import { requireAuth } from '../_utils/auth.js';

const convex = new ConvexHttpClient(process.env.CONVEX_URL!);

async function handler(
  req: VercelRequest & { user: any },
  res: VercelResponse
) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'ID is required',
    });
  }

  switch (req.method) {
    case 'GET':
      return handleGet(req, res, id);
    case 'PUT':
      return handlePut(req, res, id);
    case 'DELETE':
      return handleDelete(req, res, id);
    default:
      return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
}

async function handleGet(
  req: VercelRequest & { user: any },
  res: VercelResponse,
  id: string
) {
  try {
    const item = await convex.query(api.priceItems.getById, { id });

    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Price item not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: item,
    });
  } catch (error) {
    console.error('Get price item error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch price item',
    });
  }
}

async function handlePut(
  req: VercelRequest & { user: any },
  res: VercelResponse,
  id: string
) {
  try {
    // Only admins can update price items
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
      });
    }

    await convex.mutation(api.priceItems.update, {
      id,
      ...req.body,
    });

    // Log activity
    await convex.mutation(api.activityLogs.create, {
      userId: req.user.userId,
      action: 'update_price_item',
      details: `Updated price item: ${id}`,
      ipAddress: req.headers['x-forwarded-for']?.toString() || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    });

    return res.status(200).json({
      success: true,
      data: { id },
    });
  } catch (error) {
    console.error('Update price item error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update price item',
    });
  }
}

async function handleDelete(
  req: VercelRequest & { user: any },
  res: VercelResponse,
  id: string
) {
  try {
    // Only admins can delete price items
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
      });
    }

    await convex.mutation(api.priceItems.delete, { id });

    // Log activity
    await convex.mutation(api.activityLogs.create, {
      userId: req.user.userId,
      action: 'delete_price_item',
      details: `Deleted price item: ${id}`,
      ipAddress: req.headers['x-forwarded-for']?.toString() || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    });

    return res.status(200).json({
      success: true,
      data: { id },
    });
  } catch (error) {
    console.error('Delete price item error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete price item',
    });
  }
}

export default requireAuth(handler);