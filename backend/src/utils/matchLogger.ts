interface MatchScoreBreakdown {
  baseScore: number;
  unitBonus: number;
  categoryBonus: number;
  contextBonus: number;
  codeBonus: number;
  finalScore: number;
  confidence: number;
  method: string;
}

interface MatchLogEntry {
  timestamp: number;
  jobId: string;
  itemIndex: number;
  originalDescription: string;
  matchedDescription: string;
  scoreBreakdown: MatchScoreBreakdown;
  processingTime: number;
  cacheHit: boolean;
  apiCalls: number;
}

export class MatchLogger {
  private static logs: Map<string, MatchLogEntry[]> = new Map();
  private static readonly MAX_LOGS_PER_JOB = 1000;

  /**
   * Log a detailed match result
   */
  static logMatch(
    jobId: string,
    itemIndex: number,
    originalDescription: string,
    matchResult: any,
    scoreBreakdown: Partial<MatchScoreBreakdown>,
    processingTime: number,
    cacheHit: boolean = false,
    apiCalls: number = 0
  ): void {
    if (!this.logs.has(jobId)) {
      this.logs.set(jobId, []);
    }

    const entry: MatchLogEntry = {
      timestamp: Date.now(),
      jobId,
      itemIndex,
      originalDescription: originalDescription.substring(0, 100),
      matchedDescription: matchResult?.matchedDescription?.substring(0, 100) || 'No match',
      scoreBreakdown: {
        baseScore: scoreBreakdown.baseScore || 0,
        unitBonus: scoreBreakdown.unitBonus || 0,
        categoryBonus: scoreBreakdown.categoryBonus || 0,
        contextBonus: scoreBreakdown.contextBonus || 0,
        codeBonus: scoreBreakdown.codeBonus || 0,
        finalScore: scoreBreakdown.finalScore || 0,
        confidence: scoreBreakdown.confidence || 0,
        method: scoreBreakdown.method || 'unknown'
      },
      processingTime,
      cacheHit,
      apiCalls
    };

    const logs = this.logs.get(jobId)!;
    logs.push(entry);

    // Keep only recent logs
    if (logs.length > this.MAX_LOGS_PER_JOB) {
      logs.shift();
    }

    // Log detailed breakdown for low confidence matches
    if (entry.scoreBreakdown.confidence < 0.3) {
      console.log(`[MatchLogger] Low confidence match for item ${itemIndex}:`);
      console.log(`  Original: "${entry.originalDescription}"`);
      console.log(`  Matched: "${entry.matchedDescription}"`);
      console.log(`  Score breakdown:`, entry.scoreBreakdown);
      console.log(`  Cache hit: ${cacheHit}, API calls: ${apiCalls}, Time: ${processingTime}ms`);
    }
  }

  /**
   * Get match statistics for a job
   */
  static getJobStats(jobId: string): {
    totalMatches: number;
    avgConfidence: number;
    avgProcessingTime: number;
    cacheHitRate: number;
    totalApiCalls: number;
    lowConfidenceMatches: number;
    scoreDistribution: Record<string, number>;
  } | null {
    const logs = this.logs.get(jobId);
    if (!logs || logs.length === 0) return null;

    const stats = {
      totalMatches: logs.length,
      avgConfidence: 0,
      avgProcessingTime: 0,
      cacheHitRate: 0,
      totalApiCalls: 0,
      lowConfidenceMatches: 0,
      scoreDistribution: {
        '0-0.2': 0,
        '0.2-0.4': 0,
        '0.4-0.6': 0,
        '0.6-0.8': 0,
        '0.8-1.0': 0
      }
    };

    let totalConfidence = 0;
    let totalTime = 0;
    let cacheHits = 0;

    for (const log of logs) {
      totalConfidence += log.scoreBreakdown.confidence;
      totalTime += log.processingTime;
      stats.totalApiCalls += log.apiCalls;

      if (log.cacheHit) cacheHits++;
      if (log.scoreBreakdown.confidence < 0.3) stats.lowConfidenceMatches++;

      // Update score distribution
      const conf = log.scoreBreakdown.confidence;
      if (conf <= 0.2) stats.scoreDistribution['0-0.2']++;
      else if (conf <= 0.4) stats.scoreDistribution['0.2-0.4']++;
      else if (conf <= 0.6) stats.scoreDistribution['0.4-0.6']++;
      else if (conf <= 0.8) stats.scoreDistribution['0.6-0.8']++;
      else stats.scoreDistribution['0.8-1.0']++;
    }

    stats.avgConfidence = totalConfidence / logs.length;
    stats.avgProcessingTime = totalTime / logs.length;
    stats.cacheHitRate = (cacheHits / logs.length) * 100;

    return stats;
  }

  /**
   * Log job statistics summary
   */
  static logJobSummary(jobId: string): void {
    const stats = this.getJobStats(jobId);
    if (!stats) return;

    console.log(`[MatchLogger] Job ${jobId} Matching Statistics:`);
    console.log(`  Total matches: ${stats.totalMatches}`);
    console.log(`  Average confidence: ${(stats.avgConfidence * 100).toFixed(1)}%`);
    console.log(`  Average processing time: ${stats.avgProcessingTime.toFixed(1)}ms`);
    console.log(`  Cache hit rate: ${stats.cacheHitRate.toFixed(1)}%`);
    console.log(`  Total API calls: ${stats.totalApiCalls}`);
    console.log(`  Low confidence matches: ${stats.lowConfidenceMatches} (${((stats.lowConfidenceMatches / stats.totalMatches) * 100).toFixed(1)}%)`);
    console.log(`  Score distribution:`);
    for (const [range, count] of Object.entries(stats.scoreDistribution)) {
      const percentage = ((count / stats.totalMatches) * 100).toFixed(1);
      console.log(`    ${range}: ${count} (${percentage}%)`);
    }
  }

  /**
   * Get problematic matches (low confidence)
   */
  static getProblematicMatches(jobId: string, threshold: number = 0.3): MatchLogEntry[] {
    const logs = this.logs.get(jobId) || [];
    return logs.filter(log => log.scoreBreakdown.confidence < threshold)
      .sort((a, b) => a.scoreBreakdown.confidence - b.scoreBreakdown.confidence)
      .slice(0, 10); // Return worst 10 matches
  }

  /**
   * Clear logs for a job
   */
  static clearJobLogs(jobId: string): void {
    this.logs.delete(jobId);
  }
}