import NodeCache from 'node-cache';

interface CacheOptions {
  stdTTL?: number; // Standard TTL in seconds
  checkperiod?: number; // Check period in seconds
  useClones?: boolean;
}

export class CacheService {
  private cache: NodeCache;
  private hitRate: { hits: number; misses: number } = { hits: 0, misses: 0 };

  constructor(options: CacheOptions = {}) {
    this.cache = new NodeCache({
      stdTTL: options.stdTTL || 3600, // Default 1 hour
      checkperiod: options.checkperiod || 600, // Check every 10 minutes
      useClones: options.useClones !== false, // Clone by default for safety
    });
  }

  set(key: string, value: any, ttl?: number): boolean {
    return this.cache.set(key, value, ttl || 0);
  }

  get<T>(key: string): T | undefined {
    const value = this.cache.get<T>(key);
    if (value !== undefined) {
      this.hitRate.hits++;
    } else {
      this.hitRate.misses++;
    }
    return value;
  }

  async getOrSet<T>(
    key: string, 
    factory: () => Promise<T>, 
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, ttl);
    return value;
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): number {
    return this.cache.del(key);
  }

  deleteByPattern(pattern: string): number {
    const keys = this.cache.keys();
    const toDelete = keys.filter(key => key.includes(pattern));
    return this.cache.del(toDelete);
  }

  flush(): void {
    this.cache.flushAll();
  }

  getStats() {
    const stats = this.cache.getStats();
    const hitRatePercentage = this.hitRate.hits + this.hitRate.misses > 0
      ? (this.hitRate.hits / (this.hitRate.hits + this.hitRate.misses)) * 100
      : 0;

    return {
      ...stats,
      hitRate: {
        ...this.hitRate,
        percentage: hitRatePercentage.toFixed(2) + '%'
      }
    };
  }

  // Cache key generators for consistency
  static generateMatchKey(description: string, method: string): string {
    return `match:${method}:${Buffer.from(description).toString('base64')}`;
  }

  static generatePriceItemKey(id: string): string {
    return `priceItem:${id}`;
  }

  static generateJobKey(jobId: string): string {
    return `job:${jobId}`;
  }

  static generateUserKey(userId: string): string {
    return `user:${userId}`;
  }
}

// Create singleton instances for different cache purposes
export const matchingCache = new CacheService({ 
  stdTTL: 3600, // 1 hour for matching results
});

export const priceItemCache = new CacheService({ 
  stdTTL: 7200, // 2 hours for price items
});

export const jobCache = new CacheService({ 
  stdTTL: 300, // 5 minutes for job status
});

export const userCache = new CacheService({ 
  stdTTL: 1800, // 30 minutes for user data
});
