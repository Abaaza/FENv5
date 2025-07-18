export interface MatchingThresholds {
  minConfidence: {
    local: number;
    cohere: number;
    openai: number;
    default: number;
  };
  unitMatchBonus: number;
  categoryMatchBonus: number;
  contextMatchBonus: number;
  codeMatchScore: number;
  exactMatchScore: number;
}

export interface MatchingWeights {
  local: number;
  cohere: number;
  openai: number;
}

export interface MatchingConfig {
  thresholds: MatchingThresholds;
  weights: MatchingWeights;
  caching: {
    enabled: boolean;
    ttl: number; // seconds
    maxSize: number;
  };
  embedding: {
    maxCacheSize: number;
    batchSize: {
      cohere: number;
      openai: number;
    };
  };
  retry: {
    maxAttempts: number;
    delayMs: number;
    backoffMultiplier: number;
  };
  performance: {
    maxItemsPerJob: number;
    maxConcurrentMatches: number;
    itemProcessingTimeout: number;
    batchProcessingDelay: number;
    adaptiveBatchSize: boolean;
    minBatchSize: number;
    maxBatchSize: number;
    enableDetailedLogging: boolean;
  };
  limits: {
    maxReturnedMatches: number;
    maxContextHeaders: number;
    maxDescriptionLength: number;
  };
}

// Default configuration
export const defaultMatchingConfig: MatchingConfig = {
  thresholds: {
    minConfidence: {
      local: 0.1,  // Lowered from 0.6 to return even low confidence matches
      cohere: 0.1,  // Lowered from 0.5
      openai: 0.1,  // Lowered from 0.5
      default: 0.1  // Lowered from 0.5
    },
    unitMatchBonus: 25,  // Increased from 20 to give more weight to unit matching
    categoryMatchBonus: 20,  // Increased from 15 - more weight for category matches
    contextMatchBonus: 10,  // Increased from 5 - more weight for context
    codeMatchScore: 95,
    exactMatchScore: 100
  },
  weights: {
    local: 0.7,
    cohere: 1.0,
    openai: 1.0
  },
  caching: {
    enabled: true,
    ttl: 3600, // 1 hour
    maxSize: 10000
  },
  embedding: {
    maxCacheSize: 10000,
    batchSize: {
      cohere: 96,
      openai: 100
    }
  },
  retry: {
    maxAttempts: 3,
    delayMs: 1000,
    backoffMultiplier: 2
  },
  performance: {
    maxItemsPerJob: 10000,
    maxConcurrentMatches: 10,
    itemProcessingTimeout: 5000,
    batchProcessingDelay: 100,
    adaptiveBatchSize: true,
    minBatchSize: 5,
    maxBatchSize: 20,
    enableDetailedLogging: true
  },
  limits: {
    maxReturnedMatches: 5,
    maxContextHeaders: 10,
    maxDescriptionLength: 500
  }
};

// Environment-based overrides
export function getMatchingConfig(): MatchingConfig {
  const config = { ...defaultMatchingConfig };
  
  // Override from environment variables if available
  if (process.env.MATCHING_MIN_CONFIDENCE) {
    const minConf = parseFloat(process.env.MATCHING_MIN_CONFIDENCE);
    Object.keys(config.thresholds.minConfidence).forEach(key => {
      config.thresholds.minConfidence[key as keyof typeof config.thresholds.minConfidence] = minConf;
    });
  }
  
  if (process.env.MATCHING_CACHE_ENABLED) {
    config.caching.enabled = process.env.MATCHING_CACHE_ENABLED === 'true';
  }
  
  if (process.env.MATCHING_CACHE_TTL) {
    config.caching.ttl = parseInt(process.env.MATCHING_CACHE_TTL, 10);
  }
  
  return config;
}

// Validation function
export function validateConfig(config: Partial<MatchingConfig>): boolean {
  if (config.thresholds) {
    const { minConfidence } = config.thresholds;
    if (minConfidence) {
      for (const [key, value] of Object.entries(minConfidence)) {
        if (value < 0 || value > 1) {
          throw new Error(`Invalid confidence threshold for ${key}: ${value}. Must be between 0 and 1.`);
        }
      }
    }
  }
  
  if (config.weights) {
    for (const [key, value] of Object.entries(config.weights)) {
      if (value < 0 || value > 2) {
        throw new Error(`Invalid weight for ${key}: ${value}. Must be between 0 and 2.`);
      }
    }
  }
  
  if (config.caching) {
    if (config.caching.ttl && config.caching.ttl < 0) {
      throw new Error('Cache TTL must be positive');
    }
    if (config.caching.maxSize && config.caching.maxSize < 100) {
      throw new Error('Cache max size must be at least 100');
    }
  }
  
  return true;
}
