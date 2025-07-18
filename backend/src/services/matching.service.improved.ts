import FuzzySet from 'fuzzyset';
import { CohereClient } from 'cohere-ai';
import OpenAI from 'openai';
import { getConvexClient } from '../config/convex';
import { api } from '../lib/convex-api';
import { EnhancedMatchingService } from './enhancedMatching.service';
import { matchingCache, CacheService } from './cache.service';
import { priceListCache } from './priceListCache.service';
import { PriceItem } from '../types/priceItem.types';
import { withRetry } from '../utils/retry';
import { projectLogger as logger } from '../utils/logger';

interface MatchingResult {
  matchedItemId: string;
  matchedDescription: string;
  matchedCode: string;
  matchedUnit: string;
  matchedRate: number;
  confidence: number;
  method?: string;
  unitConverted?: boolean;
  conversionFactor?: number;
}

interface MatchConfig {
  minConfidence: number;
  useCache: boolean;
  cacheTTL: number;
  maxEmbeddingCacheSize: number;
}

export class ImprovedMatchingService {
  private static instance: ImprovedMatchingService | null = null;
  private convex = getConvexClient();
  private cohereClient: CohereClient | null = null;
  private openaiClient: OpenAI | null = null;
  private clientsInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;
  private embeddingCache: Map<string, { embedding: number[], provider: 'V2' | 'V1' }> = new Map();
  
  private config: MatchConfig = {
    minConfidence: 0.5,
    useCache: true,
    cacheTTL: 3600, // 1 hour
    maxEmbeddingCacheSize: 10000 // Limit cache size to prevent memory leaks
  };

  constructor() {
    // Start initialization immediately but don't await
    this.initializationPromise = this.initializeClients();
    
    // Clean up embedding cache periodically
    setInterval(() => this.cleanupEmbeddingCache(), 600000); // Every 10 minutes
  }

  static getInstance(): ImprovedMatchingService {
    if (!ImprovedMatchingService.instance) {
      ImprovedMatchingService.instance = new ImprovedMatchingService();
    }
    return ImprovedMatchingService.instance;
  }

  async updateConfig(newConfig: Partial<MatchConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    logger.info('Matching service config updated', { config: this.config });
  }

  private cleanupEmbeddingCache(): void {
    if (this.embeddingCache.size > this.config.maxEmbeddingCacheSize) {
      const entriesToRemove = this.embeddingCache.size - this.config.maxEmbeddingCacheSize * 0.8;
      const keys = Array.from(this.embeddingCache.keys());
      
      // Remove oldest entries (simple FIFO)
      for (let i = 0; i < entriesToRemove; i++) {
        this.embeddingCache.delete(keys[i]);
      }
      
      logger.info('Cleaned up embedding cache', { 
        removed: entriesToRemove, 
        remaining: this.embeddingCache.size 
      });
    }
  }

  private async initializeClients() {
    try {
      // Get API keys from application settings
      const settings = await this.convex.query(api.applicationSettings.getByKeys, {
        keys: ['V2_API_KEY', 'V1_API_KEY'],
      });

      const cohereKey = settings.find(s => s.key === 'V2_API_KEY')?.value;
      const openaiKey = settings.find(s => s.key === 'V1_API_KEY')?.value;

      if (cohereKey) {
        try {
          this.cohereClient = new CohereClient({ token: cohereKey });
          logger.info('Cohere client initialized successfully');
        } catch (error) {
          logger.error('Failed to initialize Cohere client', { error });
        }
      }

      if (openaiKey) {
        try {
          this.openaiClient = new OpenAI({ apiKey: openaiKey });
          logger.info('OpenAI client initialized successfully');
        } catch (error) {
          logger.error('Failed to initialize OpenAI client', { error });
        }
      }

      this.clientsInitialized = true;
    } catch (error) {
      logger.error('Failed to initialize AI clients', { error });
      this.clientsInitialized = true; // Mark as initialized even if failed
    }
  }

  private async ensureClientsInitialized() {
    if (!this.clientsInitialized && this.initializationPromise) {
      await this.initializationPromise;
    }
  }

