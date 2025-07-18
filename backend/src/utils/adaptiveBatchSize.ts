import { getMatchingConfig } from '../config/matching.config';

interface BatchPerformance {
  batchSize: number;
  duration: number;
  itemsProcessed: number;
  avgTimePerItem: number;
  timestamp: number;
}

export class AdaptiveBatchSizer {
  private static performanceHistory: Map<string, BatchPerformance[]> = new Map();
  private static currentBatchSizes: Map<string, number> = new Map();
  private static readonly HISTORY_SIZE = 10;
  private static readonly ADJUSTMENT_THRESHOLD = 0.2; // 20% performance change triggers adjustment

  /**
   * Get optimal batch size based on recent performance
   */
  static getOptimalBatchSize(jobId: string, method: string): number {
    const config = getMatchingConfig();
    
    if (!config.performance.adaptiveBatchSize) {
      return 10; // Default batch size
    }

    const key = `${jobId}-${method}`;
    const currentSize = this.currentBatchSizes.get(key) || 10;
    const history = this.performanceHistory.get(key) || [];

    // Not enough history, use current size
    if (history.length < 3) {
      return currentSize;
    }

    // Calculate average performance for recent batches
    const recentBatches = history.slice(-5);
    const avgTimePerItem = recentBatches.reduce((sum, b) => sum + b.avgTimePerItem, 0) / recentBatches.length;
    
    // Target processing time per item (in ms)
    const targetTimePerItem = 500; // 500ms per item is reasonable for most methods

    let newSize = currentSize;

    if (avgTimePerItem < targetTimePerItem * (1 - this.ADJUSTMENT_THRESHOLD)) {
      // Performance is good, increase batch size
      newSize = Math.min(currentSize + 2, config.performance.maxBatchSize);
      console.log(`[AdaptiveBatch] Increasing batch size for ${method}: ${currentSize} -> ${newSize} (avg ${avgTimePerItem.toFixed(0)}ms/item)`);
    } else if (avgTimePerItem > targetTimePerItem * (1 + this.ADJUSTMENT_THRESHOLD)) {
      // Performance is poor, decrease batch size
      newSize = Math.max(currentSize - 2, config.performance.minBatchSize);
      console.log(`[AdaptiveBatch] Decreasing batch size for ${method}: ${currentSize} -> ${newSize} (avg ${avgTimePerItem.toFixed(0)}ms/item)`);
    }

    this.currentBatchSizes.set(key, newSize);
    return newSize;
  }

  /**
   * Record batch performance
   */
  static recordBatchPerformance(
    jobId: string,
    method: string,
    batchSize: number,
    duration: number,
    itemsProcessed: number
  ): void {
    const key = `${jobId}-${method}`;
    
    if (!this.performanceHistory.has(key)) {
      this.performanceHistory.set(key, []);
    }

    const performance: BatchPerformance = {
      batchSize,
      duration,
      itemsProcessed,
      avgTimePerItem: duration / itemsProcessed,
      timestamp: Date.now()
    };

    const history = this.performanceHistory.get(key)!;
    history.push(performance);

    // Keep only recent history
    if (history.length > this.HISTORY_SIZE) {
      history.shift();
    }

    // Log performance trends
    if (history.length >= 5) {
      const trend = this.calculatePerformanceTrend(history);
      if (Math.abs(trend) > 0.1) {
        console.log(`[AdaptiveBatch] Performance trend for ${method}: ${trend > 0 ? 'improving' : 'degrading'} by ${(Math.abs(trend) * 100).toFixed(1)}%`);
      }
    }
  }

  /**
   * Calculate performance trend (positive = improving, negative = degrading)
   */
  private static calculatePerformanceTrend(history: BatchPerformance[]): number {
    if (history.length < 2) return 0;

    const firstHalf = history.slice(0, Math.floor(history.length / 2));
    const secondHalf = history.slice(Math.floor(history.length / 2));

    const avgFirst = firstHalf.reduce((sum, b) => sum + b.avgTimePerItem, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((sum, b) => sum + b.avgTimePerItem, 0) / secondHalf.length;

    return (avgFirst - avgSecond) / avgFirst; // Positive if second half is faster
  }

  /**
   * Get performance statistics for a job
   */
  static getPerformanceStats(jobId: string, method: string): {
    currentBatchSize: number;
    avgTimePerItem: number;
    totalItemsProcessed: number;
    performanceTrend: string;
  } | null {
    const key = `${jobId}-${method}`;
    const history = this.performanceHistory.get(key);
    
    if (!history || history.length === 0) return null;

    const currentBatchSize = this.currentBatchSizes.get(key) || 10;
    const totalItems = history.reduce((sum, b) => sum + b.itemsProcessed, 0);
    const avgTime = history.reduce((sum, b) => sum + b.avgTimePerItem, 0) / history.length;
    const trend = this.calculatePerformanceTrend(history);

    return {
      currentBatchSize,
      avgTimePerItem: avgTime,
      totalItemsProcessed: totalItems,
      performanceTrend: trend > 0.1 ? 'improving' : trend < -0.1 ? 'degrading' : 'stable'
    };
  }

  /**
   * Clear performance data for a job
   */
  static clearJobData(jobId: string): void {
    // Clear all entries for this job
    for (const [key] of this.performanceHistory) {
      if (key.startsWith(jobId)) {
        this.performanceHistory.delete(key);
        this.currentBatchSizes.delete(key);
      }
    }
  }
}