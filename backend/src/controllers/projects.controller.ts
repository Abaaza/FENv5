﻿import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ExcelService } from '../services/excel.service';
import { getConvexClient } from '../config/convex';
import { api } from '../lib/convex-api';
import { Id } from '../lib/convex-api';
import { toConvexId } from '../utils/convexId';
import { MatchingService } from '../services/matching.service';
import { processBatch } from '../utils/batch';
import { projectLogger as logger } from '../utils/logger';

const convex = getConvexClient();
const excelService = new ExcelService();
const matchingService = MatchingService.getInstance();

export async function uploadForProject(req: Request, res: Response): Promise<void> {
  try {
    logger.info('Upload for project started', { 
      projectId: req.body.projectId,
      fileName: req.file?.originalname,
      fileSize: req.file?.size 
    });
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const projectId = req.body.projectId;
    if (!projectId) {
      res.status(400).json({ error: 'Project ID is required' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Get project details
    const project = await convex.query(api.projects.get, { 
      id: toConvexId<'projects'>(projectId) 
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Parse Excel file
    let excelData;
    try {
      excelData = await excelService.parseExcelFile(req.file.buffer, req.file.originalname);
    } catch (error) {
      logger.error('Excel parsing error', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        fileName: req.file.originalname 
      });
      res.status(400).json({ 
        error: error instanceof Error ? error.message : 'Failed to parse Excel file' 
      });
      return;
    }
    
    // Create job with project context
    const jobId = await convex.mutation(api.priceMatching.createJob, {
      userId: toConvexId<'users'>(req.user.id),
      fileName: req.file.originalname,
      itemCount: excelData.totalItems,
      matchingMethod: 'LOCAL' as const,
      projectId: toConvexId<'projects'>(projectId),
      projectName: project.name,
      headers: excelData.sheets[0]?.headers,
      sheetName: excelData.sheets[0]?.sheetName
    });

    // Store BOQ items from all sheets using batch processing
    const allItems = excelData.sheets.flatMap(sheet => sheet.items);
    
    const batchResults = await processBatch(
      allItems,
      10, // Process 10 items at a time
      async (item: any) => {
        return await convex.mutation(api.priceMatching.createMatchResult, {
          jobId: toConvexId<'aiMatchingJobs'>(jobId),
          rowNumber: item.rowNumber,
          originalDescription: item.description,
          originalQuantity: item.quantity,
          originalUnit: item.unit,
          originalRowData: item.originalData,
          confidence: 0,
          matchMethod: 'pending'
        });
      }
    );
    
    if (batchResults.failed.length > 0) {
      logger.warn('Failed to store some BOQ items', {
        failedCount: batchResults.failed.length,
        totalCount: allItems.length,
        jobId
      });
    }

    logger.info('Upload for project completed successfully', {
      jobId,
      itemCount: excelData.totalItems,
      projectId,
      projectName: project.name
    });
    
    res.json({
      jobId,
      itemCount: excelData.totalItems,
      fileName: req.file.originalname,
      projectId,
      projectName: project.name
    });
  } catch (error) {
    logger.error('Upload for project error:', error);
    res.status(500).json({ error: 'Failed to upload BOQ for project' });
  }
}

export async function uploadAndMatchForProject(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const projectId = req.body.projectId;
    if (!projectId) {
      res.status(400).json({ error: 'Project ID is required' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Get project details
    const project = await convex.query(api.projects.get, { 
      id: toConvexId<'projects'>(projectId) 
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Parse Excel file
    let excelData;
    try {
      excelData = await excelService.parseExcelFile(req.file.buffer, req.file.originalname);
    } catch (error) {
      logger.error('Excel parsing error', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        fileName: req.file.originalname 
      });
      res.status(400).json({ 
        error: error instanceof Error ? error.message : 'Failed to parse Excel file' 
      });
      return;
    }
    
    // Create job with project context
    const jobId = await convex.mutation(api.priceMatching.createJob, {
      userId: toConvexId<'users'>(req.user.id),
      fileName: req.file.originalname,
      itemCount: excelData.totalItems,
      matchingMethod: 'LOCAL' as const,
      projectId: toConvexId<'projects'>(projectId),
      projectName: project.name,
      headers: excelData.sheets[0]?.headers,
      sheetName: excelData.sheets[0]?.sheetName
    });

    // Update job status to processing
    await convex.mutation(api.priceMatching.updateJobStatus, {
      jobId: toConvexId<'aiMatchingJobs'>(jobId),
      status: 'matching',
      progress: 0
    });

    // Get price list items for matching
    const priceItems = await convex.query(api.priceItems.getAll, {});
    
    // Process matches for all items using batch processing
    let processedCount = 0;
    let matchedCount = 0;
    let totalValue = 0;
    
    const allItems = excelData.sheets.flatMap(sheet => sheet.items);
    
    // Process items in batches for better performance
    const batchSize = 5;
    for (let i = 0; i < allItems.length; i += batchSize) {
      const batch = allItems.slice(i, i + batchSize);
      
      // Process batch items in parallel
      const batchPromises = batch.map(async (item) => {
        // Find matches using LOCAL method
        const matchResult = await matchingService.matchItem(item.description, 'LOCAL', priceItems);
        
        // Use match result
        let matchedItemId = undefined;
        let matchedDescription = undefined;
        let matchedCode = undefined;
        let matchedUnit = undefined;
        let matchedRate = undefined;
        let confidence = 0;
        let itemTotalPrice = 0;
        
        try {
          if (matchResult && matchResult.confidence > 0.7) {
            matchedItemId = matchResult.matchedItemId;
            matchedDescription = matchResult.matchedDescription;
            matchedCode = matchResult.matchedCode;
            matchedUnit = matchResult.matchedUnit;
            matchedRate = matchResult.matchedRate;
            confidence = matchResult.confidence;
            
            if (item.quantity && matchedRate) {
              itemTotalPrice = item.quantity * matchedRate;
            }
          }
        } catch (error) {
          console.log('No match found for:', item.description);
        }

        // Store match result
        await convex.mutation(api.priceMatching.createMatchResult, {
          jobId: toConvexId<'aiMatchingJobs'>(jobId),
          rowNumber: item.rowNumber,
          originalDescription: item.description,
          originalQuantity: item.quantity,
          originalUnit: item.unit,
          originalRowData: item.originalData,
          matchedItemId,
          matchedDescription,
          matchedCode,
          matchedUnit,
          matchedRate,
          confidence,
          matchMethod: 'HYBRID',
          totalPrice: itemTotalPrice
        });
        
        return { matched: confidence > 0.7, totalPrice: itemTotalPrice };
      });
      
      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      
      // Update counts
      processedCount += batch.length;
      matchedCount += batchResults.filter(r => r.matched).length;
      totalValue += batchResults.reduce((sum, r) => sum + r.totalPrice, 0);
      
      // Update job progress
      const progress = Math.round((processedCount / excelData.totalItems) * 100);
      await convex.mutation(api.priceMatching.updateJobStatus, {
      jobId: toConvexId<'aiMatchingJobs'>(jobId),
        status: 'matching',
        progress,
        progressMessage: `Processing item ${processedCount} of ${excelData.totalItems}`
      });
    }

    // Mark job as completed
    await convex.mutation(api.priceMatching.updateJobStatus, {
      jobId: toConvexId<'aiMatchingJobs'>(jobId),
      status: 'completed',
      progress: 100
    });

    // Update matched count and total value
    await convex.mutation(api.priceMatching.updateMatchedCount, {
      jobId: toConvexId<'aiMatchingJobs'>(jobId),
      matchedCount
    });

    await convex.mutation(api.priceMatching.updateTotalValue, {
      jobId: toConvexId<'aiMatchingJobs'>(jobId),
      totalValue
    });

    // Update project total value if needed
    if (totalValue > 0) {
      const currentProject = await convex.query(api.projects.getById, { 
        _id: toConvexId<'projects'>(projectId) 
      });
      
      if (currentProject) {
        const newTotalValue = (currentProject.totalValue || 0) + totalValue;
        await convex.mutation(api.projects.updateTotalValue, {
          _id: toConvexId<'projects'>(projectId),
          totalValue: newTotalValue
        });
      }
    }

    res.json({
      jobId,
      itemCount: excelData.totalItems,
      fileName: req.file.originalname,
      projectId,
      projectName: project.name,
      status: 'completed',
      matchedCount,
      unmatchedCount: excelData.totalItems - matchedCount,
      totalValue
    });
  } catch (error) {
    logger.error('Upload and match for project error:', error);
    res.status(500).json({ error: 'Failed to process BOQ for project' });
  }
}

export async function exportProjectResults(req: Request, res: Response): Promise<void> {
  try {
    const { jobId } = req.params;
    const { includeProjectInfo = true } = req.query;

    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Get job details
    const job = await convex.query(api.priceMatching.getJob, { jobId: toConvexId<'aiMatchingJobs'>(jobId) });
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    // Verify user owns this job
    if (job.userId !== req.user.id) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    // Get all match results
    const results = await convex.query(api.priceMatching.getMatchResults, { 
      jobId: toConvexId<'aiMatchingJobs'>(jobId) 
    });
    
    // Get project info if linked
    let projectInfo = null;
    if (job.projectId && includeProjectInfo === 'true') {
      const project = await convex.query(api.projects.get, { 
        id: toConvexId<'projects'>(job.projectId) 
      });
      
      if (project) {
        projectInfo = {
          name: project.name,
          clientName: project.clientName,
          description: project.description,
          status: project.status,
          totalValue: project.totalValue,
          currency: 'USD' // Default currency
        };
      }
    }

    // Create Excel with results and project metadata
    const excelBuffer = await excelService.createExcelWithResults(
      null, // We don't store the original file buffer in Convex
      results,
      {
        sheets: job.sheetName ? [job.sheetName] : [],
        headers: job.headers || [],
        projectInfo
      }
    );

    // Set response headers
    const fileName = projectInfo 
      ? `${projectInfo.name.replace(/[^a-z0-9]/gi, '_')}_${job.fileName}`
      : `matched_${job.fileName}`;
      
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    res.send(excelBuffer);
  } catch (error) {
    logger.error('Export project results error:', error);
    res.status(500).json({ error: 'Failed to export project results' });
  }
}

export async function getProjectJobs(req: Request, res: Response): Promise<void> {
  try {
    const { projectId } = req.params;

    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Verify project exists
    const project = await convex.query(api.projects.get, { 
      id: toConvexId<'projects'>(projectId) 
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Get all jobs for this project
    const jobs = await convex.query(api.priceMatching.getJobsByProject, {
      projectId: toConvexId<'projects'>(projectId)
    });

    res.json(jobs);
  } catch (error) {
    logger.error('Get project jobs error:', error);
    res.status(500).json({ error: 'Failed to get project jobs' });
  }
}

export async function linkJobToProject(req: Request, res: Response): Promise<void> {
  try {
    const { jobId } = req.params;
    const { projectId } = req.body;

    if (!projectId) {
      res.status(400).json({ error: 'Project ID is required' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Verify job exists and user owns it
    const job = await convex.query(api.priceMatching.getJob, { 
      jobId: toConvexId<'aiMatchingJobs'>(jobId) 
    });
    
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    if (job.userId !== req.user.id && req.user.role !== 'admin') {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    // Verify project exists
    const project = await convex.query(api.projects.get, { 
      id: toConvexId<'projects'>(projectId) 
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Update job with project reference
    await convex.mutation(api.priceMatching.linkJobToProject, {
      jobId: toConvexId<'aiMatchingJobs'>(jobId),
      projectId: toConvexId<'projects'>(projectId),
      projectName: project.name
    });

    res.json({ 
      success: true, 
      message: 'Job linked to project successfully',
      projectName: project.name 
    });
  } catch (error) {
    logger.error('Link job to project error:', error);
    res.status(500).json({ error: 'Failed to link job to project' });
  }
}

export async function unlinkJobFromProject(req: Request, res: Response): Promise<void> {
  try {
    const { jobId } = req.params;

    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Verify job exists and user owns it
    const job = await convex.query(api.priceMatching.getJob, { 
      jobId: toConvexId<'aiMatchingJobs'>(jobId) 
    });
    
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    if (job.userId !== req.user.id && req.user.role !== 'admin') {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    if (!job.projectId) {
      res.status(400).json({ error: 'Job is not linked to any project' });
      return;
    }

    // Remove project reference from job
    await convex.mutation(api.priceMatching.unlinkJobFromProject, {
      jobId: toConvexId<'aiMatchingJobs'>(jobId)
    });

    res.json({ 
      success: true, 
      message: 'Job unlinked from project successfully' 
    });
  } catch (error) {
    logger.error('Unlink job from project error:', error);
    res.status(500).json({ error: 'Failed to unlink job from project' });
  }
}
