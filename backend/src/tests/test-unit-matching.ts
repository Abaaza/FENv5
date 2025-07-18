import { MatchingService } from '../services/matching.service';
import { getConvexClient } from '../config/convex';
import { api } from '../lib/convex-api';

/**
 * Test script to verify enhanced unit matching logic
 */
async function testUnitMatching() {
  console.log('\n=== UNIT MATCHING TEST ===\n');
  
  const convex = getConvexClient();
  const matchingService = MatchingService.getInstance();
  
  // Test cases with different unit variations
  const testCases = [
    {
      description: 'Excavation in ordinary soil M3',
      expectedUnit: 'M3',
      name: 'Excavation with M3'
    },
    {
      description: 'Excavation in ordinary soil CUM',
      expectedUnit: 'M3',
      name: 'Excavation with CUM (should match M3)'
    },
    {
      description: 'Excavation in ordinary soil cubic meter',
      expectedUnit: 'M3',
      name: 'Excavation with full unit name'
    },
    {
      description: 'Brickwork in cm 1:6 SQM',
      expectedUnit: 'M2',
      name: 'Brickwork with SQM'
    },
    {
      description: 'Brickwork in cm 1:6 sq.m',
      expectedUnit: 'M2', 
      name: 'Brickwork with sq.m (should match M2)'
    },
    {
      description: 'Steel reinforcement Fe500 KG',
      expectedUnit: 'KG',
      name: 'Steel with KG'
    },
    {
      description: 'Steel reinforcement Fe500 MT',
      expectedUnit: 'TON',
      name: 'Steel with MT (should match TON)'
    },
    {
      description: 'Supply of cement bags NO',
      expectedUnit: 'NO',
      name: 'Cement bags as numbers'
    },
    {
      description: 'Supply of cement bags EACH',
      expectedUnit: 'NO',
      name: 'Cement bags as EACH (should match NO)'
    }
  ];
  
  // Get price items for testing
  const priceItems = await convex.query(api.priceItems.getAll);
  console.log(`Total price items in database: ${priceItems.length}\n`);
  
  // Run tests
  for (const testCase of testCases) {
    console.log(`\nTest: ${testCase.name}`);
    console.log(`Input: "${testCase.description}"`);
    console.log(`Expected unit type: ${testCase.expectedUnit}`);
    
    try {
      const result = await matchingService.matchItem(
        testCase.description,
        'LOCAL',
        priceItems
      );
      
      console.log(`\nMatched: ${result.matchedDescription}`);
      console.log(`Matched Unit: ${result.matchedUnit}`);
      console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      console.log(`Unit Score: ${result.matchingDetails?.scores?.unit || 0}pts`);
      console.log(`Reasoning: ${result.matchingDetails?.reasoning}`);
      
      // Check if unit matches expectation
      const matchedUnitNormalized = result.matchedUnit?.toUpperCase();
      const isUnitMatch = matchedUnitNormalized === testCase.expectedUnit ||
                         (testCase.expectedUnit === 'M3' && ['M3', 'CUM', 'CUBIC METER'].includes(matchedUnitNormalized || '')) ||
                         (testCase.expectedUnit === 'M2' && ['M2', 'SQM', 'SQUARE METER'].includes(matchedUnitNormalized || '')) ||
                         (testCase.expectedUnit === 'TON' && ['TON', 'MT', 'METRIC TON'].includes(matchedUnitNormalized || '')) ||
                         (testCase.expectedUnit === 'NO' && ['NO', 'NOS', 'EACH', 'EA', 'ITEM'].includes(matchedUnitNormalized || ''));
      
      console.log(`Unit Match: ${isUnitMatch ? '✓ PASS' : '✗ FAIL'}`);
      
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
    }
    
    console.log('\n' + '-'.repeat(50));
  }
  
  // Test unit boost effect
  console.log('\n\n=== UNIT BOOST COMPARISON TEST ===\n');
  
  const comparisonTest = 'Providing and laying concrete M20 grade';
  console.log(`Testing: "${comparisonTest}"`);
  
  // Get top 5 matches to see unit boost effect
  const topMatches = await matchingService.getTopMatches(
    comparisonTest,
    'LOCAL',
    priceItems,
    5
  );
  
  console.log('\nTop 5 matches:');
  topMatches.forEach((match, index) => {
    console.log(`\n${index + 1}. ${match.matchedDescription}`);
    console.log(`   Unit: ${match.matchedUnit || 'N/A'}`);
    console.log(`   Confidence: ${(match.confidence * 100).toFixed(1)}%`);
    console.log(`   Unit Score: ${match.matchingDetails?.scores?.unit || 0}pts`);
  });
  
  console.log('\n=== TEST COMPLETE ===\n');
}

// Run the test
testUnitMatching().catch(console.error);