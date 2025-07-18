export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  maxDelayMs?: number;
  timeout?: number;
  onRetry?: (error: Error, attempt: number) => void;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delayMs = 1000,
    backoffMultiplier = 2,
    maxDelayMs = 10000,
    timeout,
    onRetry
  } = options;

  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // If timeout is specified, race the function against a timeout
      if (timeout) {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Operation timed out after ${timeout}ms`)), timeout);
        });
        return await Promise.race([fn(), timeoutPromise]);
      } else {
        return await fn();
      }
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxAttempts) {
        throw lastError;
      }
      
      // Check if error is retryable
      if (!isRetryableError(error)) {
        throw error;
      }
      
      if (onRetry) {
        onRetry(lastError, attempt);
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        delayMs * Math.pow(backoffMultiplier, attempt - 1),
        maxDelayMs
      );
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

function isRetryableError(error: any): boolean {
  // Network errors
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
    return true;
  }
  
  // HTTP status codes that are retryable
  if (error.response?.status) {
    const status = error.response.status;
    // 429 (Rate Limited), 502 (Bad Gateway), 503 (Service Unavailable), 504 (Gateway Timeout)
    return status === 429 || status === 502 || status === 503 || status === 504;
  }
  
  // Rate limit errors from APIs
  if (error.message?.includes('rate limit') || error.message?.includes('Rate limit')) {
    return true;
  }
  
  return false;
}
