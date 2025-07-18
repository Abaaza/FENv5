import { getConvexClient } from '../config/convex';
import { api } from '../lib/convex-api';
import { Id } from '../lib/convex-api';
import { toConvexId } from '../utils/convexId';
import { MatchingService } from './matching.service';

interface JobStatus {
  jobId: string;
  status: 'pending' | 'parsing' | 'matching' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  progressMessage: string;
  itemCount: number;
  matchedCount: number;
  startTime: number;
  lastUpdate: number;
  errors: string[];
  logs: Array<{
    timestamp: number;
    level: 'info' | 'error' | 'warning';
    message: string;
  }>;
}

export class JobPollingService {
  private convex = getConvexClient();
  private matchingService = MatchingService.getInstance();
  private activeJobs: Map<string, NodeJS.Timeout> = new Map();
  
  // Batch configuration
  private readonly BATCH_SIZE = 10;
  private readonly PROCESSING_INTERVAL = 2000; // Process every 2 seconds for serverless
  
  async createJob(jobId: string, userId: string, items: any[], method: string): Promise<void> {
    // Store job in Convex with initial status
    await this.convex.mutation(api.aiMatchingJobs.updateJobStatus, {
      jobId,
      status: 'pending',
      progress: 0,
      progressMessage: 'Job queued',
      itemCount: items.length,
      matchedCount: 0
    });
    
    // Store job logs
    await this.addJobLog(jobId, 'info', `Job created with ${items.length} items using ${method} method`);
    await this.addJobLog(jobId, 'info', `Timer started at 00:00`);
    
    // Start processing in background (will continue even if request ends)
    this.startProcessing(jobId, userId, items, method);
  }
  
  private async startProcessing(jobId: string, userId: string, items: any[], method: string): Promise<void> {
    try {
      // Update status to processing
      await this.convex.mutation(api.aiMatchingJobs.updateJobStatus, {
        jobId,
        status: 'processing',
        progressMessage: 'Processing items...'
      });
      
      await this.addJobLog(jobId, 'info', 'Starting batch processing...');
      
      let processedCount = 0;
      const contextHeaders: string[] = [];
      
      // Process items in batches
      for (let i = 0; i < items.length; i += this.BATCH_SIZE) {
        const batch = items.slice(i, i + this.BATCH_SIZE);
        
        for (const item of batch) {
          try {
            // Check if this is a context header
            if (!item.quantity || item.quantity === 0) {
              contextHeaders.push(item.description);
              
              // Save context header result
              await this.convex.mutation(api.priceMatching.createMatchResult, {
                jobId: toConvexId<'aiMatchingJobs'>(jobId),
                rowNumber: item.rowIndex || processedCount,
                originalDescription: item.description,
                originalQuantity: 0,
                originalUnit: '',
                matchMethod: 'CONTEXT',
                matchedDescription: item.description,
                matchedCode: '',
                matchedRate: 0,
                matchedUnit: '',
                confidence: 1,
                totalPrice: 0,
                notes: 'Context header'
              });
              
              await this.addJobLog(jobId, 'info', `Context header: ${item.description}`);
            } else {
              // Process regular item
              const result = await this.matchingService.matchItem(
                item.description,
                method as any,
                undefined,
                contextHeaders
              );
              
              await this.convex.mutation(api.priceMatching.createMatchResult, {
                jobId: toConvexId<'aiMatchingJobs'>(jobId),
                rowNumber: item.rowIndex || processedCount,
                originalDescription: item.description,
                originalQuantity: item.quantity,
                originalUnit: item.unit || '',
                matchMethod: method,
                matchedDescription: result.matchedDescription,
                matchedCode: result.matchedCode,
                matchedRate: result.matchedRate,
                matchedUnit: result.matchedUnit,
                confidence: result.confidence,
                totalPrice: (item.quantity || 0) * result.matchedRate
              });
              
              await this.addJobLog(jobId, 'info', 
                `Matched: "${item.description}" â†’ "${result.matchedDescription}" (${(result.confidence * 100).toFixed(1)}%)`
              );
            }
            
            processedCount++;
            
            // Update progress
            const progress = Math.round((processedCount / items.length) * 100);
            await this.convex.mutation(api.aiMatchingJobs.updateJobStatus, {
              jobId,
              progress,
              progressMessage: `Processed ${processedCount} of ${items.length} items`,
              matchedCount: processedCount
            });
            
          } catch (error: any) {
            await this.addJobLog(jobId, 'error', `Failed to process item: ${error.message}`);
          }
        }
        
        // Small delay between batches for serverless
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Mark job as completed
      await this.convex.mutation(api.aiMatchingJobs.updateJobStatus, {
        jobId,
        status: 'completed',
        progress: 100,
        progressMessage: `Completed processing ${processedCount} items`
      });
      
      await this.addJobLog(jobId, 'info', `Job completed successfully. Processed ${processedCount} items.`);
      
    } catch (error: any) {
      await this.convex.mutation(api.aiMatchingJobs.updateJobStatus, {
        jobId,
        status: 'failed',
        progressMessage: `Error: ${error.message}`
      });
      
      await this.addJobLog(jobId, 'error', `Job failed: ${error.message}`);
    }
  }
  
  async getJobStatus(jobId: string): Promise<JobStatus | null> {
    const job = await this.convex.query(api.priceMatching.getJob, { 
      jobId: toConvexId<'aiMatchingJobs'>(jobId) 
    });
    if (!job) return null;
    
    // Don't fetch logs here - they're handled by logStorage service
    
    return {
      jobId: job._id,
      status: job.status,
      progress: job.progress || 0,
      progressMessage: job.progressMessage || '',
      itemCount: job.itemCount,
      matchedCount: job.matchedCount || 0,
      startTime: job.startedAt,
      lastUpdate: Date.now(),
      errors: job.error ? [job.error] : [],
      logs: [] // Logs are fetched separately via the logs endpoint
    };
  }
  
  async cancelJob(jobId: string): Promise<void> {
    const timeout = this.activeJobs.get(jobId);
    if (timeout) {
      clearTimeout(timeout);
      this.activeJobs.delete(jobId);
    }
    
    await this.convex.mutation(api.aiMatchingJobs.updateJobStatus, {
      jobId,
      status: 'cancelled',
      progressMessage: 'Job cancelled by user'
    });
    
    await this.addJobLog(jobId, 'info', 'Job cancelled by user');
  }
  
  private async addJobLog(jobId: string, level: 'info' | 'error' | 'warning', message: string): Promise<void> {
    // Removed Convex log creation - logs are now handled by logStorage service
    console.log(`[Job ${jobId}] ${level.toUpperCase()}: ${message}`);
  }
  
  private async oldAddJobLog(jobId: string, level: 'info' | 'error' | 'warning', message: string): Promise<void> {
    try {
      // Disabled to prevent Convex rate limiting
      // await this.convex.mutation(api.jobLogs.create, {
      //   jobId,
      //   level,
      //   message
      // });
    } catch (error) {
      console.error('Failed to add job log:', error);
    }
  }
}
