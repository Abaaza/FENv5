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

export class MatchingService {
  private static instance: MatchingService;
  private convex = getConvexClient();
  private cohereClient: CohereClient | null = null;
  private openaiClient: OpenAI | null = null;
  private embeddingCache: LRUCache<string, number[]>;
  private priceItemsCache: { items: PriceItem[], timestamp: number } | null = null;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.embeddingCache = new LRUCache<string, number[]>({
      max: 10000, // Increased cache size
      ttl: 1000 * 60 * 60 * 2, // 2 hours - longer TTL for Lambda
    });
  }

  static getInstance(): MatchingService {
    if (!MatchingService.instance) {
      MatchingService.instance = new MatchingService();
    }
    return MatchingService.instance;
  }

  private async ensureClientsInitialized() {
    const settings = await this.convex.query(api.applicationSettings.getAll);
    const cohereKey = settings.find(s => s.key === 'V2_API_KEY')?.value;
    const openaiKey = settings.find(s => s.key === 'V1_API_KEY')?.value;
    
    console.log('[MatchingService] Checking API Keys:', {
      hasV2: !!cohereKey,
      hasV1: !!openaiKey,
      v2KeyLength: cohereKey?.length || 0,
      v1KeyLength: openaiKey?.length || 0,
      currentCohereClient: !!this.cohereClient,
      currentOpenAIClient: !!this.openaiClient
    });
    
    // Always try to initialize Cohere if we have a key
    if (cohereKey) {
      try {
        this.cohereClient = new CohereClient({ token: cohereKey });
        console.log('[MatchingService] V2 (Cohere) client initialized successfully');
      } catch (error) {
        console.error('[MatchingService] Failed to initialize V2 (Cohere):', error);
        this.cohereClient = null;
      }
    }
    
    // Always try to initialize OpenAI if we have a key
    if (openaiKey) {
      try {
        this.openaiClient = new OpenAI({ apiKey: openaiKey });
        console.log('[MatchingService] V1 (OpenAI) client initialized successfully');
      } catch (error) {
        console.error('[MatchingService] Failed to initialize V1 (OpenAI):', error);
        this.openaiClient = null;
      }
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
   * Simple text for embedding - name + variant + unit
   */
  private createSimpleText(item: PriceItem): string {
    const parts = [];
    
    // Use name or description as primary text
    const primaryText = item.name || item.description;
    if (primaryText) {
      parts.push(primaryText);
    }
    
    // Add product variant information if available
    if (item.product_template_variant_value_ids) {
      // Extract meaningful variant info (e.g., "Size: 2m, Color: Green")
      parts.push(item.product_template_variant_value_ids);
    }
    
    // Add unit of measurement
    const unit = item.uom_id || item.unit;
    if (unit) {
      parts.push(unit);
    }
    
    // Add ID for additional context
    if (item.id) {
      parts.push(`ID:${item.id}`);
    }
    
    return parts.filter(p => p).join(' ');
  }

  /**
   * Expand common abbreviations in BOQ descriptions
   */
  private expandAbbreviations(text: string): string {
    return text
      .replace(/\bft\b/gi, 'feet')
      .replace(/\b(\d+)m\b/g, '$1 meter')
      .replace(/\b(\d+)mm\b/g, '$1 millimeter')
      .replace(/\bD(\d+)\b/g, 'diameter $1')
      .replace(/\bgalv\b/gi, 'galvanized')
      .replace(/\bstl\b/gi, 'steel')
      .replace(/\bconc\b/gi, 'concrete')
      .replace(/\bNo\.\b/gi, 'number');
  }

  /**
   * Detect product type from text for better matching
   */
  private detectProductType(text: string): string[] {
    const lowercased = text.toLowerCase();
    const types: string[] = [];
    
    // Fence-specific patterns from your data
    if (lowercased.includes('post')) types.push('post');
    if (lowercased.includes('gate')) types.push('gate');
    if (lowercased.includes('mesh')) types.push('mesh');
    if (lowercased.includes('wire')) types.push('wire');
    if (lowercased.includes('palisade')) types.push('palisade');
    if (lowercased.includes('fence') || lowercased.includes('fencing')) types.push('fence');
    if (lowercased.includes('rail')) types.push('rail');
    if (lowercased.includes('panel')) types.push('panel');
    if (lowercased.includes('bolt')) types.push('bolt');
    if (lowercased.includes('clamp')) types.push('clamp');
    if (lowercased.includes('bracket')) types.push('bracket');
    
    // Material types
    if (lowercased.includes('steel')) types.push('steel');
    if (lowercased.includes('galv')) types.push('galvanized');
    if (lowercased.includes('concrete')) types.push('concrete');
    if (lowercased.includes('composite')) types.push('composite');
    
    // Size indicators
    const sizeMatch = lowercased.match(/(\d+(?:\.\d+)?)\s*(?:m|mm|cm|ft|inch|")/);
    if (sizeMatch) types.push(`size:${sizeMatch[1]}`);
    
    return types;
  }

  /**
   * Extract unit from description - Enhanced for better detection
   */
  private extractUnit(text: string): string {
    // First try to extract units in parentheses or after numbers
    const inParentheses = text.match(/\(([^)]+)\)/);
    if (inParentheses) {
      const unitInParen = this.checkForUnit(inParentheses[1]);
      if (unitInParen) return unitInParen;
    }
    
    // Check after numbers (e.g., "100 m2", "50 kg")
    const afterNumber = text.match(/\d+\.?\d*\s*([a-zA-Z][a-zA-Z0-9\.]*)/);
    if (afterNumber) {
      const unitAfterNum = this.checkForUnit(afterNumber[1]);
      if (unitAfterNum) return unitAfterNum;
    }
    
    // Standard unit patterns
    const unitPatterns = [
      // Area units
      /\b(m2|sqm|sq\.?\s*m|square\s*met(?:er|re)s?|sq\.?\s*met(?:er|re)s?)\b/i,
      /\b(ft2|sqft|sq\.?\s*ft|square\s*f(?:ee|oo)t)\b/i,
      
      // Volume units
      /\b(m3|cum|cu\.?\s*m|cubic\s*met(?:er|re)s?|cu\.?\s*met(?:er|re)s?)\b/i,
      /\b(ft3|cuft|cu\.?\s*ft|cubic\s*f(?:ee|oo)t)\b/i,
      
      // Weight units
      /\b(kg|kgs?|kilogram?s?|kilo)\b/i,
      /\b(ton|tonnes?|t|metric\s*ton)\b/i,
      /\b(lbs?|pounds?)\b/i,
      
      // Liquid volume units
      /\b(ltr|lit(?:er|re)s?|l)\b/i,
      /\b(gal|gallons?)\b/i,
      
      // Count units
      /\b(nos?|numbers?|num)\b/i,
      /\b(pcs?|pieces?|pc)\b/i,
      /\b(each|ea|units?)\b/i,
      
      // Length units
      /\b(mt|mtr|met(?:er|re)s?|m)\b/i,
      /\b(mm|millimet(?:er|re)s?)\b/i,
      /\b(cm|centimet(?:er|re)s?)\b/i,
      /\b(rm|rmt|running\s*met(?:er|re)s?)\b/i,
      /\b(ft|feet|foot)\b/i,
      /\b(in|inch|inches)\b/i,
      
      // Time units
      /\b(hrs?|hours?)\b/i,
      /\b(days?)\b/i,
      /\b(weeks?)\b/i,
      /\b(months?)\b/i,
      
      // Other units
      /\b(sets?)\b/i,
      /\b(pairs?)\b/i,
      /\b(bags?)\b/i,
      /\b(rolls?)\b/i,
      /\b(sheets?)\b/i,
      /\b(bundles?)\b/i
    ];
    
    for (const pattern of unitPatterns) {
      const match = text.match(pattern);
      if (match) return match[0];
    }
    
    return '';
  }
  
  /**
   * Helper to check if a string is a valid unit
   */
  private checkForUnit(str: string): string {
    const commonUnits = ['m2', 'sqm', 'm3', 'cum', 'kg', 'kgs', 'l', 'ltr', 'nos', 'no', 
                        'pcs', 'pc', 'm', 'mt', 'mm', 'cm', 'rm', 'ft', 'in', 'hr', 'hrs',
                        'day', 'days', 'set', 'sets', 'pair', 'pairs', 'ea', 'each'];
    
    const normalized = str.toLowerCase().trim();
    if (commonUnits.includes(normalized)) {
      return str;
    }
    return '';
  }

  /**
   * Normalize unit for comparison - Enhanced with more variations
   */
  private normalizeUnit(unit: string): string {
    const normalized = unit.toUpperCase().trim()
      .replace(/\./g, '') // Remove dots
      .replace(/\s+/g, ' ') // Normalize spaces
      .replace(/[²³]/g, ''); // Remove superscript numbers
      
    const unitMap: Record<string, string> = {
      // Area units
      'SQM': 'M2', 'SQ M': 'M2', 'SQUARE METER': 'M2', 'SQUARE METERS': 'M2',
      'SQUARE METRE': 'M2', 'SQUARE METRES': 'M2', 'SQ METER': 'M2', 'SQ METRE': 'M2',
      'SQFT': 'FT2', 'SQ FT': 'FT2', 'SQUARE FOOT': 'FT2', 'SQUARE FEET': 'FT2',
      
      // Volume units
      'CUM': 'M3', 'CU M': 'M3', 'CUBIC METER': 'M3', 'CUBIC METERS': 'M3',
      'CUBIC METRE': 'M3', 'CUBIC METRES': 'M3', 'CU METER': 'M3', 'CU METRE': 'M3',
      'CUFT': 'FT3', 'CU FT': 'FT3', 'CUBIC FOOT': 'FT3', 'CUBIC FEET': 'FT3',
      
      // Weight units
      'KGS': 'KG', 'KILOGRAM': 'KG', 'KILOGRAMS': 'KG', 'KILO': 'KG',
      'TON': 'T', 'TONNE': 'T', 'TONNES': 'T', 'TONS': 'T', 'METRIC TON': 'T',
      'LBS': 'LB', 'POUND': 'LB', 'POUNDS': 'LB',
      
      // Volume (liquid) units
      'LTR': 'L', 'LITER': 'L', 'LITERS': 'L', 'LITRE': 'L', 'LITRES': 'L', 'LIT': 'L',
      'GAL': 'GALLON', 'GALLONS': 'GALLON',
      
      // Count units - Normalize all to UNIT (90% of your data)
      'NOS': 'UNIT', 'NUMBER': 'UNIT', 'NUMBERS': 'UNIT', 'NUM': 'UNIT',
      'PCS': 'UNIT', 'PIECE': 'UNIT', 'PIECES': 'UNIT', 'PC': 'UNIT',
      'EACH': 'UNIT', 'EA': 'UNIT', 'UNITS': 'UNIT', 'NO': 'UNIT',
      'NO.': 'UNIT', 'NR': 'UNIT', 'NR.': 'UNIT',
      
      // Length units
      'MT': 'M', 'MTR': 'M', 'METER': 'M', 'METERS': 'M', 'METRE': 'M', 'METRES': 'M',
      'MM': 'MM', 'MILLIMETER': 'MM', 'MILLIMETERS': 'MM', 'MILLIMETRE': 'MM', 'MILLIMETRES': 'MM',
      'CM': 'CM', 'CENTIMETER': 'CM', 'CENTIMETERS': 'CM', 'CENTIMETRE': 'CM', 'CENTIMETRES': 'CM',
      'RM': 'RM', 'RMT': 'RM', 'RUNNING METER': 'RM', 'RUNNING METERS': 'RM', 'RUNNING METRE': 'RM',
      'FT': 'FT', 'FEET': 'FT', 'FOOT': 'FT',
      'IN': 'IN', 'INCH': 'IN', 'INCHES': 'IN',
      
      // Time units
      'HR': 'HOUR', 'HRS': 'HOUR', 'HOURS': 'HOUR',
      'DAY': 'DAY', 'DAYS': 'DAY',
      'WEEK': 'WEEK', 'WEEKS': 'WEEK',
      'MONTH': 'MONTH', 'MONTHS': 'MONTH',
      
      // Other units
      'SET': 'SET', 'SETS': 'SET',
      'PAIR': 'PAIR', 'PAIRS': 'PAIR',
      'BAG': 'BAG', 'BAGS': 'BAG',
      'ROLL': 'ROLL', 'ROLLS': 'ROLL',
      'SHEET': 'SHEET', 'SHEETS': 'SHEET',
      'BUNDLE': 'BUNDLE', 'BUNDLES': 'BUNDLE'
    };
    
    return unitMap[normalized] || normalized;
  }

  /**
   * Match item with pre-generated embedding (for batch processing)
   */
  async matchItemWithEmbedding(
    description: string,
    method: 'V2' | 'V1',
    preGeneratedEmbedding: number[],
    providedPriceItems?: PriceItem[],
    contextHeaders?: string[]
  ): Promise<MatchingResult> {
    const priceItems = providedPriceItems || await this.getPriceItems();
    const queryUnit = this.extractUnit(description);
    
    // Filter items with embeddings for the specific provider
    const itemsWithEmbeddings = priceItems.filter(item => 
      item.embedding && item.embeddingProvider === method.toLowerCase()
    );
    
    if (itemsWithEmbeddings.length === 0) {
      return this.localMatch(description, priceItems, contextHeaders);
    }
    
    // Calculate similarities using pre-generated embedding
    const scoredMatches = itemsWithEmbeddings.map(item => {
      const similarity = this.cosineSimilarity(preGeneratedEmbedding, item.embedding!);
      
      // Strong unit boost for AI matching
      let finalScore = similarity;
      const itemUnit = item.unit || item.uom_id;
      if (queryUnit && itemUnit) {
        const normalizedQuery = this.normalizeUnit(queryUnit);
        const normalizedItem = this.normalizeUnit(itemUnit);
        if (normalizedQuery === normalizedItem) {
          // Boost score significantly for unit match
          finalScore = Math.min(similarity + 0.3, 0.99); // Add 30% boost instead of 20% multiply
        }
      } else if (queryUnit && !(item.unit || item.uom_id)) {
        // Penalize items without units
        finalScore = similarity * 0.7; // 30% penalty
      }
      
      return { item, score: finalScore };
    });
    
    // Sort and get best match
    scoredMatches.sort((a, b) => b.score - a.score);
    const bestMatch = scoredMatches[0];
    
    return {
      matchedItemId: bestMatch.item._id,
      matchedDescription: bestMatch.item.description || bestMatch.item.name || '',
      matchedCode: bestMatch.item.code || bestMatch.item.id || '',
      matchedUnit: bestMatch.item.unit || bestMatch.item.uom_id || '',
      matchedRate: bestMatch.item.rate || bestMatch.item.operation_cost || 0,
      confidence: bestMatch.score,
      method: method
    };
  }

  /**
   * Main matching method - simplified
   */
  async matchItem(
    description: string,
    method: 'LOCAL' | 'V2' | 'V1',
    providedPriceItems?: PriceItem[],
    contextHeaders?: string[]
  ): Promise<MatchingResult> {
    // Initialize AI clients if needed
    if (['V2', 'V1'].includes(method)) {
      await this.ensureClientsInitialized();
    }

    const priceItems = providedPriceItems || await this.getPriceItems();
    
    switch (method) {
      case 'LOCAL':
        return this.localMatch(description, priceItems, contextHeaders);
      case 'V2':
        return this.cohereMatch(description, priceItems, contextHeaders);
      case 'V1':
        return this.openAIMatch(description, priceItems, contextHeaders);
      default:
        throw new Error(`Unknown matching method: ${method}`);
    }
  }

  /**
   * LOCAL MATCH - Fuzzy matching optimized for new schema
   */
  private async localMatch(
    description: string, 
    priceItems: PriceItem[], 
    contextHeaders?: string[]
  ): Promise<MatchingResult> {
    const queryUnit = this.extractUnit(description);
    
    const queryProductTypes = this.detectProductType(description);
    
    console.log('[localMatch] Starting local match:', {
      description: description.substring(0, 50) + '...',
      queryUnit,
      queryProductTypes,
      contextHeaders: contextHeaders || [],
      priceItemsCount: priceItems.length
    });
    
    const expandedQuery = this.expandAbbreviations(description);
    
    const matches = priceItems.map(item => {
      // Get primary text - prioritize name over description
      const itemText = item.name || item.description || '';
      
      // Include variant information in the fuzzy matching
      let fullItemText = itemText;
      if (item.product_template_variant_value_ids) {
        fullItemText = `${itemText} ${item.product_template_variant_value_ids}`;
      }
      
      // Calculate fuzzy score using both original and expanded text
      const fuzzyScore1 = fuzz.token_set_ratio(description, fullItemText);
      const fuzzyScore2 = fuzz.token_set_ratio(expandedQuery, fullItemText);
      const fuzzyScore = Math.max(fuzzyScore1, fuzzyScore2);
      
      // Unit bonus - HEAVILY PRIORITIZED
      let unitBonus = 0;
      const itemUnit = item.uom_id || item.unit;
      if (queryUnit && itemUnit) {
        const normalizedQuery = this.normalizeUnit(queryUnit);
        const normalizedItem = this.normalizeUnit(itemUnit);
        if (normalizedQuery === normalizedItem) {
          unitBonus = 50; // Increased bonus since we don't have categories
        }
      } else if (queryUnit && !itemUnit) {
        // Penalize items without units when query has a unit
        unitBonus = -25; // Increased penalty
      } else if (!queryUnit && itemUnit) {
        // Slight penalty when query has no unit but item has one
        unitBonus = -5;
      }
      
      // Context bonus from BOQ headers (if available)
      let contextBonus = 0;
      if (contextHeaders && contextHeaders.length > 0) {
        const contextText = contextHeaders.join(' ').toLowerCase();
        const itemTextLower = fullItemText.toLowerCase();
        
        // Check if item contains context keywords
        const contextWords = contextText.split(/\s+/).filter(w => w.length > 3);
        const matchingWords = contextWords.filter(word => itemTextLower.includes(word));
        contextBonus = matchingWords.length * 8; // 8 points per matching context word
      }
      
      // ID matching bonus - if the BOQ description contains an ID that matches
      let idBonus = 0;
      if (item.id && description.toLowerCase().includes(item.id.toLowerCase())) {
        idBonus = 20; // Bonus for ID match
      }
      
      // Product type matching bonus - heavily weighted
      let typeBonus = 0;
      if (queryProductTypes.length > 0) {
        const itemProductTypes = this.detectProductType(fullItemText);
        const matchingTypes = queryProductTypes.filter(qType => 
          itemProductTypes.includes(qType)
        );
        typeBonus = matchingTypes.length * 15; // 15 points per matching type
        
        // Special bonus for size matches
        const querySizes = queryProductTypes.filter(t => t.startsWith('size:'));
        const itemSizes = itemProductTypes.filter(t => t.startsWith('size:'));
        if (querySizes.length > 0 && itemSizes.length > 0) {
          const sizeMatch = querySizes.some(qs => itemSizes.includes(qs));
          if (sizeMatch) typeBonus += 20;
        }
      }
      
      const totalScore = fuzzyScore + unitBonus + contextBonus + idBonus + typeBonus;
      
      return { item, score: totalScore };
    });
    
    // Sort with unit match as primary criteria when scores are close
    matches.sort((a, b) => {
      // If scores are very close (within 10 points), prioritize unit match
      if (Math.abs(b.score - a.score) < 10 && queryUnit) {
        const aNormUnit = (a.item.unit || a.item.uom_id) ? this.normalizeUnit(a.item.unit || a.item.uom_id) : '';
        const bNormUnit = (b.item.unit || b.item.uom_id) ? this.normalizeUnit(b.item.unit || b.item.uom_id) : '';
        const queryNormUnit = this.normalizeUnit(queryUnit);
        
        const aHasUnitMatch = aNormUnit === queryNormUnit;
        const bHasUnitMatch = bNormUnit === queryNormUnit;
        
        if (aHasUnitMatch && !bHasUnitMatch) return -1;
        if (!aHasUnitMatch && bHasUnitMatch) return 1;
      }
      
      return b.score - a.score;
    });
    const bestMatch = matches[0];
    
    // Log top 3 matches for debugging
    console.log('[localMatch] Top 3 matches:');
    matches.slice(0, 3).forEach((match, index) => {
      console.log(`  ${index + 1}. Score: ${match.score.toFixed(2)}, Desc: ${(match.item.description || match.item.name || '').substring(0, 50)}..., Unit: ${match.item.unit || match.item.uom_id || 'N/A'}`);
    });
    
    // Always return the best match, even if confidence is low
    // Let the user decide what confidence threshold to accept
    return {
      matchedItemId: bestMatch.item._id,
      matchedDescription: bestMatch.item.name || bestMatch.item.description || '',
      matchedCode: bestMatch.item.id || bestMatch.item.code || '',
      matchedUnit: bestMatch.item.uom_id || bestMatch.item.unit || '',
      matchedRate: bestMatch.item.operation_cost || bestMatch.item.rate || 0,
      // Adjust confidence calculation to account for bonuses
      // Max possible: fuzzy(100) + unit(50) + context(40) + id(20) + type(60) = 270
      // Scale confidence more generously to avoid too many low scores
      confidence: Math.min(bestMatch.score / 180, 0.95), // Scale to 180 for balanced scoring
      method: 'LOCAL'
    };
  }

  /**
   * V2 MATCH - Simple semantic matching
   */
  private async cohereMatch(
    description: string,
    priceItems: PriceItem[],
    contextHeaders?: string[]
  ): Promise<MatchingResult> {
    console.log('[cohereMatch] Starting with client:', !!this.cohereClient);
    
    if (!this.cohereClient) {
      console.log('[cohereMatch] No Cohere client available, falling back to LOCAL');
      return this.localMatch(description, priceItems, contextHeaders);
    }

    const queryUnit = this.extractUnit(description);
    
    // Enhanced query text with context headers
    let queryText = description;
    if (contextHeaders && contextHeaders.length > 0) {
      // Add all context headers to improve matching
      const contextText = contextHeaders.join(' ');
      queryText = `${contextText} ${description}`;
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
        console.error('[cohereMatch] Failed to generate query embedding:', error);
        return this.localMatch(description, priceItems, contextHeaders);
      }
    }

    // Score all items
    const scoredItems = await Promise.all(
      priceItems.map(async (item) => {
        const itemText = this.createSimpleText(item);
        const cacheKey = `cohere_${itemText}`;
        let embedding = this.embeddingCache.get(cacheKey);
        
        if (!embedding && item.embedding && item.embeddingProvider === 'V2') {
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
        
        // Strong unit boost for Cohere matching
        let finalScore = similarity;
        if (queryUnit && item.unit) {
          const normalizedQuery = this.normalizeUnit(queryUnit);
          const normalizedItem = this.normalizeUnit(item.unit);
          if (normalizedQuery === normalizedItem) {
            // Boost score significantly for unit match
            finalScore = Math.min(similarity + 0.3, 0.99); // Add 30% boost
          }
        } else if (queryUnit && !(item.unit || item.uom_id)) {
          // Penalize items without units
          finalScore = similarity * 0.7; // 30% penalty
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
      matchedDescription: bestMatch.item.description || bestMatch.item.name || '',
      matchedCode: bestMatch.item.code || bestMatch.item.id || '',
      matchedUnit: bestMatch.item.unit || bestMatch.item.uom_id || '',
      matchedRate: bestMatch.item.rate || bestMatch.item.operation_cost || 0,
      confidence: bestMatch.score,
      method: 'V2'
    };
  }

  /**
   * V1 MATCH - Simple semantic matching
   */
  private async openAIMatch(
    description: string,
    priceItems: PriceItem[],
    contextHeaders?: string[]
  ): Promise<MatchingResult> {
    console.log('[openAIMatch] Starting with client:', !!this.openaiClient);
    
    if (!this.openaiClient) {
      console.log('[openAIMatch] No OpenAI client available, falling back to LOCAL');
      return this.localMatch(description, priceItems, contextHeaders);
    }

    const queryUnit = this.extractUnit(description);
    
    // Enhanced query text with context headers
    let queryText = description;
    if (contextHeaders && contextHeaders.length > 0) {
      // Add all context headers to improve matching
      const contextText = contextHeaders.join(' ');
      queryText = `${contextText} ${description}`;
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
      console.error('[openAIMatch] Failed to generate query embedding:', error);
      return this.localMatch(description, priceItems, contextHeaders);
    }

    // Score items that have embeddings
    const scoredItems = priceItems
      .filter(item => item.embedding && item.embeddingProvider === 'V1')
      .map(item => {
        const similarity = this.cosineSimilarity(queryEmbedding, item.embedding!);
        
        // Strong unit boost for OpenAI matching
        let finalScore = similarity;
        if (queryUnit && item.unit) {
          const normalizedQuery = this.normalizeUnit(queryUnit);
          const normalizedItem = this.normalizeUnit(item.unit);
          if (normalizedQuery === normalizedItem) {
            // Boost score significantly for unit match
            finalScore = Math.min(similarity + 0.3, 0.99); // Add 30% boost
          }
        } else if (queryUnit && !(item.unit || item.uom_id)) {
          // Penalize items without units
          finalScore = similarity * 0.7; // 30% penalty
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
      matchedDescription: bestMatch.item.description || bestMatch.item.name || '',
      matchedCode: bestMatch.item.code || bestMatch.item.id || '',
      matchedUnit: bestMatch.item.unit || bestMatch.item.uom_id || '',
      matchedRate: bestMatch.item.rate || bestMatch.item.operation_cost || 0,
      confidence: bestMatch.score,
      method: 'V1'
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

  /**
   * Generate embeddings for BOQ items (for price list)
   */
  async generateBOQEmbeddings(
    items: Array<{ description: string; category?: string; subcategory?: string; unit?: string; uom_id?: string }>,
    provider: 'V2' | 'V1'
  ): Promise<Map<string, number[]>> {
    await this.ensureClientsInitialized();
    const embeddings = new Map<string, number[]>();

    if (provider === 'V2' && this.cohereClient) {
      try {
        // Create enhanced texts with category+subcategory emphasis
        const texts = items.map(item => {
          const parts = [item.description];
          if (item.category && item.subcategory) {
            // Emphasize the combined context
            parts.push(`${item.category} ${item.subcategory}`);
            parts.push(`${item.subcategory} ${item.category}`); // Reverse order too
          } else if (item.category) {
            parts.push(item.category);
          } else if (item.subcategory) {
            parts.push(item.subcategory);
          }
          const unit = item.unit || item.uom_id;
          if (unit) parts.push(unit);
          return parts.join(' ');
        });
        
        const response = await this.cohereClient.embed({
          texts,
          model: 'embed-english-v3.0',
          inputType: 'search_document',
        });
        
        items.forEach((item, index) => {
          embeddings.set(item.description, response.embeddings[index]);
        });
      } catch (error) {
        // Silently fail - embeddings not critical
      }
    } else if (provider === 'V1' && this.openaiClient) {
      try {
        // Create enhanced texts with category+subcategory emphasis
        const texts = items.map(item => {
          const parts = [item.description];
          if (item.category && item.subcategory) {
            // Emphasize the combined context
            parts.push(`${item.category} ${item.subcategory}`);
            parts.push(`${item.subcategory} ${item.category}`); // Reverse order too
          } else if (item.category) {
            parts.push(item.category);
          } else if (item.subcategory) {
            parts.push(item.subcategory);
          }
          const unit = item.unit || item.uom_id;
          if (unit) parts.push(unit);
          return parts.join(' ');
        });
        
        const response = await this.openaiClient.embeddings.create({
          input: texts,
          model: 'text-embedding-3-small',
        });
        
        items.forEach((item, index) => {
          embeddings.set(item.description, response.data[index].embedding);
        });
      } catch (error) {
        // Silently fail - embeddings not critical
      }
    }

    return embeddings;
  }

  /**
   * Generate batch embeddings for matching
   */
  async generateBatchEmbeddings(
    descriptions: string[],
    method: 'V2' | 'V1'
  ): Promise<Map<string, number[]>> {
    await this.ensureClientsInitialized();
    const embeddings = new Map<string, number[]>();

    if (method === 'V2' && this.cohereClient) {
      try {
        const response = await this.cohereClient.embed({
          texts: descriptions,
          model: 'embed-english-v3.0',
          inputType: 'search_query',
        });
        
        descriptions.forEach((desc, index) => {
          embeddings.set(desc, response.embeddings[index]);
        });
      } catch (error) {
        // Silently fail - return empty map
      }
    } else if (method === 'V1' && this.openaiClient) {
      try {
        const response = await this.openaiClient.embeddings.create({
          input: descriptions,
          model: 'text-embedding-3-small',
        });
        
        descriptions.forEach((desc, index) => {
          embeddings.set(desc, response.data[index].embedding);
        });
      } catch (error) {
        // Silently fail - return empty map
      }
    }

    return embeddings;
  }
}


