interface JobLog {
  jobId: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  timestamp: string;
}

interface JobProgress {
  jobId: string;
  status: string;
  progress: number;
  progressMessage: string;
  matchedCount: number;
  itemCount: number;
  startTime: number;
}

class LogStorageService {
  private logs: Map<string, JobLog[]> = new Map();
  private jobProgress: Map<string, JobProgress> = new Map();
  private maxLogsPerJob = 1000;
  private logRetentionMs = 60 * 60 * 1000; // 1 hour

  addLog(jobId: string, level: 'info' | 'success' | 'warning' | 'error', message: string) {
    if (!this.logs.has(jobId)) {
      this.logs.set(jobId, []);
    }

    const logs = this.logs.get(jobId)!;
    const log: JobLog = {
      jobId,
      level,
      message,
      timestamp: new Date().toISOString()
    };

    logs.push(log);

    // Keep only the last N logs
    if (logs.length > this.maxLogsPerJob) {
      logs.shift();
    }

    // Log to console for debugging
    const icons = {
      info: 'â„¹ï¸',
      success: 'âœ…',
      warning: 'âš ï¸',
      error: 'âŒ'
    };
    console.log(`[Job ${jobId}] ${icons[level]}  ${message}`);
  }

  getLogs(jobId: string): JobLog[] {
    return this.logs.get(jobId) || [];
  }

  updateProgress(jobId: string, updates: Partial<JobProgress>) {
    const current = this.jobProgress.get(jobId) || {
      jobId,
      status: 'pending',
      progress: 0,
      progressMessage: '',
      matchedCount: 0,
      itemCount: 0,
      startTime: Date.now()
    };

    this.jobProgress.set(jobId, {
      ...current,
      ...updates
    });
  }

  getProgress(jobId: string): JobProgress | null {
    return this.jobProgress.get(jobId) || null;
  }

  clearJob(jobId: string) {
    this.logs.delete(jobId);
    this.jobProgress.delete(jobId);
  }

  // Clean up old logs periodically
  cleanupOldLogs() {
    const now = Date.now();
    for (const [jobId, progress] of this.jobProgress.entries()) {
      if (now - progress.startTime > this.logRetentionMs) {
        this.clearJob(jobId);
      }
    }
  }
}

// Create singleton instance
export const logStorage = new LogStorageService();

// Clean up old logs every 30 minutes
setInterval(() => {
  logStorage.cleanupOldLogs();
}, 30 * 60 * 1000);
