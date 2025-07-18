import { getConvexClient } from '../config/convex';
import { withRetry } from './convexRetry';

export class ConvexWrapper {
  private static convex = getConvexClient();
  
  /**
   * Execute a mutation with automatic retry on 429 errors
   */
  static async mutation<T = any>(api: any, args: any): Promise<T> {
    return withRetry(
      async () => this.convex.mutation(api, args),
      {
        maxRetries: 5,
        initialDelay: 3000,
        maxDelay: 30000,
        backoffFactor: 2
      }
    );
  }
  
  /**
   * Execute a query with automatic retry on 429 errors
   */
  static async query<T = any>(api: any, args: any): Promise<T> {
    return withRetry(
      async () => this.convex.query(api, args),
      {
        maxRetries: 5,
        initialDelay: 2000,
        maxDelay: 20000,
        backoffFactor: 2
      }
    );
  }
  
  /**
   * Execute a mutation with no retry (for non-critical operations)
   */
  static async mutationNoRetry<T = any>(api: any, args: any): Promise<T> {
    try {
      return await this.convex.mutation(api, args);
    } catch (error: any) {
      // If it's a 429 error, just log and return null
      if (error.status === 429 || error.message?.includes('429')) {
        console.log('[ConvexWrapper] Rate limit hit, skipping non-critical mutation');
        return null as any;
      }
      throw error;
    }
  }
}