import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/auth.store';
import { toast } from 'react-hot-toast';

interface JobProgress {
  jobId: string;
  status: string;
  progress: number;
  progressMessage: string;
  matchedCount: number;
  itemCount: number;
}

interface ProcessorStatus {
  queueLength: number;
  isProcessing: boolean;
  activeJobs: number;
  completedJobs: number;
}

interface JobLog {
  jobId: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  timestamp: string;
}

export function useWebSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [jobProgress, setJobProgress] = useState<Record<string, JobProgress>>({});
  const [jobLogs, setJobLogs] = useState<Record<string, JobLog[]>>({});
  const [processorStatus, setProcessorStatus] = useState<ProcessorStatus | null>(null);
  const { user } = useAuthStore();
  const token = localStorage.getItem('accessToken');

  // Connect to WebSocket server
  useEffect(() => {
    if (!token || !user) return;

    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('WebSocket connected');
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setConnected(false);
    });

    // Job events
    socket.on('job:queued', (data) => {
      console.log('Job queued:', data);
      toast.success(`Job queued with ${data.itemCount} items`);
    });

    socket.on('job:started', (data) => {
      console.log('Job started:', data);
    });

    socket.on('job:progress', (data: JobProgress) => {
      console.log('Job progress update:', data);
      setJobProgress(prev => ({
        ...prev,
        [data.jobId]: data,
      }));
    });

    socket.on('job:status', (data: JobProgress) => {
      console.log('Job status update:', data);
      setJobProgress(prev => ({
        ...prev,
        [data.jobId]: data,
      }));
    });

    socket.on('job:completed', (data) => {
      console.log('Job completed:', data);
      toast.success(`Job completed! Matched ${data.matchedCount} of ${data.itemCount} items`);
      
      // Remove from progress after a delay
      setTimeout(() => {
        setJobProgress(prev => {
          const { [data.jobId]: _, ...rest } = prev;
          return rest;
        });
      }, 5000);
    });

    socket.on('job:failed', (data) => {
      console.log('Job failed:', data);
      toast.error(`Job failed: ${data.error || 'Unknown error'}`);
      
      // Remove from progress
      setJobProgress(prev => {
        const { [data.jobId]: _, ...rest } = prev;
        return rest;
      });
    });

    socket.on('job:cancelled', (data) => {
      console.log('Job cancelled:', data);
      toast('Job cancelled');
      
      // Remove from progress
      setJobProgress(prev => {
        const { [data.jobId]: _, ...rest } = prev;
        return rest;
      });
    });

    // Job status updates
    socket.on('job:status', (data: JobProgress) => {
      setJobProgress(prev => ({
        ...prev,
        [data.jobId]: data,
      }));
    });

    // Processor status
    socket.on('processor:status', (data: ProcessorStatus) => {
      setProcessorStatus(data);
    });

    // Job logs
    socket.on('job:log', (data: JobLog) => {
      setJobLogs(prev => ({
        ...prev,
        [data.jobId]: [...(prev[data.jobId] || []), data].slice(-100), // Keep last 100 logs per job
      }));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, user]);

  // Subscribe to job updates
  const subscribeToJob = useCallback((jobId: string) => {
    if (socketRef.current) {
      console.log('Subscribing to job:', jobId);
      socketRef.current.emit('subscribe:job', jobId);
    } else {
      console.warn('Socket not connected, cannot subscribe to job:', jobId);
    }
  }, []);

  // Unsubscribe from job updates
  const unsubscribeFromJob = useCallback((jobId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('unsubscribe:job', jobId);
    }
  }, []);

  // Request processor status
  const requestProcessorStatus = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('processor:status');
    }
  }, []);

  // Clear logs for a job
  const clearJobLogs = useCallback((jobId: string) => {
    setJobLogs(prev => {
      const { [jobId]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  return {
    connected,
    jobProgress,
    jobLogs,
    processorStatus,
    subscribeToJob,
    unsubscribeFromJob,
    requestProcessorStatus,
    clearJobLogs,
  };
}