/**
 * Construction-specific patterns and matching logic
 */

export interface ConstructionPattern {
  pattern: RegExp;
  category: string;
  keywords: string[];
  priority: number;
}

export interface MaterialSpecification {
  material: string;
  grades: string[];
  units: string[];
  keywords: string[];
}

export class ConstructionPatternsService {
  // Construction work type patterns with priority
  private static workTypePatterns: ConstructionPattern[] = [
    // Excavation patterns
    {
      pattern: /\b(excavat|dig|cut|trench|pit|basement|foundation)\w*/i,
      category: 'Excavation',
      keywords: ['depth', 'level', 'ground', 'earth', 'soil'],
      priority: 10
    },
    {
      pattern: /\b(fill|backfill|sand fill|earth fill|compaction)\w*/i,
      category: 'Filling',
      keywords: ['thickness', 'layer', 'compacted', 'watered'],
      priority: 10
    },
    // Concrete work patterns
    {
      pattern: /\b(concrete|RCC|PCC|cement|cast)\w*/i,
      category: 'Concrete',
      keywords: ['grade', 'mix', 'pour', 'vibrated', 'curing'],
      priority: 9
    },
    {
      pattern: /\b(reinforc|steel|bar|rod|TMT|Fe\d+)\w*/i,
      category: 'Reinforcement',
      keywords: ['dia', 'diameter', 'spacing', 'stirrup', 'bent'],
      priority: 9
    },
    // Masonry patterns
    {
      pattern: /\b(brick|block|masonry|wall|partition)\w*/i,
      category: 'Masonry',
      keywords: ['thickness', 'course', 'mortar', 'joint', 'pointing'],
      priority: 8
    },
    // Formwork patterns
    {
      pattern: /\b(formwork|shuttering|centering|staging)\w*/i,
      category: 'Formwork',
      keywords: ['support', 'props', 'plywood', 'steel', 'remove'],
      priority: 8
    },
    // Waterproofing patterns
    {
      pattern: /\b(waterproof|damp proof|DPC|membrane|seal)\w*/i,
      category: 'Waterproofing',
      keywords: ['coating', 'layer', 'bitumen', 'chemical', 'treatment'],
      priority: 7
    },
    // Plastering patterns
    {
      pattern: /\b(plaster|render|skim|smooth|finish)\w*/i,
      category: 'Plastering',
      keywords: ['thickness', 'coat', 'cement', 'sand', 'ratio'],
      priority: 7
    },
    // Flooring patterns
    {
      pattern: /\b(floor|tile|marble|granite|stone|vitrified)\w*/i,
      category: 'Flooring',
      keywords: ['laying', 'bedding', 'polished', 'pattern', 'skirting'],
      priority: 6
    },
    // Painting patterns
    {
      pattern: /\b(paint|primer|putty|emulsion|enamel|coat)\w*/i,
      category: 'Painting',
      keywords: ['surface', 'preparation', 'coats', 'finish', 'texture'],
      priority: 6
    },
    // Piling patterns
    {
      pattern: /\b(pile|piling|bore|driven|sheet pile)\w*/i,
      category: 'Piling',
      keywords: ['depth', 'diameter', 'load', 'capacity', 'cut-off'],
      priority: 9
    },
    // Structural steel patterns
    {
      pattern: /\b(structural steel|ISMB|ISMC|ISLB|angle|channel)\w*/i,
      category: 'Structural Steel',
      keywords: ['section', 'weight', 'welding', 'bolting', 'fabrication'],
      priority: 8
    }
  ];

  // Material specifications with common grades and units
  private static materialSpecs: MaterialSpecification[] = [
    {
      material: 'concrete',
      grades: ['M10', 'M15', 'M20', 'M25', 'M30', 'M35', 'M40', 'M45', 'M50'],
      units: ['M3', 'CUM', 'CUBIC METER'],
      keywords: ['cement', 'aggregate', 'sand', 'mix', 'grade', 'strength']
    },
    {
      material: 'steel',
      grades: ['Fe415', 'Fe500', 'Fe550', 'Fe600', 'HYSD', 'TMT', 'CTD'],
      units: ['KG', 'TON', 'MT', 'QUINTAL'],
      keywords: ['reinforcement', 'bar', 'rod', 'dia', 'diameter', 'bend']
    },
    {
      material: 'cement',
      grades: ['OPC43', 'OPC53', 'PPC', 'PSC', 'SRC', 'WHITE'],
      units: ['BAG', 'KG', 'TON'],
      keywords: ['ordinary', 'portland', 'pozzolana', 'sulphate', 'resistant']
    },
    {
      material: 'brick',
      grades: ['1ST CLASS', '2ND CLASS', 'AAC', 'FLY ASH', 'CLAY'],
      units: ['NO', 'NOS', 'THOUSAND', '1000'],
      keywords: ['size', 'class', 'quality', 'burnt', 'pressed']
    },
    {
      material: 'sand',
      grades: ['RIVER', 'PIT', 'SEA', 'MANUFACTURED', 'FINE', 'COARSE'],
      units: ['M3', 'CUM', 'CFT', 'BRASS'],
      keywords: ['zone', 'sieve', 'washed', 'screened', 'grading']
    },
    {
      material: 'aggregate',
      grades: ['10MM', '12MM', '20MM', '40MM', '63MM', 'GSB', 'WMM'],
      units: ['M3', 'CUM', 'MT', 'TON'],
      keywords: ['crushed', 'graded', 'nominal', 'size', 'stone']
    }
  ];

