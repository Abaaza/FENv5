import { useState, useCallback, useRef, useEffect } from 'react';
import { api } from '../lib/api';
import { retryWithBackoff } from '../utils/retryWithBackoff';

interface JobLog {
  timestamp: string; // ISO date string from backend
  level: 'info' | 'error' | 'warning' | 'success';
  message: string;
}

interface LogCache {
  logs: JobLog[];
  lastFetch: number;
  lastTimestamp: string | null;
}

const LOG_CACHE_DURATION = 10000; // Cache logs for 10 seconds
const LOG_POLL_INTERVAL = 10000; // Poll every 10 seconds to reduce load
const MAX_LOGS_PER_JOB = 500; // Keep last 500 logs for better history

export function useJobLogs() {
  const [jobLogs, setJobLogs] = useState<Record<string, JobLog[]>>({});
  const logCache = useRef<Map<string, LogCache>>(new Map());
  const activePolls = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Fetch logs for a specific job
  const fetchJobLogs = useCallback(async (jobId: string): Promise<JobLog[]> => {
    const now = Date.now();
    const cached = logCache.current.get(jobId);
    
    // Return cached logs if still fresh
    if (cached && (now - cached.lastFetch) < LOG_CACHE_DURATION) {
      return cached.logs;
    }

    try {
      // Only fetch new logs since last timestamp
      const lastTimestamp = cached?.lastTimestamp || null;
      const response = await retryWithBackoff(
        () => api.get(`/jobs/${jobId}/logs`, {
          params: lastTimestamp ? { since: lastTimestamp } : {}
        }),
        {
          maxRetries: 2,
          initialDelay: 3000,
          shouldRetry: (error) => {
            return error?.response?.status === 429 || 
                   error?.code === 'ERR_NETWORK';
          }
        }
      );
      
      const newLogs: JobLog[] = response.data.logs || [];
      
      // Merge with existing logs
      const existingLogs = cached?.logs || [];
      const mergedLogs = [...existingLogs, ...newLogs]
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .slice(-MAX_LOGS_PER_JOB); // Keep only last 100
      
      // Update cache
      logCache.current.set(jobId, {
        logs: mergedLogs,
        lastFetch: now,
        lastTimestamp: mergedLogs.length > 0 
          ? mergedLogs[mergedLogs.length - 1].timestamp 
          : lastTimestamp
      });
      
      return mergedLogs;
    } catch (error: any) {
      // Silently handle 429 errors - just return cached logs
      if (error?.response?.status === 429) {
        return cached?.logs || [];
      }
      // For other errors, return cached logs without logging
      return cached?.logs || [];
    }
  }, []);

  // Subscribe to logs for a job
  const subscribeToJobLogs = useCallback((jobId: string) => {
    // Stop any existing polling
    const existingPoll = activePolls.current.get(jobId);
    if (existingPoll) {
      clearInterval(existingPoll);
    }

    // Initial fetch
    fetchJobLogs(jobId).then(logs => {
      setJobLogs(prev => ({ ...prev, [jobId]: logs }));
    });

    // Set up polling
    const interval = setInterval(async () => {
      const logs = await fetchJobLogs(jobId);
      setJobLogs(prev => ({ ...prev, [jobId]: logs }));
    }, LOG_POLL_INTERVAL);

    activePolls.current.set(jobId, interval);
  }, [fetchJobLogs]);

  // Unsubscribe from logs
  const unsubscribeFromJobLogs = useCallback((jobId: string) => {
    const poll = activePolls.current.get(jobId);
    if (poll) {
      clearInterval(poll);
      activePolls.current.delete(jobId);
    }
    
    // Keep logs in state but clear cache
    logCache.current.delete(jobId);
  }, []);

  // Clear logs for a job
  const clearJobLogs = useCallback((jobId: string) => {
    setJobLogs(prev => {
      const { [jobId]: _, ...rest } = prev;
      return rest;
    });
    logCache.current.delete(jobId);
    unsubscribeFromJobLogs(jobId);
  }, [unsubscribeFromJobLogs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activePolls.current.forEach(interval => clearInterval(interval));
      activePolls.current.clear();
      logCache.current.clear();
    };
  }, []);

  return {
    jobLogs,
    subscribeToJobLogs,
    unsubscribeFromJobLogs,
    clearJobLogs,
  };
}