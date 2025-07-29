require('dotenv').config({ path: './.env' });
const { MatchingService } = require('./dist/services/matching.service');
const { getConvexClient } = require('./dist/config/convex');
const { api } = require('./dist/lib/convex-api');

async function testMatching() {
  try {
    const convex = getConvexClient();
    const matchingService = MatchingService.getInstance();
    
    console.log('=== TESTING IMPROVED MATCHING LOGIC ===\n');
    
    // Test cases from your recent job
    const testCases = [
      { description: 'Footbridges', unit: 'No.' },
      { description: '4ft D9 Gates', unit: 'No.' },
      { description: '2.4m high palisade fence with galv posts', unit: 'm' },
      { description: 'Steel wire mesh 50mm x 50mm', unit: 'm2' },
      { description: 'Concrete post 2.4m high', unit: 'Unit' }
    ];
    
    for (const testCase of testCases) {
      console.log(`\nTesting: "${testCase.description}" (${testCase.unit})`);
      console.log('-'.repeat(60));
      
      const result = await matchingService.matchItem(
        testCase.description,
        'LOCAL'
      );
      
      console.log(`Matched: ${result.matchedDescription}`);
      console.log(`Unit: ${result.matchedUnit}`);
      console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      console.log(`Method: ${result.method}`);
    }
    
  } catch (error) {
    console.error('Error testing matching:', error);
  }
}

testMatching();