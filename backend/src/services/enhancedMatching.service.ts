import * as fuzzball from 'fuzzball';
import { PriceItem } from '../types/priceItem.types';

interface ConstructionAbbreviation {
  abbreviation: string;
  expansions: string[];
}

interface UnitConversion {
  from: string[];
  to: string;
  factor: number;
}

interface MatchResult {
  item: PriceItem;
  score: number;
  method: string;
  unitConverted?: boolean;
  conversionFactor?: number;
}

export class EnhancedMatchingService {
  private static constructionAbbreviations: ConstructionAbbreviation[] = [
    { abbreviation: 'RCC', expansions: ['reinforced cement concrete', 'reinforced concrete'] },
    { abbreviation: 'PCC', expansions: ['plain cement concrete', 'plain concrete'] },
    { abbreviation: 'DPC', expansions: ['damp proof course', 'dampproofing'] },
    { abbreviation: 'BW', expansions: ['brick work', 'brickwork'] },
    { abbreviation: 'SW', expansions: ['stone work', 'stonework'] },
    { abbreviation: 'PW', expansions: ['plaster work', 'plastering'] },
    { abbreviation: 'FW', expansions: ['form work', 'formwork', 'shuttering'] },
    { abbreviation: 'MS', expansions: ['mild steel', 'metal steel'] },
    { abbreviation: 'HSD', expansions: ['high strength deformed', 'high strength deformed bars'] },
    { abbreviation: 'TMT', expansions: ['thermo mechanically treated'] },
    { abbreviation: 'SQM', expansions: ['square meter', 'square metre', 'sqm', 'sq.m'] },
    { abbreviation: 'CUM', expansions: ['cubic meter', 'cubic metre', 'cum', 'cu.m'] },
    { abbreviation: 'RMT', expansions: ['running meter', 'running metre', 'rmt', 'r.m'] },
    { abbreviation: 'MT', expansions: ['metric ton', 'metric tonne', 'mt'] },
    { abbreviation: 'GI', expansions: ['galvanized iron', 'galvanised iron'] },
    { abbreviation: 'CI', expansions: ['cast iron'] },
    { abbreviation: 'AC', expansions: ['asbestos cement', 'air conditioning'] },
    { abbreviation: 'WC', expansions: ['water closet', 'toilet'] },
    { abbreviation: 'CP', expansions: ['cement plaster', 'chromium plated'] },
    { abbreviation: 'UPVC', expansions: ['unplasticized polyvinyl chloride'] },
    { abbreviation: 'PSC', expansions: ['prestressed concrete'] },
    { abbreviation: 'RBC', expansions: ['random rubble masonry'] },
    { abbreviation: 'BBM', expansions: ['burnt brick masonry'] },
    { abbreviation: 'DL', expansions: ['dead load'] },
    { abbreviation: 'LL', expansions: ['live load'] },
    { abbreviation: 'GL', expansions: ['ground level'] },
    { abbreviation: 'FL', expansions: ['floor level', 'finished level'] },
    { abbreviation: 'SL', expansions: ['sill level'] },
    { abbreviation: 'EGL', expansions: ['existing ground level'] },
    { abbreviation: 'FGL', expansions: ['finished ground level'] },
    { abbreviation: 'CPVC', expansions: ['chlorinated polyvinyl chloride'] },
    { abbreviation: 'PPR', expansions: ['polypropylene random'] },
    { abbreviation: 'HDPE', expansions: ['high density polyethylene'] },
    { abbreviation: 'AAC', expansions: ['autoclaved aerated concrete'] },
    { abbreviation: 'RMC', expansions: ['ready mix concrete'] },
    { abbreviation: 'OPC', expansions: ['ordinary portland cement'] },
    { abbreviation: 'PPC', expansions: ['portland pozzolana cement'] },
    { abbreviation: 'SRC', expansions: ['sulphate resistant cement'] },
    { abbreviation: 'WBM', expansions: ['water bound macadam'] },
    { abbreviation: 'GSB', expansions: ['granular sub base'] },
    { abbreviation: 'DBM', expansions: ['dense bituminous macadam'] },
    { abbreviation: 'BC', expansions: ['bituminous concrete'] },
    { abbreviation: 'SDBC', expansions: ['semi dense bituminous concrete'] },
  ];

