import { getConvexClient } from './dist/config/convex.js';
import { api } from '../convex/_generated/api.js';

async function testWorkingInsert() {
  console.log('=== TESTING WORKING INSERT ===\n');
  
  const convex = getConvexClient();
  
  try {
    // Test data WITHOUT isManuallyEdited in args
    // But the mutation will add it with default value
    const testData = {
      jobId: 'j97dkah2k5zpfmycfkva233zr17jyzr9',
      rowNumber: 999,
      originalDescription: 'TEST - Working Insert',
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
      // Do NOT include isManuallyEdited here
    };
    
    console.log('Inserting test match result (without isManuallyEdited in args)...');
    
    try {
      const result = await convex.mutation(api.priceMatching.createMatchResult, testData);
      console.log('✅ SUCCESS: Match result saved!');
      console.log('Result:', result);
      
      // Now query to verify it was saved
      const results = await convex.query(api.priceMatching.getMatchResults, {
        jobId: 'j97dkah2k5zpfmycfkva233zr17jyzr9'
      });
      console.log('\nQueried results:', results.length, 'found');
      const ourResult = results.find(r => r.rowNumber === 999);
      if (ourResult) {
        console.log('Our test result:', {
          rowNumber: ourResult.rowNumber,
          description: ourResult.originalDescription,
          isManuallyEdited: ourResult.isManuallyEdited
        });
      }
    } catch (error) {
      console.log('❌ FAILED:', error.message);
    }
    
  } catch (error) {
    console.error('Error during testing:', error);
  }
  
  console.log('\n=== TEST COMPLETE ===');
  process.exit(0);
}

testWorkingInsert().catch(console.error);