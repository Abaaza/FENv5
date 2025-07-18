import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../convex/_generated/api.js';
import { requireAuth } from '../../_utils/auth.js';

const convex = new ConvexHttpClient(process.env.CONVEX_URL!);

async function statusHandler(
  req: VercelRequest & { user: any },
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { jobId } = req.query;

  if (!jobId || typeof jobId !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Job ID is required',
    });
  }

  try {
    // Get job status
    const job = await convex.query(api.aiMatchingJobs.getJobStatus, {
      jobId,
      userId: req.user.userId,
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
      });
    }

    // Calculate progress percentage
    const progress = job.itemCount > 0 
      ? Math.round((job.processedCount / job.itemCount) * 100)
      : 0;

    return res.status(200).json({
      success: true,
      data: {
        jobId: job._id,
        status: job.status,
        progress,
        processedCount: job.processedCount,
        itemCount: job.itemCount,
        matchingMethod: job.matchingMethod,
        fileName: job.fileName,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        error: job.error,
      },
    });
  } catch (error) {
    console.error('Status check error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get job status',
    });
  }
}

export default requireAuth(statusHandler);