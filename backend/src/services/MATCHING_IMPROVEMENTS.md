# Matching Service Improvements

## Overview
This document describes the improvements made to the matching service to better utilize context headers and improve unit matching accuracy.

## Key Improvements

### 1. Enhanced Context Awareness
- **Context Headers Integration**: All matching methods (LOCAL, COHERE, OPENAI) now properly utilize context headers extracted from Excel files
- **Full Context Path**: Uses the complete context hierarchy (e.g., "D Groundwork > D20 Excavating and filling > Excavating") instead of just the first header
- **Category Matching**: Improved category matching logic that compares context headers against price item categories with fuzzy matching

### 2. Improved Unit Matching
- **Unit Compatibility Groups**: Recognizes equivalent units that are commonly used interchangeably:
  - Linear: M, M1, LM, RM, RMT
  - Area: M2, SQM, SQ.M
  - Volume: M3, CUM, CU.M
  - Count: NO, NR, ITEM, EACH, EA, PC, PCS, UNIT
  - Weight: KG (separate from TON, MT)
  - And more...

- **Compatibility Scoring**: Units are checked for compatibility, not just exact matches
- **Boost Logic**: Compatible units receive a significant confidence boost

### 3. Enhanced Scoring Algorithm
- **Multi-Factor Scoring**: LOCAL method now uses weighted scoring across multiple factors:
  - Description fuzzy match: 40% weight
  - Unit compatibility: Up to 25 points bonus
  - Category match: Up to 20 points bonus  
  - Keyword matches: Up to 15 points bonus
  - Context keywords: Up to 10 points bonus

- **Semantic Matching Enhancement**: COHERE and OPENAI methods now:
  - Include full context in embeddings
  - Boost scores for unit compatibility
  - Adjust final confidence based on unit matches

### 4. Enriched Text Generation
- **Context Integration**: The `createEnrichedText` method now accepts context headers
- **Better Embeddings**: AI methods generate embeddings that include category context for improved semantic understanding

## Usage Example

```typescript
// Item with context headers from Excel parsing
const result = await matchingService.matchItem(
  'maximum depth not exceeding 2.00m',
  'LOCAL',
  undefined,
  ['D Groundwork', 'D20 Excavating and filling', 'Excavating', 'Basements and the like']
);

// Result will have higher confidence if matched item:
// - Has similar category (e.g., "Excavation" or "Groundwork")
// - Has compatible unit (e.g., M3, CUM)
// - Contains relevant keywords from context
```

## Benefits
1. **Better Category Matching**: Items are matched within their correct category context
2. **Reduced Unit Mismatches**: Compatible units are recognized (e.g., M3 matches CUM)
3. **Higher Accuracy**: Multi-factor scoring provides more nuanced matching
4. **Improved Confidence Scores**: Scores better reflect actual match quality

## Technical Details

### Unit Compatibility Matrix
The system recognizes these unit equivalencies:
- **Length**: M ≈ M1 ≈ LM ≈ RM ≈ RMT
- **Area**: M2 ≈ SQM ≈ SQ.M
- **Volume**: M3 ≈ CUM ≈ CU.M
- **Count**: NO ≈ NR ≈ ITEM ≈ EACH ≈ EA
- **Weight**: TON ≈ MT (metric ton, not meter)

### Scoring Breakdown Example
For a LOCAL match:
```
Total Score = (Fuzzy Description Match × 0.4) + Unit Bonus + Category Bonus + Keyword Bonus + Context Bonus

Example:
- Fuzzy match: 70% × 0.4 = 28 points
- Unit compatible: +20 points
- Category match (>80%): +15 points  
- Keywords match: +9 points (3 keywords × 3)
- Context keywords: +4 points (2 keywords × 2)
Total: 76% confidence
```

## Future Enhancements
1. Machine learning to adjust weights based on successful matches
2. Industry-specific unit conversions (e.g., construction vs manufacturing)
3. Multi-language support for international projects
4. Custom unit mapping configuration per project