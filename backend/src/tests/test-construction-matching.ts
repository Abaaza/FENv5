import { MatchingService } from '../services/matching.service';
import { ConstructionPatternsService } from '../services/constructionPatterns.service';

async function testConstructionMatching() {
  console.log('\n=== TESTING CONSTRUCTION-SPECIFIC MATCHING ===\n');
  
  const matchingService = MatchingService.getInstance();
  
  // Test construction pattern extraction
  console.log('1. Testing Construction Pattern Extraction:\n');
  
  const testDescriptions = [
    'RCC M20 grade concrete in foundation',
    'TMT Fe500 steel reinforcement 12mm dia @ 150mm c/c',
    'Brick work in CM 1:6 in superstructure',
    'Excavating for basement below ground water level',
    'CPVC pipe 25mm dia for plumbing',
    'Cement plaster 12mm thk in 1:4 ratio',
    '600mm dia male secant pile at approx. 900mm c/c',
    'Waterproofing membrane 4mm thick APP modified'
  ];
  
  for (const desc of testDescriptions) {
    const features = ConstructionPatternsService.extractConstructionFeatures(desc);
    const expanded = ConstructionPatternsService.expandAbbreviations(desc);
    
    console.log(`Description: "${desc}"`);
    console.log(`Expanded: "${expanded}"`);
    console.log(`Features:`, features);
    console.log();
  }
  
  // Test matching with construction context
  console.log('\n2. Testing Matching with Construction Context:\n');
  
  const testCases = [
    {
      description: 'RCC slab M25 grade 150mm thick',
      unit: 'M3',
      contextHeaders: ['Concrete Work', 'Slabs']
    },
    {
      description: 'TMT steel Fe500 12mm dia',
      unit: 'KG',
      contextHeaders: ['Steel Reinforcement']
    },
    {
      description: 'excavation in ordinary soil 2-4m deep',
      unit: 'CUM',
      contextHeaders: ['Earthwork', 'Excavation']
    },
    {
      description: 'BW in CM 1:6 230mm thk',
      unit: 'M2',
      contextHeaders: ['Masonry', 'Brick Work']
    },
    {
      description: 'DPC 40mm thick',
      unit: 'SQM',
      contextHeaders: ['Waterproofing', 'Damp Proof Course']
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\nTest: "${testCase.description}" (${testCase.unit})`);
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
      }
    } catch (error) {
      console.error(`âœ— Error:`, error);
    }
  }
  
  // Test unit extraction and compatibility
  console.log('\n\n3. Testing Unit Extraction:\n');
  
  const unitTests = [
    'excavation 100 m3',
    'steel 500 kg',
    'concrete 25 cum',
    'tiles 100 sqm',
    'cement 50 bags',
    'sand 10 brass',
    'pipe 100 rmt',
    'paint 20 ltr',
    'bricks 1000 nos'
  ];
  
  const matchingServiceAny = matchingService as any;
  
  for (const test of unitTests) {
    const unit = matchingServiceAny.extractUnit(test);
    console.log(`"${test}" â†’ Unit: ${unit || 'Not found'}`);
  }
  
  // Test preprocessing
  console.log('\n\n4. Testing Description Preprocessing:\n');
  
  const preprocessTests = [
    "excavat ion for foundation",
    "M 20 grade concret",
    "10' x 20' slab",
    "12mm dia @ 150mm c/c",
    "brickwork in CM 1:6",
    "Fe 500 TMT steel"
  ];
  
  for (const test of preprocessTests) {
    const processed = matchingServiceAny.preprocessDescription(test);
    console.log(`"${test}" â†’ "${processed}"`);
  }
}

testConstructionMatching().catch(console.error);
