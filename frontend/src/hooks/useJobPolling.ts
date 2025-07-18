import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import { toast } from 'react-hot-toast';
import { retryWithBackoff } from '../utils/retryWithBackoff';

interface JobProgress {
  jobId: string;
  status: string;
  progress: number;
  progressMessage: string;
  matchedCount: number;
  itemCount: number;
}


interface JobStatus {
  jobId: string;
  status: 'pending' | 'parsing' | 'matching' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  progressMessage: string;
  itemCount: number;
  matchedCount: number;
  startTime: number;
  lastUpdate: number;
  errors: string[];
}

export function useJobPolling() {
  const [connected, setConnected] = useState(true); // Always "connected" for polling
  const [jobProgress, setJobProgress] = useState<Record<string, JobProgress>>({});
  const activePolls = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const lastStatusRef = useRef<Map<string, string>>(new Map());

  // Poll job status with retry logic
  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      const response = await retryWithBackoff(
        () => api.get(`/jobs/${jobId}/status`),
        {
          maxRetries: 3,
          initialDelay: 2000,
          shouldRetry: (error) => {
            // Retry on 429 or connection errors
            return error?.response?.status === 429 || 
                   error?.code === 'ERR_NETWORK' ||
                   error?.code === 'ERR_CONNECTION_REFUSED';
          }
        }
      );
      const status: JobStatus = response.data;
      
      // Get previous status first
      const previousStatus = lastStatusRef.current.get(jobId);
      
      // Remove console logging for production
      
      // Update progress
      setJobProgress(prev => ({
        ...prev,
        [jobId]: {
          jobId: status.jobId,
          status: status.status,
          progress: status.progress,
          progressMessage: status.progressMessage,
          matchedCount: status.matchedCount,
          itemCount: status.itemCount,
        }
      }));
      
      // Check for status changes
      if (previousStatus !== status.status) {
        // Status change already logged above when in development
        lastStatusRef.current.set(jobId, status.status);
        
        // Show notifications for status changes
        if (status.status === 'completed') {
          toast.success(`Job completed! Matched ${status.matchedCount} of ${status.itemCount} items`);
          // Stop polling after completion
          stopPolling(jobId);
          // Keep the completed status in memory for longer
          setTimeout(() => {
            setJobProgress(prev => {
              const { [jobId]: _, ...rest } = prev;
              return rest;
            });
          }, 60000); // Keep for 1 minute instead of 5 seconds
        } else if (status.status === 'failed') {
          toast.error(`Job failed: ${status.errors?.[0] || 'Unknown error'}`);
          stopPolling(jobId);
          // Remove from progress
          setJobProgress(prev => {
            const { [jobId]: _, ...rest } = prev;
            return rest;
          });
        } else if (status.status === 'cancelled') {
          toast('Job cancelled');
          stopPolling(jobId);
          // Remove from progress
          setJobProgress(prev => {
            const { [jobId]: _, ...rest } = prev;
            return rest;
          });
        }
      }
      
      // Continue polling if job is still running
      if (status.status === 'pending' || status.status === 'parsing' || status.status === 'processing' || status.status === 'matching') {
        return true; // Continue polling
      }
      
      return false; // Stop polling
      
    } catch (error: any) {
      // Handle specific error types
      if (error?.response?.status === 429) {
        // Rate limited - increase polling interval temporarily
        return true;
      } else if (error?.code === 'ERR_CONNECTION_REFUSED' || error?.code === 'ERR_NETWORK') {
        // Connection error - continue polling but don't spam errors
        return true;
      }
      // For other errors, stop polling
      return false;
    }
  }, []);

  // Stop polling for a specific job
  const stopPolling = useCallback((jobId: string) => {
    const timeout = activePolls.current.get(jobId);
    if (timeout) {
      clearInterval(timeout);
      activePolls.current.delete(jobId);
      lastStatusRef.current.delete(jobId);
    }
  }, []);

  // Subscribe to job updates (start polling)
  const subscribeToJob = useCallback((jobId: string) => {
    
    // Stop any existing polling for this job
    stopPolling(jobId);
    
    // Initial poll
    pollJobStatus(jobId);
    
    // Fixed interval polling - adaptive rates were causing infinite loops
    const interval = setInterval(async () => {
      const shouldContinue = await pollJobStatus(jobId);
      if (!shouldContinue) {
        stopPolling(jobId);
      }
    }, 5000); // 5 second intervals to reduce server load
    
    activePolls.current.set(jobId, interval);
  }, [pollJobStatus, stopPolling]);

  // Unsubscribe from job updates (stop polling)
  const unsubscribeFromJob = useCallback((jobId: string) => {
    stopPolling(jobId);
  }, [stopPolling]);


  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Stop all active polls
      activePolls.current.forEach((timeout) => {
        clearInterval(timeout);
      });
      activePolls.current.clear();
      lastStatusRef.current.clear();
    };
  }, []);

  // Mock processor status (not needed for serverless)
  const processorStatus = null;
  const requestProcessorStatus = useCallback(() => {
    // No-op for polling system
  }, []);

  return {
    connected,
    jobProgress,
    processorStatus,
    subscribeToJob,
    unsubscribeFromJob,
    requestProcessorStatus,
  };
}