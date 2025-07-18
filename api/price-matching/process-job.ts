import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api.js';
import { MatchingService } from '../../backend/src/services/matching.service.js';

const convex = new ConvexHttpClient(process.env.CONVEX_URL!);

// This function will be called by Convex scheduler or manually
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { jobId } = req.body;

  if (!jobId) {
    return res.status(400).json({
      success: false,
      error: 'Job ID is required',
    });
  }

  try {
    // Get job details
    const job = await convex.query(api.aiMatchingJobs.getJob, { jobId });
    
    if (!job || job.status !== 'processing') {
      return res.status(400).json({
        success: false,
        error: 'Job not found or not in processing state',
      });
    }

    // Get unprocessed batch
    const batch = await convex.query(api.aiMatchingJobs.getUnprocessedBatch, { jobId });
    
    if (!batch || batch.items.length === 0) {
      // No more batches, mark job as completed
      await convex.mutation(api.aiMatchingJobs.completeJob, { jobId });
      return res.status(200).json({
        success: true,
        data: { message: 'Job completed' },
      });
    }

    // Get price items
    const priceItems = await convex.query(api.priceItems.getActive);
    const matchingService = MatchingService.getInstance();
    
    // Process batch items
    const results = [];
    
    for (const item of batch.items) {
      try {
        const result = await matchingService.matchItem(
          item.description,
          job.matchingMethod,
          priceItems,
          item.contextHeaders
        );

        results.push({
          batchIndex: item.batchIndex,
          ...result,
          originalDescription: item.description,
          originalQuantity: item.quantity,
          originalUnit: item.unit,
          rowNumber: item.rowNumber,
          sheetName: item.sheetName,
        });
      } catch (error) {
        console.error(`Error matching item ${item.batchIndex}:`, error);
        
        // Add failed result
        results.push({
          batchIndex: item.batchIndex,
          matchedItemId: '',
          matchedDescription: 'ERROR: Failed to match',
          matchedCode: '',
          matchedUnit: '',
          matchedRate: 0,
          confidence: 0,
          method: job.matchingMethod,
          originalDescription: item.description,
          originalQuantity: item.quantity,
          originalUnit: item.unit,
          rowNumber: item.rowNumber,
          sheetName: item.sheetName,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Update progress
      await convex.mutation(api.aiMatchingJobs.updateProgress, {
        jobId,
        processedCount: item.batchIndex + 1,
      });
    }

    // Store results
    await convex.mutation(api.matchResults.createBatch, {
      jobId,
      results,
    });

    // Mark batch as processed
    await convex.mutation(api.aiMatchingJobs.markBatchProcessed, {
      jobId,
      batchId: batch._id,
    });

    // Check if there are more batches
    const hasMore = await convex.query(api.aiMatchingJobs.hasUnprocessedBatches, { jobId });
    
    if (hasMore) {
      // Schedule next batch processing (in production, use a queue service)
      // For now, return status indicating more processing needed
      return res.status(200).json({
        success: true,
        data: {
          message: 'Batch processed',
          hasMore: true,
          processedCount: results.length,
        },
      });
    } else {
      // All batches processed, complete the job
      await convex.mutation(api.aiMatchingJobs.completeJob, { jobId });
      
      return res.status(200).json({
        success: true,
        data: {
          message: 'Job completed',
          hasMore: false,
          processedCount: results.length,
        },
      });
    }
  } catch (error) {
    console.error('Job processing error:', error);
    
    // Mark job as failed
    try {
      await convex.mutation(api.aiMatchingJobs.failJob, {
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } catch (updateError) {
      console.error('Failed to update job status:', updateError);
    }
    
    return res.status(500).json({
      success: false,
      error: 'Failed to process job',
    });
  }
}