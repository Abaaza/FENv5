import { getConvexClient } from '../config/convex';
import { api } from '../lib/convex-api';
import { PriceItem } from '../types/priceItem.types';
import { CohereClient } from 'cohere-ai';
import OpenAI from 'openai';
import * as fuzz from 'fuzzball';
import { LRUCache } from 'lru-cache';
import { withRetry } from '../utils/retry';

interface MatchingResult {
  matchedItemId: string;
  matchedDescription: string;
  matchedCode: string;
  matchedUnit: string;
  matchedRate: number;
  confidence: number;
  method?: string;
}

export class SimplifiedMatchingService {
  private static instance: SimplifiedMatchingService;
  private convex = getConvexClient();
  private cohereClient: CohereClient | null = null;
  private openaiClient: OpenAI | null = null;
  private embeddingCache: LRUCache<string, number[]>;
  private priceItemsCache: { items: PriceItem[], timestamp: number } | null = null;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.embeddingCache = new LRUCache<string, number[]>({
      max: 5000,
      ttl: 1000 * 60 * 60, // 1 hour
    });
  }

  static getInstance(): SimplifiedMatchingService {
    if (!SimplifiedMatchingService.instance) {
      SimplifiedMatchingService.instance = new SimplifiedMatchingService();
    }
    return SimplifiedMatchingService.instance;
  }

  private async ensureClientsInitialized() {
    if (this.cohereClient && this.openaiClient) return;
    
    const settings = await this.convex.query(api.applicationSettings.getAll);
    const cohereKey = settings.find(s => s.key === 'COHERE_API_KEY')?.value;
    const openaiKey = settings.find(s => s.key === 'OPENAI_API_KEY')?.value;
    
    if (cohereKey && !this.cohereClient) {
      this.cohereClient = new CohereClient({ token: cohereKey });
    }
    
    if (openaiKey && !this.openaiClient) {
      this.openaiClient = new OpenAI({ apiKey: openaiKey });
    }
  }

  private async getPriceItems(): Promise<PriceItem[]> {
    if (this.priceItemsCache && Date.now() - this.priceItemsCache.timestamp < this.CACHE_DURATION) {
      return this.priceItemsCache.items;
    }

    const items = await this.convex.query(api.priceItems.getActive);
    if (!items || items.length === 0) {
      throw new Error('No price items found in database');
    }

    this.priceItemsCache = { items, timestamp: Date.now() };
    return items;
  }

  /**
   * Simple text for embedding - just description + category + unit
   */
  private createSimpleText(item: PriceItem): string {
    const parts = [item.description];
    
    if (item.category && item.subcategory) {
      parts.push(`${item.category} ${item.subcategory}`);
    } else if (item.category) {
      parts.push(item.category);
    }
    
    if (item.unit) {
      parts.push(item.unit);
    }
    
    return parts.join(' ');
  }

  /**
   * Extract unit from description - simplified
   */
  private extractUnit(text: string): string {
    const unitPatterns = [
      /\b(m2|sqm|sq\.?m|square\s*met(?:er|re)s?)\b/i,
      /\b(m3|cum|cu\.?m|cubic\s*met(?:er|re)s?)\b/i,
      /\b(kg|kilogram?s?)\b/i,
      /\b(ltr|lit(?:er|re)s?|l)\b/i,
      /\b(nos?|numbers?|pcs?|pieces?)\b/i,
      /\b(mt|met(?:er|re)s?|m)\b/i,
      /\b(mm|millimet(?:er|re)s?)\b/i,
      /\b(rm|running\s*met(?:er|re)s?)\b/i,
      /\b(ton|tonnes?|t)\b/i,
      /\b(hrs?|hours?)\b/i,
      /\b(days?)\b/i,
      /\b(sets?)\b/i,
      /\b(pairs?)\b/i
    ];
    
    for (const pattern of unitPatterns) {
      const match = text.match(pattern);
      if (match) return match[0];
    }
    
    return '';
  }

  /**
   * Normalize unit for comparison
   */
  private normalizeUnit(unit: string): string {
    const normalized = unit.toUpperCase().trim();
    const unitMap: Record<string, string> = {
      'SQM': 'M2', 'SQ.M': 'M2', 'SQUARE METER': 'M2', 'SQUARE METERS': 'M2',
      'CUM': 'M3', 'CU.M': 'M3', 'CUBIC METER': 'M3', 'CUBIC METERS': 'M3',
      'KGS': 'KG', 'KILOGRAM': 'KG', 'KILOGRAMS': 'KG',
      'LTR': 'L', 'LITER': 'L', 'LITERS': 'L', 'LITRE': 'L', 'LITRES': 'L',
      'NOS': 'NO', 'NUMBER': 'NO', 'NUMBERS': 'NO', 'PCS': 'NO', 'PIECE': 'NO', 'PIECES': 'NO',
      'MT': 'M', 'METER': 'M', 'METERS': 'M', 'METRE': 'M', 'METRES': 'M',
      'MM': 'MM', 'MILLIMETER': 'MM', 'MILLIMETERS': 'MM',
      'RM': 'RM', 'RUNNING METER': 'RM', 'RUNNING METERS': 'RM',
      'TON': 'T', 'TONNE': 'T', 'TONNES': 'T',
      'HR': 'HOUR', 'HRS': 'HOUR', 'HOURS': 'HOUR',
      'DAY': 'DAY', 'DAYS': 'DAY',
      'SET': 'SET', 'SETS': 'SET',
      'PAIR': 'PAIR', 'PAIRS': 'PAIR'
    };
    
    return unitMap[normalized] || normalized;
  }

  /**
   * Main matching method - simplified
   */
  async matchItem(
    description: string,
    method: 'LOCAL' | 'COHERE' | 'OPENAI',
    providedPriceItems?: PriceItem[],
    contextHeaders?: string[]
  ): Promise<MatchingResult> {
    // Initialize AI clients if needed
    if (['COHERE', 'OPENAI'].includes(method)) {
      await this.ensureClientsInitialized();
    }

    const priceItems = providedPriceItems || await this.getPriceItems();
    
    switch (method) {
      case 'LOCAL':
        return this.localMatch(description, priceItems, contextHeaders);
      case 'COHERE':
        return this.cohereMatch(description, priceItems, contextHeaders);
      case 'OPENAI':
        return this.openAIMatch(description, priceItems, contextHeaders);
      default:
        throw new Error(`Unknown matching method: ${method}`);
    }
  }

  /**
   * LOCAL MATCH - Simple fuzzy matching
   */
  private async localMatch(
    description: string, 
    priceItems: PriceItem[], 
    contextHeaders?: string[]
  ): Promise<MatchingResult> {
    const queryUnit = this.extractUnit(description);
    const targetCategory = contextHeaders?.[0]?.toLowerCase() || '';
    const targetSubcategory = contextHeaders?.[1]?.toLowerCase() || '';
    
    const matches = priceItems.map(item => {
      // Simple fuzzy score
      const fuzzyScore = fuzz.token_set_ratio(description, item.description);
      
      // Unit bonus (simple: match = +20, no match = 0)
      let unitBonus = 0;
      if (queryUnit && item.unit) {
        const normalizedQuery = this.normalizeUnit(queryUnit);
        const normalizedItem = this.normalizeUnit(item.unit);
        if (normalizedQuery === normalizedItem) {
          unitBonus = 20;
        }
      }
      
      // Category bonus (simple: match = +10)
      let categoryBonus = 0;
      if (targetCategory && item.category?.toLowerCase().includes(targetCategory)) {
        categoryBonus = 10;
        if (targetSubcategory && item.subcategory?.toLowerCase().includes(targetSubcategory)) {
          categoryBonus = 15;
        }
      }
      
      const totalScore = fuzzyScore + unitBonus + categoryBonus;
      
      return { item, score: totalScore };
    });
    
    // Sort and get best match
    matches.sort((a, b) => b.score - a.score);
    const bestMatch = matches[0];
    
    return {
      matchedItemId: bestMatch.item._id,
      matchedDescription: bestMatch.item.description,
      matchedCode: bestMatch.item.code || '',
      matchedUnit: bestMatch.item.unit || '',
      matchedRate: bestMatch.item.rate,
      confidence: Math.min(bestMatch.score / 100, 0.99),
      method: 'LOCAL'
    };
  }

  /**
   * COHERE MATCH - Simple semantic matching
   */
  private async cohereMatch(
    description: string,
    priceItems: PriceItem[],
    contextHeaders?: string[]
  ): Promise<MatchingResult> {
    if (!this.cohereClient) {
      return this.localMatch(description, priceItems, contextHeaders);
    }

    const queryUnit = this.extractUnit(description);
    
    // Simple query text
    let queryText = description;
    if (contextHeaders && contextHeaders.length > 0) {
      queryText = `${contextHeaders.join(' ')} ${description}`;
    }

    // Get or generate query embedding
    const queryCacheKey = `cohere_${queryText}`;
    let queryEmbedding = this.embeddingCache.get(queryCacheKey);
    
    if (!queryEmbedding) {
      try {
        const response = await withRetry(
          () => this.cohereClient!.embed({
            texts: [queryText],
            model: 'embed-english-v3.0',
            inputType: 'search_query',
          }),
          { maxAttempts: 2, delayMs: 1000, timeout: 10000 }
        );
        queryEmbedding = response.embeddings[0];
        this.embeddingCache.set(queryCacheKey, queryEmbedding);
      } catch (error) {
        return this.localMatch(description, priceItems, contextHeaders);
      }
    }

    // Score all items
    const scoredItems = await Promise.all(
      priceItems.map(async (item) => {
        const itemText = this.createSimpleText(item);
        const cacheKey = `cohere_${itemText}`;
        let embedding = this.embeddingCache.get(cacheKey);
        
        if (!embedding && item.embedding && item.embeddingProvider === 'cohere') {
          embedding = item.embedding;
          this.embeddingCache.set(cacheKey, embedding);
        }
        
        if (!embedding) {
          // Generate embedding for this item
          try {
            const response = await this.cohereClient!.embed({
              texts: [itemText],
              model: 'embed-english-v3.0',
              inputType: 'search_document',
            });
            embedding = response.embeddings[0];
            this.embeddingCache.set(cacheKey, embedding);
          } catch {
            return null;
          }
        }
        
        if (!embedding) return null;
        
        // Calculate cosine similarity
        const similarity = this.cosineSimilarity(queryEmbedding!, embedding);
        
        // Simple unit boost
        let finalScore = similarity;
        if (queryUnit && item.unit) {
          const normalizedQuery = this.normalizeUnit(queryUnit);
          const normalizedItem = this.normalizeUnit(item.unit);
          if (normalizedQuery === normalizedItem) {
            finalScore = Math.min(finalScore * 1.2, 0.99); // 20% boost for unit match
          }
        }
        
        return { item, score: finalScore };
      })
    );

    // Filter out nulls and sort
    const validMatches = scoredItems.filter(m => m !== null) as Array<{item: PriceItem, score: number}>;
    validMatches.sort((a, b) => b.score - a.score);
    
    if (validMatches.length === 0) {
      return this.localMatch(description, priceItems, contextHeaders);
    }
    
    const bestMatch = validMatches[0];
    
    return {
      matchedItemId: bestMatch.item._id,
      matchedDescription: bestMatch.item.description,
      matchedCode: bestMatch.item.code || '',
      matchedUnit: bestMatch.item.unit || '',
      matchedRate: bestMatch.item.rate,
      confidence: bestMatch.score,
      method: 'COHERE'
    };
  }

  /**
   * OPENAI MATCH - Simple semantic matching
   */
  private async openAIMatch(
    description: string,
    priceItems: PriceItem[],
    contextHeaders?: string[]
  ): Promise<MatchingResult> {
    if (!this.openaiClient) {
      return this.localMatch(description, priceItems, contextHeaders);
    }

    const queryUnit = this.extractUnit(description);
    
    // Simple query text
    let queryText = description;
    if (contextHeaders && contextHeaders.length > 0) {
      queryText = `${contextHeaders.join(' ')} ${description}`;
    }

    // Get query embedding
    let queryEmbedding: number[];
    try {
      const response = await withRetry(
        () => this.openaiClient!.embeddings.create({
          input: queryText,
          model: 'text-embedding-3-small', // Use smaller, faster model
        }),
        { maxAttempts: 2, delayMs: 1000, timeout: 10000 }
      );
      queryEmbedding = response.data[0].embedding;
    } catch (error) {
      return this.localMatch(description, priceItems, contextHeaders);
    }

    // Score items that have embeddings
    const scoredItems = priceItems
      .filter(item => item.embedding && item.embeddingProvider === 'openai')
      .map(item => {
        const similarity = this.cosineSimilarity(queryEmbedding, item.embedding!);
        
        // Simple unit boost
        let finalScore = similarity;
        if (queryUnit && item.unit) {
          const normalizedQuery = this.normalizeUnit(queryUnit);
          const normalizedItem = this.normalizeUnit(item.unit);
          if (normalizedQuery === normalizedItem) {
            finalScore = Math.min(finalScore * 1.2, 0.99); // 20% boost for unit match
          }
        }
        
        return { item, score: finalScore };
      });

    if (scoredItems.length === 0) {
      return this.localMatch(description, priceItems, contextHeaders);
    }

    // Sort and get best match
    scoredItems.sort((a, b) => b.score - a.score);
    const bestMatch = scoredItems[0];
    
    return {
      matchedItemId: bestMatch.item._id,
      matchedDescription: bestMatch.item.description,
      matchedCode: bestMatch.item.code || '',
      matchedUnit: bestMatch.item.unit || '',
      matchedRate: bestMatch.item.rate,
      confidence: bestMatch.score,
      method: 'OPENAI'
    };
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }
}