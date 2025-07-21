import { Request, Response } from 'express';
import { getConvexClient } from '../config/convex';
import { api } from '../lib/convex-api';
import { ExcelService } from '../services/excel.service';
import { MatchingService } from '../services/matching.service';
import { jobProcessor } from '../services/jobProcessor.service';
import { lambdaProcessor, LambdaProcessorService } from '../services/lambdaProcessor.service';
import { toConvexId } from '../utils/convexId';
import { v4 as uuidv4 } from 'uuid';
import { fileStorage } from '../services/fileStorage.service';
import { logActivity } from '../utils/activityLogger';
import { AsyncJobInvoker } from '../utils/asyncJobInvoker';
import { ConvexWrapper } from '../utils/convexWrapper';

const convex = getConvexClient();
const excelService = new ExcelService();
const matchingService = MatchingService.getInstance();

// Helper function to sanitize field names for Convex
function sanitizeFieldName(name: string): string {
  // Replace non-ASCII and special characters with underscores
  return name.replace(/[^\x20-\x7E]/g, '_') // Non-ASCII characters
    .replace(/[£$€¥¢]/g, '_')                // Currency symbols
    .replace(/\s+/g, '_')                     // Spaces
    .replace(/[^a-zA-Z0-9_]/g, '_')         // Other special characters
    .replace(/_+/g, '_')                      // Multiple underscores
    .replace(/^_|_$/g, '');                   // Leading/trailing underscores
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

export async function getUserJobs(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const jobs = await convex.query(api.priceMatching.getUserJobs, {
      userId: toConvexId<'users'>(req.user.id),
    });

    res.json(jobs);
  } catch (error) {
    // Console log removed for performance
    res.status(500).json({ error: 'Failed to get jobs' });
  }
}

export async function getAllJobs(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Get all jobs from the database
    const jobs = await convex.query(api.priceMatching.getAllJobs, {});

    res.json(jobs);
  } catch (error) {
    // Console log removed for performance
    res.status(500).json({ error: 'Failed to get all jobs' });
  }
}

export async function uploadBOQ(req: Request, res: Response): Promise<void> {
  // Console log removed for performance
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Console log removed for performance
    // Parse the Excel file
    const parseResult = await excelService.parseExcelFile(req.file.buffer, req.file.originalname);

    if (parseResult.totalItems === 0) {
      res.status(400).json({ error: 'No valid items found in the Excel file' });
      return;
    }
    
    // Store the original file for later use in export
    const fileId = await fileStorage.saveFile(req.file.buffer, req.file.originalname);
    // Console log removed for performance
    
    // Get items from all sheets
    const allItems = parseResult.sheets.flatMap(sheet => sheet.items);
    const firstSheet = parseResult.sheets[0];
    
    // Separate items with and without quantities
    const itemsWithQuantities = allItems.filter(item => 
      item.quantity !== undefined && 
      item.quantity !== null && 
      item.quantity > 0
    );

    // Console log removed for performance

    // Create a project if projectName is provided
    let projectId;
    if (req.body.projectName && req.body.clientId) {
      // Console log removed for performance
      projectId = await convex.mutation(api.projects.create, {
        name: req.body.projectName,
        clientId: toConvexId<'clients'>(req.body.clientId),
        description: `BOQ matching project for ${req.file.originalname}`,
        status: 'active' as const,
        userId: toConvexId<'users'>(req.user.id),
      });
      // Console log removed for performance
    }

    // Create a matching job
    const jobId = await convex.mutation(api.priceMatching.createJob, {
      userId: toConvexId<'users'>(req.user.id),
      fileName: req.file.originalname,
      // Provide empty array for fileBuffer until Convex schema is updated
      fileBuffer: [],
      itemCount: itemsWithQuantities.length, // Only count items with quantities
      matchingMethod: req.body.matchingMethod || 'LOCAL',
      clientId: req.body.clientId ? toConvexId<'clients'>(req.body.clientId) : undefined,
      projectId: projectId,
      projectName: req.body.projectName,
      headers: firstSheet?.headers || [],
      sheetName: firstSheet?.sheetName || 'Sheet1',
      // Use the fileId from storage instead
      originalFileId: fileId,
    });

    // Store parsed items
    const storedItems = [];
    for (const item of allItems) {
      const sanitizedOriginalData = sanitizeObjectKeys(item.originalData || {});
      
      const storedItem = {
        jobId: jobId as any,
        rowNumber: item.rowNumber,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        originalRowData: sanitizedOriginalData,
        contextHeaders: item.contextHeaders || [],
      };
      
      await convex.mutation(api.priceMatching.addParsedItem, storedItem);
      storedItems.push(storedItem);
    }

    // Console log removed for performance

    // Log activity
    await logActivity(req, 'upload_boq', 'aiMatchingJobs', jobId.toString(), `Uploaded ${req.file.originalname} with ${itemsWithQuantities.length} items`);

    res.json({
      jobId: jobId.toString(),
      fileName: req.file.originalname,
      itemCount: itemsWithQuantities.length,
      headers: firstSheet?.headers || [],
      items: parseResult.sheets.flatMap(sheet => {
        return sheet.items.map(item => ({
          index: 0, // Will be set later
          rowNumber: item.rowNumber,
          fullText: item.description,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          type: item.quantity ? 'item' : 'header',
          contextHeaders: item.contextHeaders || []
        }));
      }).map((item, index) => ({ ...item, index: index + 1 })),
    });
  } catch (error) {
    // Console log removed for performance
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to upload BOQ' });
  }
}

