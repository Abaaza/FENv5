import { getConvexClient } from '../config/convex';
import { api } from '../lib/convex-api';
import NodeCache from 'node-cache';

interface ApiKeys {
  cohereApiKey?: string;
  openaiApiKey?: string;
}

class ApiKeyService {
  private static instance: ApiKeyService;
  private cache: NodeCache;
  private readonly CACHE_KEY = 'api_keys';
  private readonly CACHE_TTL = 300; // 5 minutes

  private constructor() {
    // Initialize cache with 5 minute TTL
    this.cache = new NodeCache({ stdTTL: this.CACHE_TTL, checkperiod: 120 });
  }

  static getInstance(): ApiKeyService {
    if (!ApiKeyService.instance) {
      ApiKeyService.instance = new ApiKeyService();
    }
    return ApiKeyService.instance;
  }

  async getApiKeys(): Promise<ApiKeys> {
    // Check cache first
    const cachedKeys = this.cache.get<ApiKeys>(this.CACHE_KEY);
    if (cachedKeys) {
      console.log('[ApiKeyService] Using cached API keys');
      return cachedKeys;
    }

    // Fetch from database
    console.log('[ApiKeyService] Fetching API keys from database');
    const convex = getConvexClient();
    
    try {
      const settings = await convex.query(api.applicationSettings.getByKeys, {
        keys: ['V2_API_KEY', 'V1_API_KEY']
      });

      const apiKeys: ApiKeys = {};

      settings.forEach(setting => {
        if (setting.key === 'V2_API_KEY') {
          apiKeys.cohereApiKey = setting.value;
        } else if (setting.key === 'V1_API_KEY') {
          apiKeys.openaiApiKey = setting.value;
        }
      });

      // Cache the keys
      if (Object.keys(apiKeys).length > 0) {
        this.cache.set(this.CACHE_KEY, apiKeys);
        console.log('[ApiKeyService] API keys cached');
      }

      return apiKeys;
    } catch (error) {
      console.error('[ApiKeyService] Failed to fetch API keys:', error);
      
      // Fall back to environment variables if database fetch fails
      return {
        cohereApiKey: process.env.V2_API_KEY,
        openaiApiKey: process.env.V1_API_KEY
      };
    }
  }

  async getCohereApiKey(): Promise<string | undefined> {
    const keys = await this.getApiKeys();
    return keys.cohereApiKey;
  }

  async getOpenAiApiKey(): Promise<string | undefined> {
    const keys = await this.getApiKeys();
    return keys.openaiApiKey;
  }

  // Clear cache when settings are updated
  clearCache(): void {
    this.cache.del(this.CACHE_KEY);
    console.log('[ApiKeyService] Cache cleared');
  }

  // Update API keys in database
  async updateApiKey(key: 'V2_API_KEY' | 'V1_API_KEY', value: string, userId: string): Promise<void> {
    const convex = getConvexClient();
    
    await convex.mutation(api.applicationSettings.upsert, {
      key,
      value,
      description: key === 'V2_API_KEY' ? 'V2 API key for embeddings' : 'V1 API key for embeddings',
      userId: userId as any
    });

    // Clear cache after update
    this.clearCache();
  }
}

export const apiKeyService = ApiKeyService.getInstance();