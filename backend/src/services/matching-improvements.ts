// Enhanced matching logic to treat category + subcategory as a combined unit

// Note: This file contains code snippets for improving the matching logic.
// These are examples to be integrated into your existing matching service.
// You'll need to import the required dependencies like:
// import * as fuzz from 'fuzzball';

// Type definition for PriceItem (adjust based on your actual interface)
interface PriceItem {
  description: string;
  category?: string;
  subcategory?: string;
  unit?: string;
  keywords?: string[];
  code?: string;
}

// ========================================================================
// CODE SNIPPET 1: For LOCAL method
// Replace the category matching section (lines 361-387) with:
// ========================================================================
/*
// Enhanced category + subcategory matching as a combined unit
if (contextHeaders && contextHeaders.length > 0) {
  let categoryScore = 0;
  
  // Extract potential category and subcategory from context headers
  // Usually: contextHeaders = ["Groundworks", "Excavation", "Deep excavation"]
  const potentialCategory = contextHeaders[0]?.toLowerCase() || '';
  const potentialSubcategory = contextHeaders[1]?.toLowerCase() || '';
  
  // Check for exact category + subcategory match (highest priority)
  if (item.category && item.subcategory) {
    const itemCategory = item.category.toLowerCase();
    const itemSubcategory = item.subcategory.toLowerCase();
    
    // Exact category + subcategory match = maximum bonus
    if (potentialCategory && potentialSubcategory &&
        fuzz.ratio(potentialCategory, itemCategory) > 85 &&
        fuzz.ratio(potentialSubcategory, itemSubcategory) > 85) {
      categoryScore = 30; // Significant boost for exact category+subcategory match
    }
    // Category matches but different subcategory
    else if (potentialCategory && fuzz.ratio(potentialCategory, itemCategory) > 85) {
      categoryScore = 15; // Medium boost for category-only match
      
      // Check if any context header matches subcategory
      const subcategoryMatches = contextHeaders.map(header => 
        fuzz.partial_ratio(header.toLowerCase(), itemSubcategory)
      );
      if (Math.max(...subcategoryMatches) > 70) {
        categoryScore += 10; // Additional boost if subcategory found in context
      }
    }
    // Subcategory matches but different category (less common but possible)
    else if (potentialSubcategory && fuzz.ratio(potentialSubcategory, itemSubcategory) > 85) {
      categoryScore = 10;
    }
  }
  // Fallback to category-only matching if no subcategory
  else if (item.category && potentialCategory) {
    const itemCategory = item.category.toLowerCase();
    if (fuzz.ratio(potentialCategory, itemCategory) > 85) {
      categoryScore = 20;
    }
  }
  
  scoreBreakdown.category = categoryScore;
}
*/

// ========================================================================
// CODE SNIPPET 2: For COHERE method
// Add this after line 469 in cohereMatch method:
// ========================================================================
/*
// Extract category/subcategory from context for stronger matching
let categoryContext = '';
if (contextHeaders && contextHeaders.length > 0) {
  const potentialCategory = contextHeaders[0] || '';
  const potentialSubcategory = contextHeaders[1] || '';
  categoryContext = `Target Category: ${potentialCategory}. Target Subcategory: ${potentialSubcategory}.`;
}

// Update enrichedQuery to include category context
enrichedQuery = `${categoryContext} ${enrichedQuery}`;
*/

// ========================================================================
// HELPER FUNCTION 1: Create enriched text for price items
// Use this when creating enriched text in the createEnrichedText method
// ========================================================================
function createEnrichedText(item: PriceItem, contextHeaders?: string[]): string {
  const parts = [item.description];
  
  // Add context headers if provided
  if (contextHeaders && contextHeaders.length > 0) {
    parts.push(`Context: ${contextHeaders.join(' > ')}`);
  }
  
  // Emphasize category + subcategory combination for better matching
  if (item.category && item.subcategory) {
    // Repeat the combination for stronger embedding signal
    parts.push(`Category: ${item.category} - ${item.subcategory}`);
    parts.push(`Classification: ${item.category} ${item.subcategory}`);
  } else if (item.category) {
    parts.push(`Category: ${item.category}`);
  }
  
  if (item.unit) {
    parts.push(`Unit: ${item.unit}`);
  }
  
  if (item.keywords && item.keywords.length > 0) {
    parts.push(`Keywords: ${item.keywords.join(', ')}`);
  }
  
  if (item.code) {
    parts.push(`Code: ${item.code}`);
  }
  
  return parts.join(' | ');
}

// ========================================================================
// CODE SNIPPET 3: Post-processing for COHERE/OPENAI methods
// Add this scoring adjustment after calculating similarities:
// ========================================================================
/*
// Boost score for category+subcategory match
if (contextHeaders && contextHeaders.length >= 2) {
  const targetCategory = contextHeaders[0]?.toLowerCase() || '';
  const targetSubcategory = contextHeaders[1]?.toLowerCase() || '';
  
  scoredMatches.forEach(match => {
    const itemCategory = match.item.category?.toLowerCase() || '';
    const itemSubcategory = match.item.subcategory?.toLowerCase() || '';
    
    // Strong boost for exact category+subcategory match
    if (targetCategory && targetSubcategory &&
        itemCategory.includes(targetCategory) && 
        itemSubcategory.includes(targetSubcategory)) {
      match.similarity = Math.min(0.99, match.similarity * 1.3); // 30% boost
    }
    // Medium boost for category-only match
    else if (targetCategory && itemCategory.includes(targetCategory)) {
      match.similarity = Math.min(0.95, match.similarity * 1.15); // 15% boost
    }
  });
}
*/

// ========================================================================
// HELPER FUNCTION 2: Extract category/subcategory from BOQ description
// ========================================================================
function extractCategoryFromDescription(description: string): { category?: string, subcategory?: string } {
  const patterns = {
    groundworks: ['excavation', 'earthwork', 'filling', 'disposal', 'dewatering'],
    rcWorks: ['concrete', 'reinforcement', 'formwork', 'slab', 'column', 'beam'],
    drainage: ['pipe', 'drain', 'sewer', 'manhole', 'gully', 'channel'],
    services: ['electrical', 'plumbing', 'hvac', 'cable', 'conduit', 'duct'],
    externalWorks: ['road', 'pavement', 'kerb', 'paving', 'landscape', 'fence'],
    underpinning: ['underpin', 'needle', 'pit', 'support', 'foundation']
  };
  
  const descLower = description.toLowerCase();
  
  for (const [category, keywords] of Object.entries(patterns)) {
    for (const keyword of keywords) {
      if (descLower.includes(keyword)) {
        return { 
          category: category.replace(/([A-Z])/g, ' $1').trim(),
          subcategory: keyword.charAt(0).toUpperCase() + keyword.slice(1)
        };
      }
    }
  }
  
  return {};
}

// Export the helper functions for use in other modules
export { createEnrichedText, extractCategoryFromDescription };
export type { PriceItem };

