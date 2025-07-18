import { QueryClient } from '@tanstack/react-query';

// Create a custom query client with optimized settings
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Increase stale time to reduce refetches
      staleTime: 5 * 60 * 1000, // 5 minutes
      // Increase cache time
      gcTime: 10 * 60 * 1000, // 10 minutes (previously cacheTime)
      // Reduce refetch on window focus
      refetchOnWindowFocus: false,
      // Retry with exponential backoff
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors except 429
        if (error?.status && error.status >= 400 && error.status < 500 && error.status !== 429) {
          return false;
        }
        // Retry up to 3 times with exponential backoff
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => {
        // Exponential backoff: 1s, 2s, 4s
        return Math.min(1000 * 2 ** attemptIndex, 4000);
      },
    },
    mutations: {
      // Add retry logic for mutations
      retry: (failureCount, error: any) => {
        // Only retry on network errors or 429
        if (error?.status === 429 || !error?.status) {
          return failureCount < 2;
        }
        return false;
      },
      retryDelay: (attemptIndex) => {
        return Math.min(1000 * 2 ** attemptIndex, 4000);
      },
    },
  },
});

// Custom hooks for specific query patterns
export const queryKeys = {
  jobs: ['user-jobs'] as const,
  jobStatus: (jobId: string) => ['job-status', jobId] as const,
  matchResults: (jobId: string) => ['match-results', jobId] as const,
  clients: ['clients'] as const,
  priceItems: ['price-items'] as const,
  activities: (entityId?: string) => ['activities', entityId] as const,
};

// Intelligent refetch intervals based on status
export const getRefetchInterval = (status?: string): number | false => {
  if (!status) return false;
  
  switch (status) {
    case 'completed':
    case 'failed':
    case 'stopped':
    case 'cancelled':
      return false; // No refetch needed
    case 'pending':
    case 'queued':
      return 1000; // 1 second for pending jobs (faster initial feedback)
    case 'parsing':
    case 'matching':
      return 2000; // 2 seconds for active jobs
    default:
      return 5000; // 5 seconds for other states
  }
};