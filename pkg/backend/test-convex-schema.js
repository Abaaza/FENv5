import { getConvexClient } from './dist/config/convex.js';
import { api } from '../convex/_generated/api.js';

async function testSchema() {
  console.log('=== TESTING CONVEX SCHEMA ===\n');
  
  const convex = getConvexClient();
  
  try {
    // Create a minimal test result
    const testData = {
      jobId: 'j97dkah2k5zpfmycfkva233zr17jyzr9', // Use a recent job ID
      rowNumber: 999,
      originalDescription: 'TEST - Schema Check',
      confidence: 0.99,
      matchMethod: 'TEST',
    };
    
    console.log('Testing with minimal data (no isManuallyEdited):', testData);
    
    try {
      await convex.mutation(api.priceMatching.createMatchResult, testData);
      console.log('✓ SUCCESS: Created without isManuallyEdited field');
    } catch (error) {
      console.log('✗ FAILED without isManuallyEdited:', error.message);
      
      // Now try WITH isManuallyEdited
      console.log('\nTrying WITH isManuallyEdited...');
      const testDataWithField = { ...testData, isManuallyEdited: false };
      
      try {
        await convex.mutation(api.priceMatching.createMatchResult, testDataWithField);
        console.log('✓ SUCCESS: Created WITH isManuallyEdited field');
      } catch (error2) {
        console.log('✗ FAILED with isManuallyEdited:', error2.message);
      }
    }
    
  } catch (error) {
    console.error('Error during testing:', error);
  }
  
  console.log('\n=== TEST COMPLETE ===');
  process.exit(0);
}

testSchema().catch(console.error);