  // Common dimension patterns in construction
  private static dimensionPatterns = [
    /\b(\d+(?:\.\d+)?)\s*[xXÃ—]\s*(\d+(?:\.\d+)?)\s*[xXÃ—]\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|mt|mtr|meter|metre)?\b/i, // 3D dimensions
    /\b(\d+(?:\.\d+)?)\s*[xXÃ—]\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|mt|mtr|meter|metre)?\b/i, // 2D dimensions
    /\b(\d+(?:\.\d+)?)\s*(mm|cm|m|mt|mtr|meter|metre)\s*(?:thick|thk|thickness|dia|diameter|width|length|height|deep|depth)\b/i,
    /\b(?:thick|thk|thickness|dia|diameter|width|length|height|deep|depth)[:\s]+(\d+(?:\.\d+)?)\s*(mm|cm|m|mt|mtr|meter|metre)?\b/i
  ];

  // Common spacing patterns
  private static spacingPatterns = [
    /\b(\d+)\s*mm\s*@\s*(\d+)\s*mm\s*c\/c\b/i, // 10mm @ 150mm c/c
    /\b(\d+)\s*(?:mm|cm|m)\s*(?:centers?|centres?|c\/c)\b/i,
    /\b@\s*(\d+)\s*(?:mm|cm|m)\s*(?:spacing|apart|interval)\b/i
  ];

  // Ratio patterns (for mortar, concrete mix, etc.)
  private static ratioPatterns = [
    /\b(\d+):(\d+)(?::(\d+))?\b/, // 1:2:4 or 1:6
    /\bCM\s*(\d+):(\d+)\b/i, // CM 1:6
    /\b(?:ratio|proportion|mix)\s*(\d+):(\d+)(?::(\d+))?\b/i
  ];

  /**
   * Extract construction-specific features from description
   */
  static extractConstructionFeatures(description: string): {
    workType?: string;
    material?: string;
    grade?: string;
    dimensions?: string[];
    spacing?: string;
    ratio?: string;
    keywords: string[];
  } {
    const features: any = {
      keywords: []
    };

    // Extract work type
    for (const pattern of this.workTypePatterns) {
      if (pattern.pattern.test(description)) {
        features.workType = pattern.category;
        features.keywords.push(...pattern.keywords);
        break;
      }
    }

    // Extract material and grade
    for (const spec of this.materialSpecs) {
      if (new RegExp(`\\b${spec.material}\\b`, 'i').test(description)) {
        features.material = spec.material;
        
        // Check for grades
        for (const grade of spec.grades) {
          if (new RegExp(`\\b${grade}\\b`, 'i').test(description)) {
            features.grade = grade;
            break;
          }
        }
        
        features.keywords.push(...spec.keywords);
        break;
      }
    }

    // Extract dimensions
    features.dimensions = [];
    for (const pattern of this.dimensionPatterns) {
      const match = description.match(pattern);
      if (match) {
        features.dimensions.push(match[0]);
      }
    }

    // Extract spacing
    for (const pattern of this.spacingPatterns) {
      const match = description.match(pattern);
      if (match) {
        features.spacing = match[0];
        break;
      }
    }

    // Extract ratios
    for (const pattern of this.ratioPatterns) {
      const match = description.match(pattern);
      if (match) {
        features.ratio = match[0];
        break;
      }
    }

    // Extract additional construction keywords
    const constructionKeywords = [
      'reinforced', 'plain', 'precast', 'cast in situ', 'vibrated',
      'compacted', 'watered', 'cured', 'finished', 'grouted',
      'waterproofed', 'insulated', 'painted', 'polished', 'rendered'
    ];

    for (const keyword of constructionKeywords) {
      if (new RegExp(`\\b${keyword}\\b`, 'i').test(description)) {
        features.keywords.push(keyword);
      }
    }

    return features;
  }

  /**
   * Calculate construction-specific similarity score
   */
  static calculateConstructionScore(
    queryFeatures: ReturnType<typeof this.extractConstructionFeatures>,
    itemFeatures: ReturnType<typeof this.extractConstructionFeatures>
  ): number {
    let score = 0;

    // Work type match (30 points)
    if (queryFeatures.workType && itemFeatures.workType) {
      if (queryFeatures.workType === itemFeatures.workType) {
        score += 30;
      }
    }

    // Material match (20 points)
    if (queryFeatures.material && itemFeatures.material) {
      if (queryFeatures.material === itemFeatures.material) {
        score += 20;
      }
    }

    // Grade match (15 points)
    if (queryFeatures.grade && itemFeatures.grade) {
      if (queryFeatures.grade === itemFeatures.grade) {
        score += 15;
      }
    }

    // Dimension similarity (10 points)
    if (queryFeatures.dimensions?.length && itemFeatures.dimensions?.length) {
      const commonDimensions = queryFeatures.dimensions.filter(d =>
        itemFeatures.dimensions?.includes(d)
      );
      if (commonDimensions.length > 0) {
        score += 10;
      }
    }

    // Keyword overlap (up to 25 points)
    const commonKeywords = queryFeatures.keywords.filter(k =>
      itemFeatures.keywords.includes(k)
    );
    score += Math.min(25, commonKeywords.length * 5);

    return Math.min(100, score);
  }

  /**
   * Expand construction abbreviations in text
   */
  static expandAbbreviations(text: string): string {
    const abbreviations = new Map([
      ['RCC', 'reinforced cement concrete'],
      ['PCC', 'plain cement concrete'],
      ['DPC', 'damp proof course'],
      ['MS', 'mild steel'],
      ['TMT', 'thermo mechanically treated'],
      ['HYSD', 'high yield strength deformed'],
      ['BW', 'brick work'],
      ['PW', 'plaster work'],
      ['FW', 'form work'],
      ['GI', 'galvanized iron'],
      ['CI', 'cast iron'],
      ['CPVC', 'chlorinated polyvinyl chloride'],
      ['PPR', 'polypropylene random'],
      ['HDPE', 'high density polyethylene'],
      ['AAC', 'autoclaved aerated concrete'],
      ['OPC', 'ordinary portland cement'],
      ['PPC', 'portland pozzolana cement'],
      ['SRC', 'sulphate resistant cement'],
      ['WBM', 'water bound macadam'],
      ['GSB', 'granular sub base'],
      ['DBM', 'dense bituminous macadam']
    ]);

    let expandedText = text;
    abbreviations.forEach((expansion, abbr) => {
      const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
      expandedText = expandedText.replace(regex, `${abbr} (${expansion})`);
    });

    return expandedText;
  }

  /**
   * Identify construction method from description
   */
  static identifyConstructionMethod(description: string): string[] {
    const methods: string[] = [];
    
    const methodPatterns = [
      { pattern: /\bmachine\s+excavat/i, method: 'machine_excavation' },
      { pattern: /\bmanual\s+excavat/i, method: 'manual_excavation' },
      { pattern: /\bcast\s+in\s+situ/i, method: 'cast_in_situ' },
      { pattern: /\bprecast/i, method: 'precast' },
      { pattern: /\bprestressed/i, method: 'prestressed' },
      { pattern: /\bpost\s+tension/i, method: 'post_tensioned' },
      { pattern: /\bspray\s+concrete/i, method: 'shotcrete' },
      { pattern: /\bguniting/i, method: 'guniting' },
      { pattern: /\btremie\s+concrete/i, method: 'tremie_concreting' },
      { pattern: /\broller\s+compact/i, method: 'roller_compacted' }
    ];

    for (const { pattern, method } of methodPatterns) {
      if (pattern.test(description)) {
        methods.push(method);
      }
    }

    return methods;
  }

  /**
   * Check if description indicates temporary/permanent work
   */
  static isTemporaryWork(description: string): boolean {
    const temporaryPatterns = [
      /\btemporary\b/i,
      /\bscaffold/i,
      /\bshor(?:e|ing)\b/i,
      /\bstaging\b/i,
      /\bcentering\b/i,
      /\bshuttering\b/i,
      /\bformwork\b/i,
      /\bbarricad/i,
      /\bhoarding/i
    ];

    return temporaryPatterns.some(pattern => pattern.test(description));
  }

  /**
   * Extract location context from description
   */
  static extractLocationContext(description: string): string[] {
    const locations: string[] = [];
    
    const locationPatterns = [
      { pattern: /\bbelow\s+ground/i, location: 'below_ground' },
      { pattern: /\babove\s+ground/i, location: 'above_ground' },
      { pattern: /\bunderground/i, location: 'underground' },
      { pattern: /\bbasement/i, location: 'basement' },
      { pattern: /\bfoundation/i, location: 'foundation' },
      { pattern: /\bplinth/i, location: 'plinth' },
      { pattern: /\bsuperstructure/i, location: 'superstructure' },
      { pattern: /\broof/i, location: 'roof' },
      { pattern: /\bterrace/i, location: 'terrace' },
      { pattern: /\bexternal/i, location: 'external' },
      { pattern: /\binternal/i, location: 'internal' },
      { pattern: /\btoilet|bathroom|wc/i, location: 'wet_area' },
      { pattern: /\bkitchen/i, location: 'kitchen' }
    ];

    for (const { pattern, location } of locationPatterns) {
      if (pattern.test(description)) {
        locations.push(location);
      }
    }

    return locations;
  }
}
