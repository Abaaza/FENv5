// API Request Queue and Batching System
interface QueuedRequest {
  id: string;
  endpoint: string;
  method: string;
  data?: any;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timestamp: number;
  retryCount: number;
}

class APIOptimizer {
  private requestQueue: Map<string, QueuedRequest> = new Map();
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly BATCH_DELAY = 100; // ms
  private readonly MAX_BATCH_SIZE = 10;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff
  
  // Rate limiting tracking
  private requestCounts: Map<string, number[]> = new Map();
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private readonly MAX_REQUESTS_PER_WINDOW = 100;

  // Check if we're approaching rate limit
  isRateLimited(endpoint: string): boolean {
    const now = Date.now();
    const endpointRequests = this.requestCounts.get(endpoint) || [];
    
    // Clean up old requests
    const recentRequests = endpointRequests.filter(
      timestamp => now - timestamp < this.RATE_LIMIT_WINDOW
    );
    
    this.requestCounts.set(endpoint, recentRequests);
    return recentRequests.length >= this.MAX_REQUESTS_PER_WINDOW * 0.8; // 80% threshold
  }

  // Track a request
  trackRequest(endpoint: string) {
    const now = Date.now();
    const endpointRequests = this.requestCounts.get(endpoint) || [];
    endpointRequests.push(now);
    this.requestCounts.set(endpoint, endpointRequests);
  }

  // Queue a request for batching
  queueRequest(
    endpoint: string,
    method: string,
    data?: any
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = `${endpoint}-${method}-${JSON.stringify(data)}`;
      
      // Check if we're rate limited
      if (this.isRateLimited(endpoint)) {
        // Delay the request
        const delay = Math.random() * 5000 + 2000; // 2-7 seconds random delay
        setTimeout(() => {
          this.queueRequest(endpoint, method, data)
            .then(resolve)
            .catch(reject);
        }, delay);
        return;
      }

      // If request already queued, return existing promise
      const existing = this.requestQueue.get(id);
      if (existing) {
        return;
      }

      this.requestQueue.set(id, {
        id,
        endpoint,
        method,
        data,
        resolve,
        reject,
        timestamp: Date.now(),
        retryCount: 0,
      });

      this.scheduleBatch();
    });
  }

  private scheduleBatch() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    this.batchTimer = setTimeout(() => {
      this.processBatch();
    }, this.BATCH_DELAY);
  }

  private async processBatch() {
    const requests = Array.from(this.requestQueue.values())
      .slice(0, this.MAX_BATCH_SIZE);

    if (requests.length === 0) return;

    // Group requests by endpoint
    const grouped = requests.reduce((acc, req) => {
      const key = `${req.endpoint}-${req.method}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(req);
      return acc;
    }, {} as Record<string, QueuedRequest[]>);

    // Process each group
    for (const [key, groupRequests] of Object.entries(grouped)) {
      await this.processRequestGroup(groupRequests);
    }

    // Process remaining requests if any
    if (this.requestQueue.size > 0) {
      this.scheduleBatch();
    }
  }

  private async processRequestGroup(requests: QueuedRequest[]) {
    const { endpoint, method } = requests[0];
    
    try {
      // For mutations, execute them sequentially with small delays
      if (method !== 'GET') {
        for (const request of requests) {
          try {
            this.trackRequest(endpoint);
            // Execute request (this would be replaced with actual API call)
            const result = await this.executeRequest(request);
            request.resolve(result);
            this.requestQueue.delete(request.id);
            
            // Small delay between mutations
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (error) {
            this.handleRequestError(request, error);
          }
        }
      } else {
        // For queries, we can potentially batch them
        // For now, execute them with delays
        for (const request of requests) {
          try {
            this.trackRequest(endpoint);
            const result = await this.executeRequest(request);
            request.resolve(result);
            this.requestQueue.delete(request.id);
          } catch (error) {
            this.handleRequestError(request, error);
          }
        }
      }
    } catch (error) {
      // Handle batch-level errors
      requests.forEach(req => {
        req.reject(error);
        this.requestQueue.delete(req.id);
      });
    }
  }

  private async executeRequest(request: QueuedRequest): Promise<any> {
    // This is a placeholder - in real implementation, this would make the actual API call
    // For now, we'll throw an error to demonstrate retry logic
    throw new Error('Execute request not implemented');
  }

  private async handleRequestError(request: QueuedRequest, error: any) {
    // Check if it's a rate limit error
    if (error?.status === 429 || error?.message?.includes('429')) {
      // Exponential backoff retry
      if (request.retryCount < this.MAX_RETRIES) {
        request.retryCount++;
        const delay = this.RETRY_DELAYS[request.retryCount - 1];
        
        setTimeout(() => {
          this.requestQueue.set(request.id, request);
          this.scheduleBatch();
        }, delay);
        
        return;
      }
    }

    // Max retries exceeded or non-retryable error
    request.reject(error);
    this.requestQueue.delete(request.id);
  }
}

export const apiOptimizer = new APIOptimizer();

// Cache manager for reducing duplicate requests
export class CacheManager {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly DEFAULT_TTL = 5000; // 5 seconds

  get(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.DEFAULT_TTL) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  set(key: string, data: any) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  clear() {
    this.cache.clear();
  }
}

export const cacheManager = new CacheManager();