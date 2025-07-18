import { getConvexClient } from '../config/convex';
import { api } from '../lib/convex-api';
import { toConvexId } from './convexId';
import type { Request } from 'express';

const convex = getConvexClient();

export async function logActivity(
  req: Request,
  action: string,
  entityType: string,
  entityId?: string,
  details?: string
): Promise<void> {
  try {
    if (!req.user) return;

    await convex.mutation(api.activityLogs.create, {
      userId: toConvexId<'users'>(req.user.id),
      action,
      entityType,
      entityId,
      details,
      ipAddress: 'REDACTED',
      userAgent: 'REDACTED',
    });
  } catch (error) {
    console.error('[ActivityLogger] Failed to log activity:', error);
    // Don't throw - logging failures shouldn't break the main operation
  }
}
