import { MatchingService } from '../services/matching.service';

async function testImprovedMatching() {
  console.log('\n=== TESTING IMPROVED MATCHING WITH CONTEXT ===\n');
  
  const matchingService = MatchingService.getInstance();
  
  // Test cases with context headers
  const testCases = [
    {
      description: 'maximum depth not exceeding 2.00m',
      unit: 'm3',
      contextHeaders: ['D Groundwork', 'D20 Excavating and filling', 'Excavating', 'Basements and the like']
    },
    {
      description: 'reinforced concrete',
      unit: 'ITEM',
      contextHeaders: ['Breaking out existing materials']
    },
    {
      description: 'excavating below ground water level',
      unit: 'ITEM',
      contextHeaders: ['Items extra over excavating']
    },
    {
      description: '500mm diameter piles',
      unit: 'nr',
      contextHeaders: ['Piling', 'Bored piles']
    }
  ];
  
  console.log('Testing LOCAL matching with context awareness...\n');
  
  for (const testCase of testCases) {
    console.log(`Test: "${testCase.description}" (${testCase.unit})`);
    console.log(`Context: ${testCase.contextHeaders.join(' > ')}`);
    
    try {
      const result = await matchingService.matchItem(
        testCase.description,
        'LOCAL',
        undefined,
        testCase.contextHeaders
      );
      
      console.log(`âœ“ Matched: "${result.matchedDescription}"`);
      console.log(`  Unit: ${result.matchedUnit} (Input: ${testCase.unit})`);
      console.log(`  Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      if (result.matchingDetails) {
        console.log(`  Scores:`, result.matchingDetails.scores);
        console.log(`  Reasoning: ${result.matchingDetails.reasoning}`);
      }
    } catch (error) {
      console.error(`âœ— Error:`, error);
    }
    
    console.log();
  }
  
  // Test unit compatibility
  console.log('\n=== TESTING UNIT COMPATIBILITY ===\n');
  
  const unitTests = [
    { unit1: 'M', unit2: 'M1', expected: true },
    { unit1: 'M', unit2: 'LM', expected: true },
    { unit1: 'M2', unit2: 'SQM', expected: true },
    { unit1: 'M3', unit2: 'CUM', expected: true },
    { unit1: 'NO', unit2: 'NR', expected: true },
    { unit1: 'ITEM', unit2: 'NR', expected: true },
    { unit1: 'M', unit2: 'M2', expected: false },
    { unit1: 'KG', unit2: 'TON', expected: false }
  ];
  
  // Access private method through reflection for testing
  const matchingServiceAny = matchingService as any;
  
  for (const test of unitTests) {
    const result = matchingServiceAny.areUnitsCompatible(test.unit1, test.unit2);
    const status = result === test.expected ? 'âœ“' : 'âœ—';
    console.log(`${status} ${test.unit1} <-> ${test.unit2}: ${result} (expected: ${test.expected})`);
  }
}

testImprovedMatching().catch(console.error);
