// Utility for exponential backoff retry logic
export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  shouldRetry?: (error: any) => boolean;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2,
    shouldRetry = (error) => {
      // Retry on 429 (rate limit) or network errors
      return error?.response?.status === 429 || 
             error?.code === 'ERR_NETWORK' ||
             error?.code === 'ERR_CONNECTION_REFUSED';
    }
  } = options;

  let lastError: any;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // Calculate next delay with jitter
      const jitter = Math.random() * 0.3 * delay; // 30% jitter
      const nextDelay = Math.min(delay * backoffFactor + jitter, maxDelay);
      
      if (error?.response?.status === 429) {
        // Try to use Retry-After header if available
        const retryAfter = error.response.headers?.['retry-after'];
        if (retryAfter) {
          delay = parseInt(retryAfter) * 1000;
        } else {
          delay = nextDelay;
        }
      } else {
        delay = nextDelay;
      }

      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}