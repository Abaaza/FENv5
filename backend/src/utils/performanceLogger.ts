interface PerformanceMetrics {
  operation: string;
  duration: number;
  itemCount?: number;
  successCount?: number;
  failureCount?: number;
  avgTimePerItem?: number;
  apiCalls?: number;
  cacheHits?: number;
  cacheMisses?: number;
  metadata?: Record<string, any>;
}

export class PerformanceLogger {
  private static metrics: Map<string, PerformanceMetrics[]> = new Map();
  private static timers: Map<string, number> = new Map();

  /**
   * Start timing an operation
   */
  static startTimer(operationId: string): void {
    this.timers.set(operationId, Date.now());
  }

  /**
   * End timing and log metrics
   */
  static endTimer(operationId: string, metrics: Partial<PerformanceMetrics> = {}): PerformanceMetrics {
    const startTime = this.timers.get(operationId);
    if (!startTime) {
      console.warn(`[PerformanceLogger] No timer found for operation: ${operationId}`);
      return { operation: operationId, duration: 0, ...metrics };
    }

    const duration = Date.now() - startTime;
    this.timers.delete(operationId);

    const fullMetrics: PerformanceMetrics = {
      operation: operationId,
      duration,
      ...metrics
    };

    // Calculate average time per item if applicable
    if (fullMetrics.itemCount && fullMetrics.itemCount > 0) {
      fullMetrics.avgTimePerItem = duration / fullMetrics.itemCount;
    }

    // Store metrics
    const jobId = operationId.split('-')[0];
    if (!this.metrics.has(jobId)) {
      this.metrics.set(jobId, []);
    }
    this.metrics.get(jobId)!.push(fullMetrics);

    // Log performance
    this.logPerformance(fullMetrics);

    return fullMetrics;
  }

  /**
   * Log performance metrics in a structured format
   */
  private static logPerformance(metrics: PerformanceMetrics): void {
    const parts = [`[PERF] ${metrics.operation}`];
    
    // Duration
    parts.push(`${metrics.duration}ms`);
    
    // Items processed
    if (metrics.itemCount !== undefined) {
      parts.push(`${metrics.itemCount} items`);
      if (metrics.avgTimePerItem !== undefined) {
        parts.push(`${metrics.avgTimePerItem.toFixed(1)}ms/item`);
      }
    }
    
    // Success/failure rates
    if (metrics.successCount !== undefined && metrics.itemCount) {
      const successRate = (metrics.successCount / metrics.itemCount * 100).toFixed(1);
      parts.push(`${successRate}% success`);
    }
    
    // Cache performance
    if (metrics.cacheHits !== undefined && metrics.cacheMisses !== undefined) {
      const total = metrics.cacheHits + metrics.cacheMisses;
      if (total > 0) {
        const hitRate = (metrics.cacheHits / total * 100).toFixed(1);
        parts.push(`${hitRate}% cache hit`);
      }
    }
    
    // API calls
    if (metrics.apiCalls !== undefined) {
      parts.push(`${metrics.apiCalls} API calls`);
    }

    console.log(parts.join(' | '));
    
    // Log additional metadata if present
    if (metrics.metadata && Object.keys(metrics.metadata).length > 0) {
      console.log(`[PERF] ${metrics.operation} metadata:`, metrics.metadata);
    }
  }

  /**
   * Get performance summary for a job
   */
  static getJobSummary(jobId: string): {
    totalDuration: number;
    totalItems: number;
    avgTimePerItem: number;
    operations: number;
    apiCalls: number;
    cacheHitRate: number;
  } | null {
    const metrics = this.metrics.get(jobId);
    if (!metrics || metrics.length === 0) return null;

    const summary = {
      totalDuration: 0,
      totalItems: 0,
      avgTimePerItem: 0,
      operations: metrics.length,
      apiCalls: 0,
      cacheHitRate: 0
    };

    let totalCacheHits = 0;
    let totalCacheMisses = 0;

    for (const metric of metrics) {
      summary.totalDuration += metric.duration;
      summary.totalItems += metric.itemCount || 0;
      summary.apiCalls += metric.apiCalls || 0;
      totalCacheHits += metric.cacheHits || 0;
      totalCacheMisses += metric.cacheMisses || 0;
    }

    if (summary.totalItems > 0) {
      summary.avgTimePerItem = summary.totalDuration / summary.totalItems;
    }

    const totalCacheAccess = totalCacheHits + totalCacheMisses;
    if (totalCacheAccess > 0) {
      summary.cacheHitRate = (totalCacheHits / totalCacheAccess) * 100;
    }

    return summary;
  }

  /**
   * Log job performance summary
   */
  static logJobSummary(jobId: string): void {
    const summary = this.getJobSummary(jobId);
    if (!summary) return;

    console.log(`[PERF SUMMARY] Job ${jobId}:`);
    console.log(`  Total Duration: ${(summary.totalDuration / 1000).toFixed(2)}s`);
    console.log(`  Total Items: ${summary.totalItems}`);
    console.log(`  Avg Time/Item: ${summary.avgTimePerItem.toFixed(1)}ms`);
    console.log(`  Operations: ${summary.operations}`);
    console.log(`  API Calls: ${summary.apiCalls}`);
    console.log(`  Cache Hit Rate: ${summary.cacheHitRate.toFixed(1)}%`);
  }

  /**
   * Clear metrics for a job
   */
  static clearJobMetrics(jobId: string): void {
    this.metrics.delete(jobId);
    // Clear any timers for this job
    for (const [key] of this.timers) {
      if (key.startsWith(jobId)) {
        this.timers.delete(key);
      }
    }
  }
}