  private static constructionKeywords = {
    concrete: ['cement', 'aggregate', 'sand', 'water', 'mix', 'grade', 'M10', 'M15', 'M20', 'M25', 'M30', 'M35', 'M40'],
    steel: ['reinforcement', 'bars', 'rods', 'TMT', 'Fe415', 'Fe500', 'Fe550', 'binding wire', 'stirrups', 'links'],
    masonry: ['brick', 'block', 'mortar', 'joint', 'course', 'wall', 'CMU', 'AAC', 'fly ash'],
    flooring: ['tiles', 'marble', 'granite', 'vitrified', 'ceramic', 'polished', 'kota stone', 'anti-skid'],
    plumbing: ['pipe', 'fitting', 'valve', 'tap', 'sanitary', 'drainage', 'CPVC', 'PPR', 'HDPE', 'elbow', 'tee'],
    electrical: ['wire', 'cable', 'switch', 'socket', 'conduit', 'MCB', 'MCCB', 'ELCB', 'RCCB', 'armoured'],
    painting: ['primer', 'putty', 'emulsion', 'enamel', 'distemper', 'polish', 'texture', 'acrylic'],
    woodwork: ['door', 'window', 'frame', 'shutter', 'plywood', 'veneer', 'laminate', 'particle board', 'MDF'],
    waterproofing: ['membrane', 'coating', 'bitumen', 'polymer', 'crystalline', 'injection', 'grouting'],
    insulation: ['thermal', 'acoustic', 'foam', 'glass wool', 'rock wool', 'XPS', 'EPS', 'polyurethane'],
  };

  private static unitConversions: UnitConversion[] = [
    // Area conversions
    { from: ['sqft', 'sq.ft', 'square feet', 'sft'], to: 'sqm', factor: 0.092903 },
    { from: ['sqyd', 'sq.yd', 'square yard', 'syd'], to: 'sqm', factor: 0.836127 },
    { from: ['sqm', 'sq.m', 'square meter', 'm2'], to: 'sqm', factor: 1 },
    
    // Length conversions
    { from: ['ft', 'feet', 'foot'], to: 'm', factor: 0.3048 },
    { from: ['inch', 'in', '"'], to: 'm', factor: 0.0254 },
    { from: ['m', 'meter', 'metre', 'lm'], to: 'm', factor: 1 },
    { from: ['cm', 'centimeter'], to: 'm', factor: 0.01 },
    { from: ['mm', 'millimeter'], to: 'm', factor: 0.001 },
    
    // Volume conversions
    { from: ['cft', 'cu.ft', 'cubic feet'], to: 'cum', factor: 0.028317 },
    { from: ['cum', 'cu.m', 'cubic meter', 'm3'], to: 'cum', factor: 1 },
    { from: ['liter', 'litre', 'ltr', 'l'], to: 'cum', factor: 0.001 },
    
    // Weight conversions
    { from: ['kg', 'kilogram'], to: 'kg', factor: 1 },
    { from: ['g', 'gram'], to: 'kg', factor: 0.001 },
    { from: ['ton', 'tonne', 'mt'], to: 'kg', factor: 1000 },
    { from: ['quintal', 'qtl'], to: 'kg', factor: 100 },
    
    // Count conversions
    { from: ['no', 'nos', 'number', 'piece', 'pcs', 'unit', 'each', 'ea'], to: 'nos', factor: 1 },
    { from: ['dozen', 'doz'], to: 'nos', factor: 12 },
    { from: ['gross'], to: 'nos', factor: 144 },
  ];

  static preprocessText(text: string): string {
    let processed = text.toLowerCase().trim();
    
    // Remove special characters but keep important ones
    processed = processed.replace(/[^\w\s\-\.\/]/g, ' ');
    
    // Normalize multiple spaces
    processed = processed.replace(/\s+/g, ' ');
    
    // Expand abbreviations
    for (const abbr of this.constructionAbbreviations) {
      const regex = new RegExp(`\\b${abbr.abbreviation.toLowerCase()}\\b`, 'gi');
      if (regex.test(processed)) {
        processed = processed.replace(regex, abbr.expansions[0]);
      }
    }
    
    return processed;
  }

