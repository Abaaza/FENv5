import { Request, Response } from 'express';
import { PerformanceLogger } from '../utils/performanceLogger';
import { MatchLogger } from '../utils/matchLogger';
import { AdaptiveBatchSizer } from '../utils/adaptiveBatchSize';
import { jobProcessor } from '../services/jobProcessor.service';
import { logStorage } from '../services/logStorage.service';

/**
 * Get comprehensive performance metrics for a job
 */
export async function getJobPerformanceMetrics(req: Request, res: Response): Promise<void> {
  try {
    const { jobId } = req.params;
    
    if (!jobId) {
      res.status(400).json({ error: 'Job ID is required' });
      return;
    }

    // Get performance metrics
    const performanceSummary = PerformanceLogger.getJobSummary(jobId);
    const matchingStats = MatchLogger.getJobStats(jobId);
    const problematicMatches = MatchLogger.getProblematicMatches(jobId);
    
    // Get adaptive batch sizing stats for different methods
    const batchStats = {
      LOCAL: AdaptiveBatchSizer.getPerformanceStats(jobId, 'LOCAL'),
      COHERE: AdaptiveBatchSizer.getPerformanceStats(jobId, 'COHERE'),
      OPENAI: AdaptiveBatchSizer.getPerformanceStats(jobId, 'OPENAI')
    };

    // Get current job status
    const jobStatus = jobProcessor.getJobStatus(jobId);
    const jobLogs = logStorage.getLogs(jobId);

    const metrics = {
      jobId,
      status: jobStatus?.status || 'unknown',
      performance: performanceSummary,
      matching: matchingStats,
      problematicMatches: problematicMatches.slice(0, 5), // Top 5 worst matches
      batchSizing: batchStats,
      logCount: jobLogs.length,
      currentProgress: jobStatus?.progress || 0,
      errors: jobStatus?.errors || []
    };

    res.json(metrics);
  } catch (error) {
    console.error('[Monitoring] Error getting job metrics:', error);
    res.status(500).json({ error: 'Failed to get job performance metrics' });
  }
}

/**
 * Get system-wide performance metrics
 */
export async function getSystemMetrics(req: Request, res: Response): Promise<void> {
  try {
    const queueStatus = jobProcessor.getQueueStatus();
    
    // Memory usage
    const memoryUsage = process.memoryUsage();
    const memoryMetrics = {
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
      rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
      external: Math.round(memoryUsage.external / 1024 / 1024) // MB
    };

    // Process info
    const uptime = process.uptime();
    const processInfo = {
      uptime: Math.round(uptime), // seconds
      uptimeHuman: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
      nodeVersion: process.version,
      platform: process.platform,
      pid: process.pid
    };

    // Lambda-specific metrics if available
    const lambdaMetrics = process.env.AWS_LAMBDA_FUNCTION_NAME ? {
      functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
      functionVersion: process.env.AWS_LAMBDA_FUNCTION_VERSION,
      memoryLimit: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE,
      region: process.env.AWS_REGION,
      remainingTime: (req as any).context?.getRemainingTimeInMillis?.() || null
    } : null;

    const metrics = {
      timestamp: new Date().toISOString(),
      queue: queueStatus,
      memory: memoryMetrics,
      process: processInfo,
      lambda: lambdaMetrics,
      environment: process.env.NODE_ENV
    };

    res.json(metrics);
  } catch (error) {
    console.error('[Monitoring] Error getting system metrics:', error);
    res.status(500).json({ error: 'Failed to get system metrics' });
  }
}

/**
 * Get matching method performance comparison
 */
export async function getMethodComparison(req: Request, res: Response): Promise<void> {
  try {
    const methods = ['LOCAL', 'COHERE', 'OPENAI', 'HYBRID'];
    const comparison: any = {};

    // This would need to aggregate data from multiple jobs
    // For now, return a structure that could be populated with real data
    for (const method of methods) {
      comparison[method] = {
        avgConfidence: 0,
        avgProcessingTime: 0,
        successRate: 0,
        apiCalls: 0,
        cacheHitRate: 0,
        totalJobs: 0
      };
    }

    res.json({
      methods: comparison,
      recommendation: 'LOCAL method recommended for speed, OPENAI for accuracy',
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Monitoring] Error getting method comparison:', error);
    res.status(500).json({ error: 'Failed to get method comparison' });
  }
}

/**
 * Clear performance data for a job
 */
export async function clearJobMetrics(req: Request, res: Response): Promise<void> {
  try {
    const { jobId } = req.params;
    
    if (!jobId) {
      res.status(400).json({ error: 'Job ID is required' });
      return;
    }

    // Clear all performance data
    PerformanceLogger.clearJobMetrics(jobId);
    MatchLogger.clearJobLogs(jobId);
    AdaptiveBatchSizer.clearJobData(jobId);
    logStorage.clearJob(jobId);

    res.json({ 
      success: true, 
      message: `Performance data cleared for job ${jobId}` 
    });
  } catch (error) {
    console.error('[Monitoring] Error clearing job metrics:', error);
    res.status(500).json({ error: 'Failed to clear job metrics' });
  }
}