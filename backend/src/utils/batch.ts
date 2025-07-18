/**
 * Utility for batching operations to improve performance and avoid rate limits
 */

export interface BatchResult<T> {
  successful: T[];
  failed: Array<{ error: Error; item: any }>;
}

/**
 * Process items in batches with error handling
 * @param items Items to process
 * @param batchSize Number of items to process at once
 * @param processor Function to process each item
 * @returns Results with successful and failed items
 */
export async function processBatch<T, R>(
  items: T[],
  batchSize: number,
  processor: (item: T) => Promise<R>
): Promise<BatchResult<R>> {
  const results: BatchResult<R> = {
    successful: [],
    failed: []
  };

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    // Process batch items in parallel
    const batchPromises = batch.map(async (item) => {
      try {
        const result = await processor(item);
        return { success: true, result, item };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error : new Error('Unknown error'), item };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    
    // Separate successful and failed results
    for (const result of batchResults) {
      if (result.success) {
        results.successful.push(result.result as R);
      } else {
        results.failed.push({ error: result.error as Error, item: result.item });
      }
    }
  }

  return results;
}

/**
 * Process items with retry logic
 * @param items Items to process
 * @param processor Function to process each item
 * @param maxRetries Maximum number of retries for failed items
 * @param retryDelay Delay between retries in milliseconds
 */
export async function processWithRetry<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<BatchResult<R>> {
  const results: BatchResult<R> = {
    successful: [],
    failed: []
  };

  for (const item of items) {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await processor(item);
        results.successful.push(result);
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < maxRetries) {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        }
      }
    }
    
    // If all retries failed, add to failed list
    if (lastError && results.successful.length === 0) {
      results.failed.push({ error: lastError, item });
    }
  }

  return results;
}

/**
 * Chunk array into smaller arrays
 * @param array Array to chunk
 * @param chunkSize Size of each chunk
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  
  return chunks;
}
