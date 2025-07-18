import { ConvexHttpClient } from 'convex/browser';

export class ResilientConvexClient {
  private client: ConvexHttpClient;
  private maxRetries: number;
  private initialDelay: number;

  constructor(url: string, options: { maxRetries?: number; initialDelay?: number } = {}) {
    this.client = new ConvexHttpClient(url);
    this.maxRetries = options.maxRetries || 3;
    this.initialDelay = options.initialDelay || 1000;
  }

  async query(query: any, args?: any): Promise<any> {
    return this.withRetry(() => this.client.query(query, args));
  }

  async mutation(mutation: any, args?: any): Promise<any> {
    return this.withRetry(() => this.client.mutation(mutation, args));
  }

  async action(action: any, args?: any): Promise<any> {
    return this.withRetry(() => this.client.action(action, args));
  }

  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        if (attempt < this.maxRetries - 1) {
          const delay = this.initialDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }
}
