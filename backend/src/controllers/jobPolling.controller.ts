import { Request, Response } from 'express';
import { getConvexClient } from '../config/convex';
import { api } from '../lib/convex-api';
import { ExcelService } from '../services/excel.service';
import { JobPollingService } from '../services/jobPolling.service';
import { toConvexId } from '../utils/convexId';
import { fileStorage } from '../services/fileStorage.service';
import { logActivity } from '../utils/activityLogger';
import { logStorage } from '../services/logStorage.service';
import { ConvexWrapper } from '../utils/convexWrapper';
import { jobProcessor } from '../services/jobProcessor.service';

const convex = getConvexClient();
const excelService = new ExcelService();
const jobPollingService = new JobPollingService();

// Helper function to sanitize field names for Convex
function sanitizeFieldName(name: string): string {
  return name.replace(/[^\x20-\x7E]/g, '_')
    .replace(/[Â£$â‚¬Â¥Â¢]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

// Helper function to sanitize object keys
function sanitizeObjectKeys(obj: Record<string, any>): Record<string, any> {
  if (!obj || typeof obj !== 'object') {
    return {};
  }
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const sanitizedKey = sanitizeFieldName(key);
    sanitized[sanitizedKey] = value;
  }
  return sanitized;
}

export async function uploadAndProcessBOQ(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Parse the Excel file
    const parseResult = await excelService.parseExcelFile(req.file.buffer, req.file.originalname);

    if (parseResult.totalItems === 0) {
      res.status(400).json({ error: 'No valid items found in the Excel file' });
      return;
    }
    
    // Store the original file for later use in export
    const fileId = await fileStorage.saveFile(req.file.buffer, req.file.originalname);
    
    // Get items from all sheets
    const allItems = parseResult.sheets.flatMap(sheet => sheet.items);
    const firstSheet = parseResult.sheets[0];
    
    // Include all items (both with and without quantities for context headers)
    const itemsWithQuantities = allItems.filter(item => 
      item.quantity !== undefined && 
      item.quantity !== null && 
      item.quantity > 0
    );

    // Create a matching job
    const jobId = await ConvexWrapper.mutation(api.priceMatching.createJob, {
      userId: toConvexId<'users'>(req.user.id),
      fileName: req.file.originalname,
      fileBuffer: [],
      itemCount: itemsWithQuantities.length,
      matchingMethod: req.body.matchingMethod || 'LOCAL',
      projectId: req.body.projectId ? toConvexId<'projects'>(req.body.projectId) : undefined,
      originalFileId: fileId,
      headers: firstSheet.headers || [],
      sheetName: firstSheet.sheetName || 'Sheet1',
    });

    // Process all items with row information
    const itemsToProcess = allItems.map((item, index) => ({
      description: item.description,
      quantity: item.quantity || 0,
      unit: item.unit || '',
      rowIndex: item.rowNumber || index,
      originalRowData: sanitizeObjectKeys(item.originalData || {})
    }));

    // Start processing job asynchronously
    await jobPollingService.createJob(
      jobId,
      req.user.id,
      itemsToProcess,
      req.body.matchingMethod || 'LOCAL'
    );

    // Log activity
    await logActivity(req, 'create', 'job', jobId, `Uploaded BOQ file: ${req.file.originalname}`);

    res.json({ 
      jobId,
      message: 'File uploaded successfully. Processing started.',
      itemCount: itemsWithQuantities.length,
      totalRows: allItems.length
    });

  } catch (error: any) {
    console.error('Upload BOQ error:', error);
    res.status(500).json({ error: error.message || 'Failed to upload file' });
  }
}

// Simple in-memory cache for job status
const statusCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5000; // 5 seconds cache

export async function getJobStatus(req: Request, res: Response): Promise<void> {
  try {
    const { jobId } = req.params;
    
    // Check cache first
    const cached = statusCache.get(jobId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      res.json(cached.data);
      return;
    }
    
    // First check in-memory job processor
    const inMemoryJob = jobProcessor.getJobStatus(jobId);
    if (inMemoryJob) {
      // Job is actively being processed
      const status = {
        _id: jobId,
        status: inMemoryJob.status,
        progress: inMemoryJob.progress,
        progressMessage: inMemoryJob.progressMessage,
        itemCount: inMemoryJob.itemCount,
        matchedCount: inMemoryJob.matchedCount,
        startTime: inMemoryJob.startTime
      };
      
      // Cache the response
      statusCache.set(jobId, { data: status, timestamp: Date.now() });
      res.json(status);
      return;
    }
    
    // If not in memory, get from Convex with retry handling
    try {
      const status = await jobPollingService.getJobStatus(jobId);
      
      if (!status) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }
      
      // Cache the response
      statusCache.set(jobId, { data: status, timestamp: Date.now() });
      res.json(status);
    } catch (convexError: any) {
      // If Convex fails, return cached data if available
      if (cached) {
        res.json(cached.data);
        return;
      }
      
      // Check if it's a rate limit error
      if (convexError.status === 429 || convexError.message?.includes('429')) {
        res.status(503).json({ 
          error: 'Service temporarily unavailable',
          retryAfter: 5,
          cached: false
        });
        return;
      }
      
      throw convexError;
    }
    
  } catch (error: any) {
    console.error('Get job status error:', error);
    res.status(500).json({ error: 'Failed to get job status' });
  }
}

// Clean up old cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of statusCache.entries()) {
    if (now - value.timestamp > CACHE_TTL * 10) {
      statusCache.delete(key);
    }
  }
}, 60000); // Clean every minute

export async function getJobLogs(req: Request, res: Response): Promise<void> {
  try {
    const { jobId } = req.params;
    const { since } = req.query;
    
    // Get logs from memory - no Convex calls, no 429 errors!
    const allLogs = logStorage.getLogs(jobId);
    
    // Filter logs based on 'since' timestamp if provided
    let logs = allLogs;
    if (since && typeof since === 'string') {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        logs = allLogs.filter(log => new Date(log.timestamp).getTime() > sinceDate.getTime());
      }
    }
    
    // Also get the current progress
    const progress = logStorage.getProgress(jobId);
    
    // Rate limiting headers
    res.setHeader('X-RateLimit-Limit', '60');
    res.setHeader('X-RateLimit-Remaining', '59');
    res.setHeader('X-RateLimit-Reset', new Date(Date.now() + 60000).toISOString());
    
    res.json({
      logs,
      progress,
      timestamp: new Date().toISOString(),
      total: logs.length
    });
    
  } catch (error: any) {
    console.error('Get job logs error:', error);
    res.status(500).json({ error: 'Failed to get job logs' });
  }
}

export async function cancelJob(req: Request, res: Response): Promise<void> {
  try {
    const { jobId } = req.params;
    
    await jobPollingService.cancelJob(jobId);
    
    res.json({ message: 'Job cancelled successfully' });
    
  } catch (error: any) {
    console.error('Cancel job error:', error);
    res.status(500).json({ error: 'Failed to cancel job' });
  }
}
