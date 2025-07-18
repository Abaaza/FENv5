/**
 * Utility to extract embedded headers from description cells
 */

export interface ExtractedHeaders {
  headers: string[];
  actualDescription: string;
}

/**
 * Patterns that indicate a line is likely a header/category
 */
const HEADER_PATTERNS = [
  // Major categories (often in bold or underlined in Excel)
  /^[A-Z][A-Z0-9\s&]+$/,  // All caps lines like "EARTHWORKS"
  /^[A-Z]\d+\s+[A-Z]/,    // Code patterns like "D20 Excavating"
  /^[A-Z][a-z]+;/,        // Semicolon patterns like "Basement; reduced level"
  /^[A-Z][a-z]+\s+and\s+the\s+like[;:]?/i,  // "Basements and the like"
  /^(Bill|Section|Part|Division|Category|Group)\s+/i,
  /^(Excavating|Filling|Disposal|Earthwork|Groundwork|Substructure|Superstructure)s?\b/i,
  /\s+(commencing|at|from|to)\s+level\s+[\d.]+m/i,  // Level specifications
];

/**
 * Patterns that indicate actual work items (not headers)
 */
const ITEM_PATTERNS = [
  /^(maximum|minimum|average)\s+(depth|width|length|thickness)/i,
  /^(not\s+)?exceeding\s+\d/i,
  /^\d+\.?\d*\s*m\s/,  // Starts with measurement
  /^(extra\s+over|items?\s+extra)/i,
  /^(breaking\s+out|excavating|filling|disposing)/i,
];

/**
 * Extract embedded headers from a description that contains multiple lines
 */
export function extractEmbeddedHeaders(description: string): ExtractedHeaders {
  if (!description || typeof description !== 'string') {
    return { headers: [], actualDescription: description || '' };
  }

  // Split by newlines, handling different line ending formats
  const lines = description.split(/\r?\n/).map(line => line.trim()).filter(line => line);
  
  if (lines.length <= 1) {
    // Single line, no embedded headers
    return { headers: [], actualDescription: description };
  }

  const headers: string[] = [];
  let actualDescriptionIndex = -1;

  // Process each line to determine if it's a header or the actual description
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this line matches item patterns (actual work description)
    const isItem = ITEM_PATTERNS.some(pattern => pattern.test(line));
    
    if (isItem) {
      // Found the actual item description
      actualDescriptionIndex = i;
      break;
    }
    
    // Check if this line matches header patterns
    const isHeader = HEADER_PATTERNS.some(pattern => pattern.test(line));
    
    if (isHeader || i < lines.length - 1) {
      // This is likely a header (or we haven't found the item yet)
      headers.push(line);
    } else {
      // Last line and no item pattern match - this is probably the item
      actualDescriptionIndex = i;
      break;
    }
  }

  // If we didn't find a clear item line, assume the last line is the item
  if (actualDescriptionIndex === -1) {
    actualDescriptionIndex = lines.length - 1;
    // Move the last header back to headers if needed
    if (headers.length === lines.length) {
      headers.pop();
    }
  }

  // Join remaining lines as the actual description
  const actualDescription = lines.slice(actualDescriptionIndex).join('\n');

  return {
    headers,
    actualDescription
  };
}

/**
 * Check if a description line is likely a standalone header
 */
export function isLikelyStandaloneHeader(description: string): boolean {
  if (!description || typeof description !== 'string') {
    return false;
  }

  const trimmed = description.trim();
  
  // Check against header patterns
  const matchesHeaderPattern = HEADER_PATTERNS.some(pattern => pattern.test(trimmed));
  
  // Check it doesn't match item patterns
  const matchesItemPattern = ITEM_PATTERNS.some(pattern => pattern.test(trimmed));
  
  // Additional checks for standalone headers
  const isShortCaps = /^[A-Z\s&]+$/.test(trimmed) && trimmed.length < 50;
  const hasNoQuantityIndicators = !/(^\d+\.?\d*\s*(m|m2|m3|nr|item|kg|ton)\b)/i.test(trimmed);
  
  return (matchesHeaderPattern || isShortCaps) && !matchesItemPattern && hasNoQuantityIndicators;
}