export async function uploadAndMatch(req: Request, res: Response): Promise<void> {
  const requestId = uuidv4().substring(0, 8);
  // Console log removed for performance
  const startTime = Date.now();
  let operationTimeout: NodeJS.Timeout | undefined;
  
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { matchingMethod = 'LOCAL', clientName = 'Default Client', clientId, projectName } = req.body;
    const userId = req.user.id;

    // Console log removed for performance

    // Helper function to generate detailed preview items
    function generatePreviewItems(items: any[]): any[] {
      return items.map((item, index) => {
        // For context headers, just show the description
        // For BOQ items, show description with quantity/unit
        let fullText = item.description;
        
        // Add quantity and unit if available (for BOQ items)
        if (item.quantity && item.unit) {
          fullText += ` - ${item.quantity} ${item.unit}`;
        }
        
        // Determine the type of item
        let itemType = 'item'; // default
        if (!item.quantity || item.quantity === 0) {
          // Check what kind of header this is
          if (item.description.match(/^(BILL|SUB-BILL)/i)) {
            itemType = 'major-header';
          } else if (item.description.match(/^[A-Z]\d+\s/i)) {
            itemType = 'section-header';
          } else if (item.description.match(/^(NOTE|Extra over|Earthwork|Disposal|Excavated|Filling)/i)) {
            itemType = 'sub-header';
          } else {
            itemType = 'context-header';
          }
        }
        
        return {
          index: index + 1,
          rowNumber: item.rowNumber,
          fullText: fullText,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          type: itemType,
          contextHeaders: item.contextHeaders || []
        };
      });
    }

    // Console log removed for performance
    if (!['LOCAL', 'V2', 'V1'].includes(matchingMethod)) {
      res.status(400).json({ error: 'Invalid matching method' });
      return;
    }
    
    // Add a timeout for the entire operation
    const operationTimeout = setTimeout(() => {
      // Console log removed for performance
      if (!res.headersSent) {
        res.status(504).json({ error: 'Operation timeout. Please try uploading a smaller file or contact support.' });
      }
    }, 280000); // 4.5 minute timeout (Lambda has 5 min limit)

    // Console log removed for performance
    const parseStartTime = Date.now();
    
    // Parse the Excel file
    const parseResult = await excelService.parseExcelFile(req.file.buffer, req.file.originalname);
    
    // Store the original file for later use in export
    const fileId = await fileStorage.saveFile(req.file.buffer, req.file.originalname);
    // Console log removed for performance
    
    const parseEndTime = Date.now();
    // Console log removed for performance
    // Console log removed for performance

    if (parseResult.totalItems === 0) {
      res.status(400).json({ error: 'No valid items found in the Excel file' });
      return;
    }
    
    // Get items from all sheets
    const allItems = parseResult.sheets.flatMap(sheet => sheet.items);
    const firstSheet = parseResult.sheets[0];

    // Separate items with and without quantities
    const itemsWithQuantities = allItems.filter(item => 
      item.quantity !== undefined && 
      item.quantity !== null && 
      item.quantity > 0
    );
    
    const itemsWithoutQuantities = allItems.filter(item => 
      item.quantity === undefined || 
      item.quantity === null || 
      item.quantity === 0
    );
    
    // Console log removed for performance
    // Console log removed for performance
    // Console log removed for performance
    // Console log removed for performance

    // Console log removed for performance
    const jobCreateStartTime = Date.now();
    
    // Create a project if projectName is provided
    let projectId;
    if (projectName && clientId) {
      // Console log removed for performance
      projectId = await convex.mutation(api.projects.create, {
        name: projectName,
        clientId: toConvexId<'clients'>(clientId),
        description: `BOQ matching project for ${req.file.originalname}`,
        status: 'active' as const,
        userId: toConvexId<'users'>(userId),
      });
      // Console log removed for performance
    }
    
    // Create a matching job
    const jobId = await convex.mutation(api.priceMatching.createJob, {
      userId: toConvexId<'users'>(userId),
      fileName: req.file.originalname,
      fileBuffer: [],
      itemCount: itemsWithQuantities.length, // Only count items with quantities
      matchingMethod: matchingMethod,
      clientId: clientId ? toConvexId<'clients'>(clientId) : undefined,
      projectId: projectId,
      projectName: projectName,
      headers: firstSheet?.headers || [],
      sheetName: firstSheet?.sheetName || 'Sheet1',
      originalFileId: fileId,
    });

    // Console log removed for performance
    
    const jobCreateEndTime = Date.now();
    // Console log removed for performance

    // Console log removed for performance
    const prepareItemsStartTime = Date.now();
    
    // Prepare items for processing (no need to store in Convex)
    const preparedItems = allItems.map((item) => {
      const sanitizedOriginalData = sanitizeObjectKeys(item.originalData || {});
      
      return {
        jobId: jobId.toString(),
        rowNumber: item.rowNumber,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        originalRowData: sanitizedOriginalData,
        contextHeaders: item.contextHeaders || [],
      };
    });

    const prepareItemsEndTime = Date.now();
    // Console log removed for performance

    // Console log removed for performance
    const processorStartTime = Date.now();
    
    // Check if running in Lambda - process based on size
    if (LambdaProcessorService.isLambdaEnvironment()) {
      // For small files, process inline to return results quickly
      if (preparedItems.length <= 100) {
        // Console log removed for performance
        
        try {
          const result = await lambdaProcessor.processSynchronously(
            jobId.toString(),
            userId.toString(),
            preparedItems,
            matchingMethod,
            processorStartTime
          );
          
          if (!result.success) {
            throw new Error(result.error || 'Lambda processing failed');
          }
        } catch (error: any) {
          // Console log removed for performance
          await convex.mutation(api.priceMatching.updateJobStatus, {
            jobId: jobId,
            status: 'failed' as any,
            error: error.message || 'Processing failed',
          });
          throw error;
        }
      } else {
        // For larger files, we need a different approach
        // Console log removed for performance
        
        // Update status to indicate the limitation
        await convex.mutation(api.priceMatching.updateJobStatus, {
          jobId: jobId,
          status: 'pending' as any,
          progress: 0,
          progressMessage: `File with ${preparedItems.length} items requires background processing. Due to Lambda/API Gateway limitations, please use files with 100 items or less for immediate processing.`,
        });
        
        // We can't do true async in Lambda with API Gateway
        // The best approach is to limit file size or use a different architecture
        throw new Error(`Files larger than 100 items require a different processing architecture. Current file has ${preparedItems.length} items. Please split into smaller files or contact support.`);
      }
    } else if (false) {
      // In Lambda but file is too large (>300 items)
      // Console log removed for performance
      
      // Update job status to failed with helpful message
      await convex.mutation(api.priceMatching.updateJobStatus, {
        jobId: jobId,
        status: 'failed' as any,
        error: `This file contains ${preparedItems.length} items, which exceeds the Lambda processing limit of 1000 items. Please split your file into smaller chunks (max 1000 items each) and process them separately.`,
        progress: 0,
        progressMessage: 'File too large for serverless processing'
      });
      
      throw new Error(`File too large (${preparedItems.length} items). Lambda can only process files with up to 1000 items. Please split your file into smaller chunks.`);
    } else if (AsyncJobInvoker && AsyncJobInvoker.shouldProcessAsync && AsyncJobInvoker.shouldProcessAsync(preparedItems.length)) {
      // Console log removed for performance
      
      // Update job status to indicate async processing
      await convex.mutation(api.priceMatching.updateJobStatus, {
        jobId: jobId,
        status: 'pending' as any,
        progress: 0,
        progressMessage: 'Job queued for processing (large file)'
      });
      
      // Send to async processor
      await AsyncJobInvoker.sendToQueue({
        jobId: jobId.toString(),
        userId: userId.toString(),
        items: preparedItems,
        method: matchingMethod
      });
      
      // Console log removed for performance
    } else {
      // Process synchronously for small jobs (non-Lambda)
      await jobProcessor.addJob(jobId.toString(), userId.toString(), preparedItems, matchingMethod);
    }
    
    const processorEndTime = Date.now();
    // Console log removed for performance

    // Log activity
    await logActivity(req, 'upload_and_match', 'aiMatchingJobs', jobId.toString(), 
      `Uploaded ${req.file.originalname} with ${itemsWithQuantities.length} items and started ${matchingMethod} matching`
    );

    const totalEndTime = Date.now();
    // Console log removed for performance
    // Console log removed for performance

    // Clear the timeout since we're done
    clearTimeout(operationTimeout);

    // Return response with preview items
    res.json({
      jobId: jobId.toString(),
      fileName: req.file.originalname,
      itemCount: itemsWithQuantities.length,
      headers: firstSheet?.headers || [],
      items: generatePreviewItems(allItems), // Include all items in preview
      startTime: Date.now(),
    });
  } catch (error: any) {
    // Console log removed for performance
    // Console log removed for performance
    
    // Clear the timeout on error
    if (operationTimeout) {
      clearTimeout(operationTimeout);
    }
    
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Failed to upload and match BOQ' });
    }
  }
}