  async matchItem(
    description: string,
    method: 'LOCAL' | 'V2' | 'V1' | 'HYBRID' | 'ADVANCED',
    priceItems?: PriceItem[],
    contextHeaders?: string[]
  ): Promise<MatchingResult> {
    // Validate input
    if (!description || description.trim().length === 0) {
      throw new Error('Description cannot be empty');
    }

    // Ensure AI clients are initialized for methods that need them
    if (method === 'V2' || method === 'V1' || method === 'HYBRID') {
      await this.ensureClientsInitialized();
    }

    // Get price items from cache if not provided
    if (!priceItems) {
      try {
        priceItems = await priceListCache.getPriceItems();
        
        if (!priceItems || priceItems.length === 0) {
          throw new Error('No price items found in database');
        }
      } catch (error) {
        logger.error('Failed to load price items', { error });
        throw new Error(`Failed to load price items: ${error.message}`);
      }
    }

    // Preprocess the description
    const processedDescription = EnhancedMatchingService.preprocessText(description);

    let result: MatchingResult;

    switch (method) {
      case 'LOCAL':
        result = await this.localMatch(processedDescription, priceItems, contextHeaders);
        break;
      case 'V2':
        result = await this.cohereMatch(processedDescription, priceItems, contextHeaders);
        break;
      case 'V1':
        result = await this.openaiMatch(processedDescription, priceItems, contextHeaders);
        break;
      case 'HYBRID':
        result = await this.hybridMatch(processedDescription, priceItems, contextHeaders);
        break;
      case 'ADVANCED':
        result = await this.advancedMatch(processedDescription, priceItems, contextHeaders);
        break;
      default:
        throw new Error(`Unknown matching method: ${method}`);
    }

    // Validate result
    this.validateMatchResult(result);

    return result;
  }

  private validateMatchResult(result: MatchingResult): void {
    if (!result.matchedItemId) {
      throw new Error('Invalid match result: missing item ID');
    }

    if (result.confidence < 0 || result.confidence > 1) {
      throw new Error(`Invalid confidence value: ${result.confidence}`);
    }

    if (result.confidence < this.config.minConfidence) {
      throw new Error(`Match confidence (${result.confidence}) below minimum threshold (${this.config.minConfidence})`);
    }

    if (result.matchedRate < 0) {
      throw new Error(`Invalid rate: ${result.matchedRate}`);
    }
  }

  private async localMatch(
    description: string, 
    priceItems: PriceItem[], 
    contextHeaders?: string[]
  ): Promise<MatchingResult> {
    // Check cache first
    const cacheKey = CacheService.generateMatchKey(description, 'LOCAL');
    if (this.config.useCache) {
      const cached = matchingCache.get<MatchingResult>(cacheKey);
      if (cached) {
        logger.debug('Local match cache hit', { description });
        return cached;
      }
    }

    // Use enhanced matching with context
    const matches = EnhancedMatchingService.enhancedFuzzyMatch(
      description, 
      priceItems, 
      5, 
      contextHeaders
    );
    
    if (matches.length === 0) {
      throw new Error('No suitable match found');
    }

    const bestMatch = matches[0];
    
    // Apply unit conversion if needed
    let rate = bestMatch.item.rate;
    if (bestMatch.unitConverted && bestMatch.conversionFactor) {
      rate = rate * bestMatch.conversionFactor;
    }
    
    const result: MatchingResult = {
      matchedItemId: bestMatch.item._id,
      matchedDescription: bestMatch.item.description,
      matchedCode: bestMatch.item.code || '',
      matchedUnit: bestMatch.item.unit || '',
      matchedRate: rate,
      confidence: bestMatch.score / 100,
      method: 'LOCAL',
      unitConverted: bestMatch.unitConverted,
      conversionFactor: bestMatch.conversionFactor
    };

    // Cache the result
    if (this.config.useCache) {
      matchingCache.set(cacheKey, result, this.config.cacheTTL);
    }
    
    return result;
  }

