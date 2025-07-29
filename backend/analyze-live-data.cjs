require('dotenv').config({ path: './.env' });
const { getConvexClient } = require('./dist/config/convex');
const { api } = require('./dist/lib/convex-api');

async function analyzeLiveData() {
  try {
    const convex = getConvexClient();
    
    console.log('=== ANALYZING LIVE PRICE LIST DATA ===\n');
    
    // Get price items
    const priceItems = await convex.query(api.priceItems.getActive);
    console.log(`Total active price items: ${priceItems.length}`);
    
    // Analyze price list structure
    console.log('\n--- Sample Price Items ---');
    priceItems.slice(0, 5).forEach((item, index) => {
      console.log(`\nItem ${index + 1}:`);
      console.log(`  ID: ${item.id}`);
      console.log(`  Name: ${item.name || 'N/A'}`);
      console.log(`  Variant: ${item.product_template_variant_value_ids || 'N/A'}`);
      console.log(`  Cost: ${item.operation_cost || item.rate || 0}`);
      console.log(`  Unit: ${item.uom_id || item.unit || 'N/A'}`);
    });
    
    // Analyze units distribution
    console.log('\n--- Unit Distribution ---');
    const unitCounts = {};
    priceItems.forEach(item => {
      const unit = item.uom_id || item.unit || 'NO_UNIT';
      unitCounts[unit] = (unitCounts[unit] || 0) + 1;
    });
    
    Object.entries(unitCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([unit, count]) => {
        console.log(`  ${unit}: ${count} items (${((count/priceItems.length)*100).toFixed(1)}%)`);
      });
    
    // Analyze name patterns
    console.log('\n--- Common Name Patterns ---');
    const namePatterns = {};
    priceItems.forEach(item => {
      const name = item.name || item.description || '';
      const words = name.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      words.forEach(word => {
        namePatterns[word] = (namePatterns[word] || 0) + 1;
      });
    });
    
    console.log('Most common words in names:');
    Object.entries(namePatterns)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .forEach(([word, count]) => {
        if (count > 5) console.log(`  "${word}": ${count} occurrences`);
      });
    
    // Get recent jobs
    console.log('\n\n=== ANALYZING RECENT MATCHING JOBS ===\n');
    const recentJobs = await convex.query(api.priceMatching.getAllJobs);
    
    console.log(`Found ${recentJobs.length} recent jobs`);
    
    // Analyze a recent job's results
    if (recentJobs.length > 0) {
      const recentJob = recentJobs[0];
      console.log(`\nAnalyzing most recent job: ${recentJob._id}`);
      console.log(`  Status: ${recentJob.status}`);
      console.log(`  Method: ${recentJob.matchingMethod}`);
      console.log(`  Items: ${recentJob.itemCount}`);
      
      // Get match results
      const results = await convex.query(api.priceMatching.getMatchResults, {
        jobId: recentJob._id
      });
      
      if (results && results.length > 0) {
        // Analyze confidence distribution
        const confidenceRanges = {
          high: 0,    // > 0.8
          medium: 0,  // 0.5 - 0.8
          low: 0      // < 0.5
        };
        
        let totalConfidence = 0;
        const sampleMismatches = [];
        
        results.forEach(result => {
          if (result.matchMethod !== 'CONTEXT') {
            const conf = result.confidence || 0;
            totalConfidence += conf;
            
            if (conf > 0.8) confidenceRanges.high++;
            else if (conf > 0.5) confidenceRanges.medium++;
            else {
              confidenceRanges.low++;
              // Collect low confidence examples
              if (sampleMismatches.length < 5) {
                sampleMismatches.push({
                  boq: result.originalDescription,
                  matched: result.matchedDescription,
                  confidence: conf,
                  unit: result.originalUnit,
                  matchedUnit: result.matchedUnit
                });
              }
            }
          }
        });
        
        const itemsWithQuantity = results.filter(r => r.matchMethod !== 'CONTEXT').length;
        console.log(`\n--- Confidence Distribution ---`);
        console.log(`  High (>80%): ${confidenceRanges.high} (${((confidenceRanges.high/itemsWithQuantity)*100).toFixed(1)}%)`);
        console.log(`  Medium (50-80%): ${confidenceRanges.medium} (${((confidenceRanges.medium/itemsWithQuantity)*100).toFixed(1)}%)`);
        console.log(`  Low (<50%): ${confidenceRanges.low} (${((confidenceRanges.low/itemsWithQuantity)*100).toFixed(1)}%)`);
        console.log(`  Average confidence: ${(totalConfidence/itemsWithQuantity).toFixed(2)}`);
        
        console.log('\n--- Sample Low Confidence Matches ---');
        sampleMismatches.forEach((mismatch, index) => {
          console.log(`\nMismatch ${index + 1}:`);
          console.log(`  BOQ: "${mismatch.boq}"`);
          console.log(`  Matched: "${mismatch.matched}"`);
          console.log(`  Confidence: ${(mismatch.confidence * 100).toFixed(1)}%`);
          console.log(`  BOQ Unit: ${mismatch.unit || 'N/A'} vs Matched Unit: ${mismatch.matchedUnit || 'N/A'}`);
        });
      }
    }
    
  } catch (error) {
    console.error('Error analyzing data:', error);
  }
}

analyzeLiveData();