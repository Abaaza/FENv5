import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api.js';

const convex = new ConvexHttpClient(process.env.CONVEX_URL!);

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Verify cron secret if set
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get pending jobs
    const pendingJobs = await convex.query(api.aiMatchingJobs.getPendingJobs, {
      limit: 5, // Process up to 5 jobs per cron run
    });

    if (!pendingJobs || pendingJobs.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No pending jobs',
      });
    }

    const results = [];

    // Process each job
    for (const job of pendingJobs) {
      try {
        // Call the process-job endpoint
        const response = await fetch(`${process.env.VERCEL_URL}/api/price-matching/process-job`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ jobId: job._id }),
        });

        const result = await response.json();
        results.push({
          jobId: job._id,
          success: response.ok,
          result,
        });

        // If job has more batches, it will be picked up in next cron run
      } catch (error) {
        console.error(`Failed to process job ${job._id}:`, error);
        results.push({
          jobId: job._id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Processed ${results.length} jobs`,
      results,
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process jobs',
    });
  }
}