  static extractKeywords(text: string): string[] {
    const processed = this.preprocessText(text);
    const words = processed.split(' ').filter(w => w.length > 2);
    const keywords: Set<string> = new Set(words);
    
    // Add category-specific keywords
    for (const [category, categoryKeywords] of Object.entries(this.constructionKeywords)) {
      for (const keyword of categoryKeywords) {
        if (processed.includes(keyword.toLowerCase())) {
          keywords.add(category);
          categoryKeywords.forEach(k => keywords.add(k));
          break;
        }
      }
    }
    
    return Array.from(keywords);
  }

  static normalizeUnit(unit: string | undefined): string {
    if (!unit) return '';
    
    const normalized = unit.toLowerCase().trim();
    
    // Find the standard unit
    for (const conversion of this.unitConversions) {
      if (conversion.from.includes(normalized)) {
        return conversion.to;
      }
    }
    
    return normalized;
  }

  static getUnitConversionFactor(fromUnit: string, toUnit: string): number | null {
    const fromNorm = this.normalizeUnit(fromUnit);
    const toNorm = this.normalizeUnit(toUnit);
    
    if (fromNorm === toNorm) return 1;
    
    // Find conversion from source unit to standard
    let fromConversion: UnitConversion | undefined;
    let toConversion: UnitConversion | undefined;
    
    for (const conv of this.unitConversions) {
      if (conv.from.includes(fromNorm)) fromConversion = conv;
      if (conv.from.includes(toNorm)) toConversion = conv;
    }
    
    // If both units convert to the same standard unit, calculate the factor
    if (fromConversion && toConversion && fromConversion.to === toConversion.to) {
      return fromConversion.factor / toConversion.factor;
    }
    
    return null;
  }

  static extractUnit(text: string): string | null {
    const unitPatterns = [
      // Area units
      /\b(sqm|sq\.m|square meter|square metre|m2)\b/i,
      /\b(sqft|sq\.ft|square feet|sft)\b/i,
      /\b(sqyd|sq\.yd|square yard|syd)\b/i,
      
      // Volume units
      /\b(cum|cu\.m|cubic meter|cubic metre|m3)\b/i,
      /\b(cft|cu\.ft|cubic feet)\b/i,
      /\b(liter|litre|ltr|l)\b/i,
      
      // Length units
      /\b(m|meter|metre|lm|linear meter)\b/i,
      /\b(ft|feet|foot)\b/i,
      /\b(inch|in|")\b/i,
      /\b(cm|centimeter)\b/i,
      /\b(mm|millimeter)\b/i,
      
      // Weight units
      /\b(kg|kilogram)\b/i,
      /\b(g|gram)\b/i,
      /\b(ton|tonne|mt)\b/i,
      /\b(quintal|qtl)\b/i,
      
      // Count units
      /\b(no|nos|number|piece|pcs|unit|each|ea)\b/i,
      /\b(dozen|doz)\b/i,
      /\b(gross)\b/i,
    ];

    for (const pattern of unitPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0].toLowerCase();
      }
    }

