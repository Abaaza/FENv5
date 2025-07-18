import { getConvexClient } from './dist/config/convex.js';
import { api } from '../convex/_generated/api.js';

async function testDirectInsert() {
  console.log('=== TESTING DIRECT INSERT ===\n');
  
  const convex = getConvexClient();
  
  try {
    // Test data that should work with the current fix
    const testData = {
      jobId: 'j97dkah2k5zpfmycfkva233zr17jyzr9',
      rowNumber: 999,
      originalDescription: 'TEST - Direct Insert',
      originalQuantity: 10,
      originalUnit: 'pcs',
      originalRowData: {},
      matchedItemId: undefined,
      matchedDescription: 'Test Item',
      matchedCode: 'TEST001',
      matchedUnit: 'pcs',
      matchedRate: 100,
      confidence: 0.95,
      matchMethod: 'TEST',
      totalPrice: 1000,
      notes: 'Test note',
    };
    
    console.log('Inserting test match result...');
    
    try {
      const result = await convex.mutation(api.priceMatching.createMatchResult, testData);
      console.log('✅ SUCCESS: Match result saved!');
      console.log('Result:', result);
    } catch (error) {
      console.log('❌ FAILED:', error.message);
    }
    
  } catch (error) {
    console.error('Error during testing:', error);
  }
  
  console.log('\n=== TEST COMPLETE ===');
  process.exit(0);
}

testDirectInsert().catch(console.error);