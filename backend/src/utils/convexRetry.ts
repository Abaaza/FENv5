import { getConvexClient } from '../config/convex';

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
}

const defaultOptions: Required<RetryOptions> = {
  maxRetries: 5, // Increased for better handling of rate limits
  initialDelay: 2000, // Start with 2 seconds for rate limits
  maxDelay: 30000, // Max 30 seconds between retries
  backoffFactor: 2,
};

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...defaultOptions, ...options };
  let lastError: Error | null = null;
  let delay = opts.initialDelay;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a rate limit error (429)
      const isRateLimitError = error.status === 429 || 
                              error.message?.includes('429') ||
                              error.message?.includes('rate limit') ||
                              error.message?.includes('Too Many Requests');
      
      // Check if it's a network error
      const isNetworkError = error.message?.includes('fetch failed') || 
                           error.message?.includes('ETIMEDOUT') ||
                           error.message?.includes('ECONNREFUSED');
      
      const isRetryableError = isRateLimitError || isNetworkError;
      
      if (attempt < opts.maxRetries && isRetryableError) {
        // Use exponential backoff for rate limits
        if (isRateLimitError) {
          // For rate limits, use a longer delay with exponential backoff
          delay = Math.min(delay * Math.pow(opts.backoffFactor, attempt + 1), opts.maxDelay);
          console.log(`[ConvexRetry] Rate limit (429) hit. Waiting ${delay}ms before retry ${attempt + 1}/${opts.maxRetries}...`);
        } else {
          console.log(`[ConvexRetry] Network error. Retrying in ${delay}ms...`);
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }

  throw lastError || new Error('Operation failed after retries');
}

// Wrapped Convex operations
export async function convexQuery(api: any, args: any = {}) {
  return withRetry(async () => {
    const client = getConvexClient();
    return await client.query(api, args);
  });
}

export async function convexMutation(api: any, args: any = {}) {
  return withRetry(async () => {
    const client = getConvexClient();
    return await client.mutation(api, args);
  });
}
