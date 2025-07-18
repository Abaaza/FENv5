import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../convex/_generated/api.js';
import { requireAuth } from '../../_utils/auth.js';
import { BlobStorageService } from '../../_utils/blob-storage.js';
import { ExcelService } from '../../../backend/src/services/excel.service.js';
import fetch from 'node-fetch';

const convex = new ConvexHttpClient(process.env.CONVEX_URL!);

async function downloadHandler(
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
    // Get job details
    const job = await convex.query(api.aiMatchingJobs.getJob, { jobId });
    
    if (!job || job.userId !== req.user.userId) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
      });
    }

    if (job.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Job is not completed yet',
      });
    }

    // Get match results
    const results = await convex.query(api.matchResults.getByJobId, { jobId });
    
    if (!results || results.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No results found for this job',
      });
    }

    // Download original file from blob storage
    let originalBuffer: Buffer | null = null;
    
    if (job.originalFileUrl) {
      try {
        const response = await fetch(job.originalFileUrl);
        originalBuffer = Buffer.from(await response.arrayBuffer());
      } catch (error) {
        console.error('Failed to download original file:', error);
      }
    }

    // Generate Excel with results
    const excelService = new ExcelService();
    const resultBuffer = await excelService.exportMatchResults(
      originalBuffer || Buffer.alloc(0),
      results,
      {
        matchingMethod: job.matchingMethod,
        matchedCount: results.filter(r => r.confidence > 0.5).length,
        itemCount: job.itemCount,
      }
    );

    // Upload result file to blob storage
    const resultUrl = await BlobStorageService.uploadResultsFile(jobId, resultBuffer);

    // Update job with result file URL
    await convex.mutation(api.aiMatchingJobs.updateResultUrl, {
      jobId,
      resultFileUrl: resultUrl,
    });

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="matched-${job.fileName}"`);
    res.setHeader('Content-Length', resultBuffer.length.toString());

    // Send file
    return res.status(200).send(resultBuffer);
  } catch (error) {
    console.error('Download error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate results file',
    });
  }
}

export default requireAuth(downloadHandler);