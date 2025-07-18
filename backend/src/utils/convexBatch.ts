import { getConvexClient } from '../config/convex';
import { api } from '../lib/convex-api';

interface BatchOperation {
  mutation: any;
  args: any;
}

export class ConvexBatchProcessor {
  private static readonly MAX_BATCH_SIZE = 5; // Reduced to avoid rate limits
  private static readonly BATCH_DELAY = 2000; // 2 seconds between batches
  private static readonly RETRY_DELAY = 5000; // 5 seconds on rate limit
  private static readonly MAX_RETRIES = 5; // Increased retries for 429 errors

  /**
   * Process multiple mutations in batches to avoid rate limits
   */
  static async processBatch(operations: BatchOperation[]): Promise<{ success: number; failed: number; errors: any[] }> {
    const convex = getConvexClient();
    const results = { success: 0, failed: 0, errors: [] as any[] };
    
    // Process in smaller batches
    for (let i = 0; i < operations.length; i += this.MAX_BATCH_SIZE) {
      const batch = operations.slice(i, i + this.MAX_BATCH_SIZE);
      
      // Process batch in parallel with retry logic
      const batchPromises = batch.map(async (op, index) => {
        let retries = 0;
        while (retries < this.MAX_RETRIES) {
          try {
            await convex.mutation(op.mutation, op.args);
            return { success: true, index: i + index };
          } catch (error: any) {
            retries++;
            
            // Check if it's a rate limit error
            if (error.status === 429 || 
                error.message?.includes('429') || 
                error.message?.includes('rate limit') ||
                error.message?.includes('Too Many Requests') ||
                error.code === 'TOO_MANY_REQUESTS') {
              const backoffDelay = this.RETRY_DELAY * Math.pow(2, retries - 1); // Exponential backoff
              console.log(`[ConvexBatch] Rate limited (429), waiting ${backoffDelay}ms before retry ${retries}/${this.MAX_RETRIES}`);
              await new Promise(resolve => setTimeout(resolve, backoffDelay));
              continue;
            }
            
            // Other errors, don't retry
            return { success: false, index: i + index, error };
          }
        }
        return { success: false, index: i + index, error: new Error('Max retries exceeded') };
      });
      
      // Wait for batch to complete
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, idx) => {
        if (result.status === 'fulfilled' && result.value.success) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push({
            index: i + idx,
            error: result.status === 'rejected' ? result.reason : result.value?.error
          });
        }
      });
      
      // Delay between batches to avoid rate limits
      if (i + this.MAX_BATCH_SIZE < operations.length) {
        await new Promise(resolve => setTimeout(resolve, this.BATCH_DELAY));
      }
    }
    
    return results;
  }

  /**
   * Save match results in efficient batches
   */
  static async saveMatchResults(results: any[]): Promise<{ saved: number; failed: number }> {
    console.log(`[ConvexBatch] Saving ${results.length} match results in batches`);
    
    const operations: BatchOperation[] = results.map(result => ({
      mutation: api.priceMatching.createMatchResult,
      args: result
    }));
    
    const batchResult = await this.processBatch(operations);
    
    console.log(`[ConvexBatch] Saved ${batchResult.success}/${results.length} results (${batchResult.failed} failed)`);
    
    if (batchResult.errors.length > 0) {
      console.error('[ConvexBatch] Errors:', batchResult.errors);
    }
    
    return { saved: batchResult.success, failed: batchResult.failed };
  }
}