    return null;
  }

  static areUnitsCompatible(unit1: string, unit2: string): boolean {
    const norm1 = this.normalizeUnit(unit1);
    const norm2 = this.normalizeUnit(unit2);
    
    // Same normalized unit
    if (norm1 === norm2) return true;
    
    // Check if conversion is possible
    return this.getUnitConversionFactor(unit1, unit2) !== null;
  }

  static calculateScore(
    queryText: string,
    itemText: string,
    options: {
      method?: string;
      unitMatch?: boolean;
      categoryMatch?: boolean;
      contextMatch?: boolean;
    } = {}
  ): number {
    // Base fuzzy match score
    let score = fuzzball.token_set_ratio(queryText, itemText);
    
    // Apply bonuses
    if (options.unitMatch) score += 10;
    if (options.categoryMatch) score += 15;
    if (options.contextMatch) score += 5;
    
    // Method-specific adjustments
    if (options.method === 'exact') score = 100;
    if (options.method === 'code' && score > 80) score = 95;
    
    return Math.min(score, 100);
  }

  static enhancedFuzzyMatch(
    query: string,
    priceItems: PriceItem[],
    limit: number = 5,
    contextHeaders?: string[]
  ): MatchResult[] {
    const processedQuery = this.preprocessText(query);
    const queryKeywords = this.extractKeywords(query);
    const queryUnit = this.extractUnit(query);
    
    const matches: MatchResult[] = [];
    
    for (const item of priceItems) {
      const processedItem = this.preprocessText(item.description);
      const itemKeywords = this.extractKeywords(item.description);
      
      // Calculate base score
      let score = this.calculateScore(processedQuery, processedItem, {
        method: 'fuzzy'
      });
      
      // Unit matching with conversion support
      let unitConverted = false;
      let conversionFactor = 1;
      
      if (queryUnit && item.unit) {
        if (this.areUnitsCompatible(queryUnit, item.unit)) {
          const factor = this.getUnitConversionFactor(queryUnit, item.unit);
          if (factor !== null && factor !== 1) {
            unitConverted = true;
            conversionFactor = factor;
            score += 8; // Slightly lower bonus for converted units
          } else if (factor === 1) {
            score += 10; // Full bonus for exact unit match
          }
        }
      }
      
      // Keyword matching
      const commonKeywords = queryKeywords.filter(k => itemKeywords.includes(k));
      score += Math.min(commonKeywords.length * 5, 20);
      
      // Context matching
      if (contextHeaders && contextHeaders.length > 0) {
        const contextMatch = contextHeaders.some(header => 
          processedItem.includes(header.toLowerCase()) ||
          header.toLowerCase().includes(processedItem.split(' ')[0])
        );
        if (contextMatch) score += 5;
      }
      
      // Category and subcategory boost
      if (item.category) {
        const categoryKeywords = this.constructionKeywords[item.category.toLowerCase()] || [];
        const categoryMatch = categoryKeywords.some(k => 
          processedQuery.includes(k.toLowerCase())
        );
        if (categoryMatch) score += 15;
        
        // Direct category name match
        if (processedQuery.includes(item.category.toLowerCase())) {
          score += 20;
        }
      }
      
      // Subcategory boost
      if (item.subcategory || item.subCategoryName) {
        const subcategory = (item.subcategory || item.subCategoryName || '').toLowerCase();
        if (processedQuery.includes(subcategory) || subcategory.includes(processedQuery)) {
          score += 18;
        }
      }
      
      matches.push({
        item,
        score,
        method: 'fuzzy',
        unitConverted,
        conversionFactor
      });
    }
    
    // Sort by score and return top matches
    return matches
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  static async multiStageMatch(
    query: string,
    priceItems: PriceItem[],
    options: {
      useExactMatch?: boolean;
      useCodeMatch?: boolean;
      useFuzzyMatch?: boolean;
      useSemanticMatch?: boolean;
      limit?: number;
    } = {}
  ): Promise<MatchResult[]> {
    const {
      useExactMatch = true,
      useCodeMatch = true,
      useFuzzyMatch = true,
      useSemanticMatch = false,
      limit = 5
    } = options;
    
    const allMatches: MatchResult[] = [];
    const processedQuery = this.preprocessText(query);
    
    // Stage 1: Exact match
    if (useExactMatch) {
      for (const item of priceItems) {
        if (this.preprocessText(item.description) === processedQuery) {
          allMatches.push({
            item,
            score: 100,
            method: 'exact'
          });
        }
      }
    }
    
    // Stage 2: Code match
    if (useCodeMatch) {
      const codePattern = /\b[A-Z0-9]{2,}\b/g;
      const queryCodes = query.match(codePattern) || [];
      
      for (const item of priceItems) {
        if (item.code && queryCodes.some(code => code === item.code)) {
          allMatches.push({
            item,
            score: 95,
            method: 'code'
          });
        }
      }
    }
    
    // Stage 3: Enhanced fuzzy match
    if (useFuzzyMatch) {
      const fuzzyMatches = this.enhancedFuzzyMatch(query, priceItems, limit * 2);
      allMatches.push(...fuzzyMatches);
    }
    
    // Remove duplicates and sort by score
    const uniqueMatches = new Map<string, MatchResult>();
    for (const match of allMatches) {
      const existing = uniqueMatches.get(match.item._id);
      if (!existing || match.score > existing.score) {
        uniqueMatches.set(match.item._id, match);
      }
    }
    
    return Array.from(uniqueMatches.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

export const enhancedMatchingService = new EnhancedMatchingService();
