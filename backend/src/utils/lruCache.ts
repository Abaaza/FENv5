export class LRUCache<T> {
  private cache: Map<string, { value: T; expiry: number }>;
  private readonly maxSize: number;
  private readonly ttl: number;

  constructor(maxSize: number = 1000, ttl: number = 3600000) { // Default 1 hour TTL
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  set(key: string, value: T): void {
    // Remove expired entries before adding new one
    this.cleanExpired();

    // If at capacity, remove least recently used
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    // Delete existing entry to move it to the end
    this.cache.delete(key);

    // Add to end (most recently used)
    this.cache.set(key, {
      value,
      expiry: Date.now() + this.ttl
    });
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    // Check if expired
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    this.cleanExpired();
    return this.cache.size;
  }

  private cleanExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
      }
    }
  }

  // For debugging
  stats(): { size: number; maxSize: number; ttl: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl
    };
  }
}