  private async cohereMatch(
    description: string, 
    priceItems: PriceItem[], 
    contextHeaders?: string[]
  ): Promise<MatchingResult> {
    if (!this.cohereClient) {
      logger.warn('Cohere client not available, falling back to local match');
      return this.localMatch(description, priceItems, contextHeaders);
    }

    try {
      // Get embedding for the description
      const embeddingResponse = await withRetry(
        () => this.cohereClient!.embed({
          texts: [description],
          model: 'embed-english-v3.0',
          inputType: 'search_query',
        }),
        {
          maxAttempts: 3,
          delayMs: 1000,
          onRetry: (error, attempt) => {
            logger.warn('Cohere embed retry', { attempt, error: error.message });
          }
        }
      );

      const queryEmbedding = embeddingResponse.embeddings[0];

      // Get embeddings for price items (from cache or generate)
      const itemsWithEmbeddings = await this.getItemEmbeddings(priceItems, 'V2');

      if (itemsWithEmbeddings.length === 0) {
        logger.warn('No items with embeddings, falling back to local match');
        return this.localMatch(description, priceItems, contextHeaders);
      }

      // Calculate cosine similarity
      let bestMatch: PriceItem | null = null;
      let bestSimilarity = -1;

      itemsWithEmbeddings.forEach(item => {
        const similarity = this.cosineSimilarity(queryEmbedding, item.embedding!);
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestMatch = item;
        }
      });

      if (!bestMatch || bestSimilarity < this.config.minConfidence) {
        throw new Error('No suitable match found');
      }

      return {
        matchedItemId: bestMatch._id,
        matchedDescription: bestMatch.description,
        matchedCode: bestMatch.code || '',
        matchedUnit: bestMatch.unit || '',
        matchedRate: bestMatch.rate,
        confidence: bestSimilarity,
        method: 'V2'
      };
    } catch (error) {
      logger.error('Cohere match failed, falling back to local', { error });
      return this.localMatch(description, priceItems, contextHeaders);
    }
  }

  private async openaiMatch(
    description: string, 
    priceItems: PriceItem[], 
    contextHeaders?: string[]
  ): Promise<MatchingResult> {
    if (!this.openaiClient) {
      logger.warn('OpenAI client not available, falling back to local match');
      return this.localMatch(description, priceItems, contextHeaders);
    }

    try {
      // Get embedding for the description
      const embeddingResponse = await withRetry(
        () => this.openaiClient!.embeddings.create({
          input: description,
          model: 'text-embedding-3-large',
        }),
        {
          maxAttempts: 3,
          delayMs: 1000,
          onRetry: (error, attempt) => {
            logger.warn('OpenAI embed retry', { attempt, error: error.message });
          }
        }
      );

      const queryEmbedding = embeddingResponse.data[0].embedding;

      // Get embeddings for price items (from cache or generate)
      const itemsWithEmbeddings = await this.getItemEmbeddings(priceItems, 'V1');

      if (itemsWithEmbeddings.length === 0) {
        logger.warn('No items with embeddings, falling back to local match');
        return this.localMatch(description, priceItems, contextHeaders);
      }

      // Calculate cosine similarity
      let bestMatch: PriceItem | null = null;
      let bestSimilarity = -1;

      itemsWithEmbeddings.forEach(item => {
        const similarity = this.cosineSimilarity(queryEmbedding, item.embedding!);
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestMatch = item;
        }
      });

      if (!bestMatch || bestSimilarity < this.config.minConfidence) {
        throw new Error('No suitable match found');
      }

      return {
        matchedItemId: bestMatch._id,
        matchedDescription: bestMatch.description,
        matchedCode: bestMatch.code || '',
        matchedUnit: bestMatch.unit || '',
        matchedRate: bestMatch.rate,
        confidence: bestSimilarity,
        method: 'V1' // Fixed: was returning 'V2'
      };
    } catch (error) {
      logger.error('OpenAI match failed, falling back to local', { error });
      return this.localMatch(description, priceItems, contextHeaders);
    }
  }

  private async hybridMatch(
    description: string, 
    priceItems: PriceItem[], 
    contextHeaders?: string[]
  ): Promise<MatchingResult> {
    const results: MatchingResult[] = [];

    // Try all methods and collect results
    const methods = [
      { name: 'LOCAL', weight: 0.7, fn: () => this.localMatch(description, priceItems, contextHeaders) },
      { name: 'V2', weight: 1.0, fn: () => this.cohereMatch(description, priceItems, contextHeaders) },
      { name: 'V1', weight: 1.0, fn: () => this.openaiMatch(description, priceItems, contextHeaders) }
    ];

    // Execute all methods in parallel
    const promises = methods.map(async (method) => {
      try {
        const result = await method.fn();
        return {
          ...result,
          confidence: result.confidence * method.weight,
          originalMethod: method.name
        };
      } catch (error) {
        logger.debug(`${method.name} match failed in hybrid`, { error: error.message });
        return null;
      }
    });

    const allResults = await Promise.all(promises);
    
    // Filter out failed results
    const validResults = allResults.filter(r => r !== null) as MatchingResult[];

    if (validResults.length === 0) {
      throw new Error('No suitable match found using any method');
    }

    // Log results for debugging
    logger.debug('Hybrid match results', {
      description,
      results: validResults.map(r => ({
        method: r.method || 'unknown',
        confidence: r.confidence,
        description: r.matchedDescription
      }))
    });

    // Return the result with highest confidence
    const bestResult = validResults.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );
    
    return {
      ...bestResult,
      method: 'HYBRID'
    };
  }

  private async advancedMatch(
    description: string, 
    priceItems: PriceItem[], 
    contextHeaders?: string[]
  ): Promise<MatchingResult> {
    // Check cache first
    const cacheKey = CacheService.generateMatchKey(description, 'ADVANCED');
    if (this.config.useCache) {
      const cached = matchingCache.get<MatchingResult>(cacheKey);
      if (cached) {
        logger.debug('Advanced match cache hit', { description });
        return cached;
      }
    }

    // Use multi-stage matching from enhanced service
    const matches = await EnhancedMatchingService.multiStageMatch(description, priceItems, {
      useExactMatch: true,
      useCodeMatch: true,
      useFuzzyMatch: true,
      useSemanticMatch: false,
      limit: 5
    });

    if (matches.length === 0) {
      throw new Error('No suitable match found');
    }

    const bestMatch = matches[0];
    
    // Apply unit conversion if needed
    let rate = bestMatch.item.rate;
    if (bestMatch.unitConverted && bestMatch.conversionFactor) {
      rate = rate * bestMatch.conversionFactor;
    }
    
    const result: MatchingResult = {
      matchedItemId: bestMatch.item._id,
      matchedDescription: bestMatch.item.description,
      matchedCode: bestMatch.item.code || '',
      matchedUnit: bestMatch.item.unit || '',
      matchedRate: rate,
      confidence: bestMatch.score / 100,
      method: 'ADVANCED',
      unitConverted: bestMatch.unitConverted,
      conversionFactor: bestMatch.conversionFactor
    };

    // Cache the result
    if (this.config.useCache) {
      matchingCache.set(cacheKey, result, this.config.cacheTTL);
    }
    
    return result;
  }

  private async getItemEmbeddings(
    items: PriceItem[], 
    provider: 'V2' | 'V1'
  ): Promise<PriceItem[]> {
    const itemsWithEmbeddings: PriceItem[] = [];
    const itemsNeedingEmbeddings: PriceItem[] = [];

    // Check cache and existing embeddings
    for (const item of items) {
      // Check memory cache first
      const cached = this.embeddingCache.get(item.description);
      if (cached && cached.provider === provider) {
        itemsWithEmbeddings.push({
          ...item,
          embedding: cached.embedding,
          embeddingProvider: provider
        });
      } else if (item.embedding && item.embeddingProvider === provider) {
        // Use existing embedding from item
        itemsWithEmbeddings.push(item);
        // Also cache it in memory
        this.embeddingCache.set(item.description, {
          embedding: item.embedding,
          provider
        });
      } else {
        itemsNeedingEmbeddings.push(item);
      }
    }

    // Generate embeddings for items that need them
    if (itemsNeedingEmbeddings.length > 0) {
      logger.info(`Generating ${provider} embeddings for ${itemsNeedingEmbeddings.length} items`);
      
      // Batch generate embeddings
      const batchSize = provider === 'V2' ? 96 : 100;
      
      for (let i = 0; i < itemsNeedingEmbeddings.length; i += batchSize) {
        const batch = itemsNeedingEmbeddings.slice(i, i + batchSize);
        const embeddings = await this.generateBatchEmbeddings(batch, provider);
        
        batch.forEach((item, index) => {
          if (embeddings[index]) {
            const embedding = embeddings[index];
            
            // Cache in memory
            this.embeddingCache.set(item.description, { embedding, provider });
            
            // Add to results
            itemsWithEmbeddings.push({
              ...item,
              embedding,
              embeddingProvider: provider
            });
          }
        });
      }
    }

    return itemsWithEmbeddings;
  }

  private async generateBatchEmbeddings(
    items: PriceItem[], 
    provider: 'V2' | 'V1'
  ): Promise<number[][]> {
    const texts = items.map(item => item.description);

    try {
      if (provider === 'V2' && this.cohereClient) {
        const response = await this.cohereClient.embed({
          texts,
          model: 'embed-english-v3.0',
          inputType: 'search_document',
        });
        // Handle Cohere's embedding response format
        const embeddings = Array.isArray(response.embeddings) 
          ? response.embeddings 
          : (response.embeddings as any).float || (response.embeddings as any).int8 || (response.embeddings as any).uint8 || (response.embeddings as any).ubinary || (response.embeddings as any).binary || [];
        return embeddings;
      } else if (provider === 'V1' && this.openaiClient) {
        const response = await this.openaiClient.embeddings.create({
          input: texts,
          model: 'text-embedding-3-large',
        });
        return response.data.map(d => d.embedding);
      }
    } catch (error) {
      logger.error(`Failed to generate ${provider} embeddings`, { error });
    }

    return [];
  }

  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (norm1 * norm2);
  }

  // Public method to find matches (for external use)
  async findMatches(
    description: string,
    priceItems: PriceItem[],
    limit: number = 10,
    method: 'LOCAL' | 'ADVANCED' = 'ADVANCED'
  ): Promise<Array<PriceItem & { score: number }>> {
    try {
      const matches = await EnhancedMatchingService.multiStageMatch(
        description, 
        priceItems, 
        { limit }
      );
      
      return matches.map(match => ({
        ...match.item,
        score: match.score / 100
      }));
    } catch (error) {
      logger.error('Find matches failed', { error, description });
      return [];
    }
  }

  // Cleanup method
  async shutdown(): Promise<void> {
    this.cleanupEmbeddingCache();
    priceListCache.stopAutoRefresh();
    logger.info('Matching service shut down');
  }
}

// Export singleton instance
export const improvedMatchingService = ImprovedMatchingService.getInstance();