export async function startMatching(req: Request, res: Response): Promise<void> {
  const requestId = uuidv4();
  // Console log removed for performance
  // Console log removed for performance
  // Console log removed for performance
  // Console log removed for performance
  // Console log removed for performance
  // Console log removed for performance
  
  try {
    const { jobId } = req.params;
    const { matchingMethod } = req.body;

    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Get the job
    // Console log removed for performance
    const job = await convex.query(api.priceMatching.getJob, { jobId: toConvexId<'aiMatchingJobs'>(jobId) });
    if (!job) {
      // Console log removed for performance
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    if (job.userId !== req.user.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Console log removed for performance

    // Get parsed items from the job
    // Console log removed for performance
    const parsedItems = await convex.query(api.priceMatching.getParsedItems, {
      jobId: toConvexId<'aiMatchingJobs'>(jobId),
    });
    
    // Console log removed for performance
    if (parsedItems.length > 0) {
      const itemsWithQty = parsedItems.filter(item => item.quantity && item.quantity > 0).length;
      const contextHeaders = parsedItems.filter(item => !item.quantity || item.quantity === 0).length;
      // Console log removed for performance
      // Console log removed for performance
      // Console log removed for performance
      // Console log removed for performance
    }

    if (parsedItems.length === 0) {
      // Console log removed for performance
      res.status(400).json({ error: 'No items found for this job' });
      return;
    }

    // Add job to processor queue
    // Console log removed for performance
    // Console log removed for performance
    
    // Console log removed for performance
    
    // Check if running in Lambda and should process synchronously
    if (LambdaProcessorService.isLambdaEnvironment() && lambdaProcessor.shouldProcessSynchronously(parsedItems.length)) {
      // Console log removed for performance
      
      // Process synchronously in Lambda for small files
      const result = await lambdaProcessor.processSynchronously(
        jobId,
        req.user.id.toString(),
        parsedItems,
        matchingMethod
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Lambda processing failed');
      }
    } else if (AsyncJobInvoker.shouldProcessAsync(parsedItems.length)) {
      // Console log removed for performance
      
      // Send to async processor
      await AsyncJobInvoker.sendToQueue({
        jobId: jobId,
        userId: req.user.id.toString(),
        items: parsedItems,
        method: matchingMethod
      });
      
      // Console log removed for performance
    } else {
      // Process synchronously for small jobs (non-Lambda)
      await jobProcessor.addJob(jobId, req.user.id.toString(), parsedItems, matchingMethod);
    }
    
    // Console log removed for performance
    // Console log removed for performance
    // Console log removed for performance

    res.json({
      success: true,
      message: 'Matching started',
      jobId,
    });
  } catch (error) {
    // Console log removed for performance
    res.status(500).json({ error: 'Failed to start matching' });
  }
}

export async function getJobStatus(req: Request, res: Response): Promise<void> {
  // Console log removed for performance
  try {
    const { jobId } = req.params;

    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // First check in-memory status from job processor
    const inMemoryJob = jobProcessor.getJobStatus(jobId);
    // Console log removed for performance
    
    const job = await convex.query(api.priceMatching.getJob, { jobId: toConvexId<'aiMatchingJobs'>(jobId) });
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    // Console log removed for performance

    if (job.userId !== req.user.id && req.user.role !== 'admin') {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Merge in-memory status with database status
    // For completed jobs, prefer database status to avoid stale in-memory data
    const isCompleted = job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled';
    const status = {
      _id: job._id,
      status: isCompleted ? job.status : (inMemoryJob?.status || job.status),
      progress: isCompleted ? job.progress : (inMemoryJob?.progress ?? job.progress),
      progressMessage: isCompleted ? job.progressMessage : (inMemoryJob?.progressMessage || job.progressMessage),
      itemCount: isCompleted ? job.itemCount : (inMemoryJob?.itemCount || job.itemCount),
      matchedCount: isCompleted ? job.matchedCount : (inMemoryJob?.matchedCount ?? job.matchedCount),
      error: job.error,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    };

    // Console log removed for performance

    res.json(status);
  } catch (error) {
    // Console log removed for performance
    res.status(500).json({ error: 'Failed to get job status' });
  }
}

export async function getMatchResults(req: Request, res: Response): Promise<void> {
  // Console log removed for performance
  try {
    const { jobId } = req.params;

    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Get the job to check ownership
    const job = await convex.query(api.priceMatching.getJob, { jobId: toConvexId<'aiMatchingJobs'>(jobId) });
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    if (job.userId !== req.user.id && req.user.role !== 'admin') {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Get results
    const results = await convex.query(api.priceMatching.getMatchResults, {
      jobId: toConvexId<'aiMatchingJobs'>(jobId),
    });

    // Console log removed for performance

    res.json(results);
  } catch (error) {
    // Console log removed for performance
    res.status(500).json({ error: 'Failed to get match results' });
  }
}

export async function updateMatchResult(req: Request, res: Response): Promise<void> {
  // Console log removed for performance
  // Console log removed for performance
  
  try {
    const { resultId } = req.params;
    const updates = req.body;

    if (!req.user) {
      // Console log removed for performance
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Console log removed for performance

    // Get the result to check ownership
    const result = await convex.query(api.priceMatching.getMatchResult, {
      resultId: toConvexId<'matchResults'>(resultId),
    });

    if (!result) {
      // Console log removed for performance
      res.status(404).json({ error: 'Result not found' });
      return;
    }

    // Console log removed for performance

    // Get the job to check ownership
    const job = await convex.query(api.priceMatching.getJob, {
      jobId: result.jobId as any,
    });

    if (!job || (job.userId !== req.user.id && req.user.role !== 'admin')) {
      // Console log removed for performance
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Console log removed for performance
    // Console log removed for performance

    try {
      // Update the result
      await convex.mutation(api.priceMatching.updateMatchResult, {
        resultId: toConvexId<'matchResults'>(resultId),
        updates: {
          matchedDescription: updates.matchedDescription,
          matchedCode: updates.matchedCode,
          matchedUnit: updates.matchedUnit,
          matchedRate: updates.matchedRate,
          confidence: updates.confidence,
          totalPrice: updates.totalPrice,
          notes: updates.notes,
          isManuallyEdited: updates.isManuallyEdited,
          matchMethod: updates.matchMethod,
        },
        userId: toConvexId<'users'>(req.user.id),
      });

      // Console log removed for performance
    } catch (mutationError) {
      // Console log removed for performance
      throw mutationError;
    }

    // Log activity
    await logActivity(req, 'update_match', 'matchResults', resultId, 'Updated match result');

    res.json({ success: true });
  } catch (error) {
    // Console log removed for performance
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update match result' });
  }
}

export async function exportResults(req: Request, res: Response): Promise<void> {
  try {
    const { jobId } = req.params;

    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Get the job
    const job = await convex.query(api.priceMatching.getJob, { jobId: toConvexId<'aiMatchingJobs'>(jobId) });
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    if (job.userId !== req.user.id && req.user.role !== 'admin') {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Get results
    const results = await convex.query(api.priceMatching.getMatchResults, {
      jobId: toConvexId<'aiMatchingJobs'>(jobId),
    });

    // Get original file
    const originalFile = await fileStorage.getFile(job.originalFileId);
    if (!originalFile) {
      res.status(404).json({ error: 'Original file not found' });
      return;
    }

    // Export to Excel
    const exportBuffer = await excelService.exportMatchResults(
      originalFile,
      results,
      {
        matchingMethod: job.matchingMethod,
        matchedCount: job.matchedCount,
        itemCount: job.itemCount,
      }
    );

    // Log activity
    await logActivity(req, 'export_results', 'aiMatchingJobs', jobId, 'Exported match results');

    // Send file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="matched_${job.fileName}"`);
    res.send(exportBuffer);
  } catch (error) {
    // Console log removed for performance
    res.status(500).json({ error: 'Failed to export results' });
  }
}

export async function stopJob(req: Request, res: Response): Promise<void> {
  try {
    const { jobId } = req.params;
    // Console log removed for performance
    // Console log removed for performance

    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Get the job to check ownership
    // Console log removed for performance
    let job;
    try {
      job = await ConvexWrapper.query(api.priceMatching.getJob, { jobId: toConvexId<'aiMatchingJobs'>(jobId) });
    } catch (queryError: any) {
      // Console log removed for performance
      if (queryError.status === 429 || queryError.message?.includes('429')) {
        res.status(503).json({ error: 'Service temporarily unavailable due to rate limiting. Please try again in a few seconds.' });
      } else {
        res.status(500).json({ error: 'Failed to query job status' });
      }
      return;
    }
    
    if (!job) {
      // Console log removed for performance
      res.status(404).json({ 
        error: 'Job not found',
        message: 'This job does not exist in the current database. It may have been created before a database migration or configuration change.'
      });
      return;
    }

    // Console log removed for performance
    
    // Allow admin or job owner to stop the job
    if (job.userId !== req.user.id && req.user.role !== 'admin') {
      // Console log removed for performance
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Check if job is already completed or failed
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      // Console log removed for performance
      res.status(400).json({ error: `Job is already ${job.status}` });
      return;
    }

    // Cancel the job in the processor
    // Console log removed for performance
    const cancelled = await jobProcessor.cancelJob(jobId);
    // Console log removed for performance
    
    if (cancelled) {
      // Update job status in database with retry handling
      try {
        await ConvexWrapper.mutation(api.priceMatching.updateJobStatus, {
          jobId: toConvexId<'aiMatchingJobs'>(jobId),
          status: 'failed',
          error: 'Job cancelled by user',
        });
        // Console log removed for performance
      } catch (updateError: any) {
        // Console log removed for performance
        // Don't fail the whole operation if we can't update the status
        // Console log removed for performance
      }

      // Log activity
      try {
        await logActivity(req, 'stop_job', 'aiMatchingJobs', jobId, 'Stopped matching job');
      } catch (logError) {
        // Console log removed for performance
      }

      res.json({ success: true, message: 'Job stopped' });
    } else {
      // Console log removed for performance
      res.status(400).json({ error: 'Job not found in processor or already completed' });
    }
  } catch (error) {
    // Console log removed for performance
    // Console log removed for performance
    res.status(500).json({ error: 'Failed to stop job' });
  }
}

export async function autoSaveResult(req: Request, res: Response): Promise<void> {
  try {
    const { resultId } = req.params;
    const updates = req.body;

    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Get the result to check ownership
    const result = await convex.query(api.priceMatching.getMatchResult, {
      resultId: toConvexId<'matchResults'>(resultId),
    });

    if (!result) {
      res.status(404).json({ error: 'Result not found' });
      return;
    }

    // Get the job to check ownership
    const job = await convex.query(api.priceMatching.getJob, {
      jobId: result.jobId as any,
    });

    if (!job || (job.userId !== req.user.id && req.user.role !== 'admin')) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Update the result (autosave doesn't change isManuallyEdited)
    await convex.mutation(api.priceMatching.updateMatchResult, {
      userId: toConvexId<'users'>(req.user.id),
      resultId: toConvexId<'matchResults'>(resultId),
      updates: {
        matchedDescription: updates.matchedDescription,
        matchedCode: updates.matchedCode,
        matchedUnit: updates.matchedUnit,
        matchedRate: updates.matchedRate,
        confidence: updates.confidence,
        totalPrice: updates.totalPrice,
        notes: updates.notes,
      },
    });

    res.json({ success: true });
  } catch (error) {
    // Console log removed for performance
    res.status(500).json({ error: 'Failed to autosave' });
  }
}

export async function runMatch(req: Request, res: Response): Promise<void> {
  try {
    const { resultId } = req.params;
    const { method = 'LOCAL' } = req.body;

    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Get the result
    const result = await convex.query(api.priceMatching.getMatchResult, {
      resultId: toConvexId<'matchResults'>(resultId),
    });

    if (!result) {
      res.status(404).json({ error: 'Result not found' });
      return;
    }

    // Get the job to check ownership
    const job = await convex.query(api.priceMatching.getJob, {
      jobId: result.jobId as any,
    });

    if (!job || (job.userId !== req.user.id && req.user.role !== 'admin')) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Get price items
    const priceItems = await convex.query(api.priceItems.getActive);

    // Run matching
    const matchResult = await matchingService.matchItem(
      result.originalDescription,
      method,
      priceItems,
      result.contextHeaders || []
    );

    // Update the result
    await convex.mutation(api.priceMatching.updateMatchResult, {
      userId: toConvexId<'users'>(req.user.id),
      resultId: toConvexId<'matchResults'>(resultId),
      updates: {
        matchedItemId: matchResult.matchedItemId,
        matchedDescription: matchResult.matchedDescription,
        matchedCode: matchResult.matchedCode,
        matchedUnit: matchResult.matchedUnit,
        matchedRate: matchResult.matchedRate,
        confidence: matchResult.confidence,
        totalPrice: (result.originalQuantity || 0) * (matchResult.matchedRate || 0),
        matchMethod: method,
      },
    });

    res.json({ success: true, matchResult });
  } catch (error) {
    // Console log removed for performance
    res.status(500).json({ error: 'Failed to run match' });
  }
}

export async function deleteJob(req: Request, res: Response): Promise<void> {
  try {
    const { jobId } = req.params;

    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Get the job to check ownership
    const job = await convex.query(api.priceMatching.getJob, { jobId: toConvexId<'aiMatchingJobs'>(jobId) });
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    if (job.userId !== req.user.id && req.user.role !== 'admin') {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Delete all match results for this job
    await convex.mutation(api.priceMatching.deleteJobResults, {
      jobId: toConvexId<'aiMatchingJobs'>(jobId),
    });

    // Delete the job
    await convex.mutation(api.priceMatching.deleteJob, {
      jobId: toConvexId<'aiMatchingJobs'>(jobId),
    });

    // Log activity
    await logActivity(req, 'delete_job', 'aiMatchingJobs', jobId, 'Deleted matching job');

    res.json({ success: true });
  } catch (error) {
    // Console log removed for performance
    res.status(500).json({ error: 'Failed to delete job' });
  }
}

export async function getProcessorStatus(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // In Lambda environment, return a static status since background processing doesn't work
    if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
      res.json({
        queueLength: 0,
        isProcessing: false,
        activeJobs: 0,
        completedJobs: 0,
        message: 'Background processing not available in Lambda environment'
      });
      return;
    }

    const status = jobProcessor.getQueueStatus();
    res.json(status);
  } catch (error) {
    // Console log removed for performance
    res.status(500).json({ error: 'Failed to get processor status' });
  }
}

export async function getMatchingMethods(req: Request, res: Response): Promise<void> {
  try {
    const methods = [
      { value: 'LOCAL', label: 'Local Matching', description: 'Fast fuzzy string matching' },
      { value: 'LOCAL_UNIT', label: 'Local + Unit', description: 'Fuzzy matching with unit awareness' },
      { value: 'V2', label: 'Cohere AI', description: 'AI-powered semantic matching (requires API key)' },
      { value: 'V1', label: 'V1', description: 'GPT-powered matching (requires API key)' },
      { value: 'HYBRID', label: 'Hybrid', description: 'Combines all methods for best results' },
      { value: 'HYBRID_CATEGORY', label: 'Hybrid + Category', description: 'Category-aware hybrid matching' },
      { value: 'ADVANCED', label: 'Advanced', description: 'Multi-stage pattern recognition' }
    ];
    res.json(methods);
  } catch (error) {
    // Console log removed for performance
    res.status(500).json({ error: 'Failed to get matching methods' });
  }
}

export async function testLocalMatch(req: Request, res: Response): Promise<void> {
  // Console log removed for performance
  try {
    const { description, contextHeaders } = req.body;

    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    if (!description) {
      res.status(400).json({ error: 'Description is required' });
      return;
    }

    // Console log removed for performance

    // Get all active price items for matching
    // Console log removed for performance
    const priceItems = await convex.query(api.priceItems.getActive);
    // Console log removed for performance
    
    if (!priceItems || priceItems.length === 0) {
      // Console log removed for performance
      res.status(500).json({ error: 'No price items available for matching' });
      return;
    }

    // Run local match test
    console.log('[testLocalMatch] Running local match with:', {
      description,
      contextHeaders,
      priceItemCount: priceItems.length
    });
    const matchResult = await matchingService.matchItem(
      description,
      'LOCAL',
      priceItems,
      contextHeaders || [] // Use provided context headers or empty array
    );
    console.log('[testLocalMatch] Match result:', {
      matchedDescription: matchResult.matchedDescription,
      confidence: matchResult.confidence,
      matchedRate: matchResult.matchedRate
    });

    // For now, return just the best match as an array
    const matches = [{
      description: matchResult.matchedDescription,
      code: matchResult.matchedCode,
      unit: matchResult.matchedUnit,
      rate: matchResult.matchedRate,
      confidence: matchResult.confidence,
    }];

    // Console log removed for performance

    res.json({
      matches: matches,
      bestMatch: matchResult,
    });
  } catch (error) {
    // Console log removed for performance
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to test local match' });
  }
}

export async function stopAllJobs(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Only allow admins or the user to stop their own jobs
    // For now, let's allow any authenticated user to stop all running jobs
    // Console log removed for performance

    // First, check processor status
    const processorStatus = jobProcessor.getQueueStatus();
    // Console log removed for performance
    
    const processorRunningJobs = jobProcessor.getRunningJobs();
    // Console log removed for performance

    // Get all running jobs from Convex
    let runningJobs = [];
    try {
      runningJobs = await ConvexWrapper.query(api.priceMatching.getRunningJobs, {});
    } catch (error: any) {
      // Console log removed for performance
      // Continue anyway - we can still cancel jobs in the processor
    }
    // Console log removed for performance

    // Cancel all jobs in the processor first
    const cancelledCount = await jobProcessor.cancelAllJobs();
    // Console log removed for performance

    // Update all running jobs in Convex to failed status with rate limit handling
    let convexUpdateCount = 0;
    const updatePromises = [];
    
    for (const job of runningJobs) {
      if (job.status !== 'completed' && job.status !== 'failed') {
        // Use no-retry wrapper for bulk operations to avoid cascading delays
        const updatePromise = ConvexWrapper.mutationNoRetry(api.priceMatching.updateJobStatus, {
          jobId: job._id as any,
          status: 'failed',
          error: 'Job stopped by user (bulk stop)',
        }).then(() => {
          convexUpdateCount++;
        }).catch((error: any) => {
          // Console log removed for performance
        });
        
        updatePromises.push(updatePromise);
        
        // Add delay between updates to avoid rate limits
        if (updatePromises.length % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    // Wait for all updates to complete
    await Promise.allSettled(updatePromises);
    // Console log removed for performance

    // Log activity
    await logActivity(req, 'stop_all_jobs', 'system', null, `Stopped all running jobs (${cancelledCount} cancelled)`);

    res.json({
      success: true,
      message: `Stopped ${cancelledCount} running jobs`,
      details: {
        processorCancelled: cancelledCount,
        convexUpdated: convexUpdateCount,
      }
    });
  } catch (error) {
    // Console log removed for performance
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to stop all jobs' });
  }
}



