const fs = require('fs');
const path = require('path');

// Files to clean up
const filesToClean = [
  './src/services/matching.service.ts',
  './src/services/excel.service.ts',
  './src/services/jobProcessor.service.ts',
  './src/controllers/priceMatching.controller.ts',
  './src/services/enhancedMatching.service.ts',
  './src/services/constructionPatterns.service.ts'
];

// Function to remove console.log statements
function removeConsoleLogs(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Remove console.log, console.warn, console.error statements
    // This regex matches console.log/warn/error statements including multiline ones
    const cleanedContent = content.replace(
      /console\.(log|warn|error|info|debug)\s*\([^)]*\)[^;]*;?/g, 
      '// Console log removed for performance'
    );
    
    // Also remove multiline console statements
    const finalContent = cleanedContent.replace(
      /console\.(log|warn|error|info|debug)\s*\([^)]*\)[^;]*;?\s*\n/gm,
      ''
    );
    
    fs.writeFileSync(filePath, finalContent, 'utf8');
    console.log(`✓ Cleaned ${filePath}`);
  } catch (error) {
    console.error(`✗ Error cleaning ${filePath}:`, error.message);
  }
}

// Clean all files
console.log('Removing console logs from performance-critical files...\n');
filesToClean.forEach(removeConsoleLogs);
console.log('\nDone! Console logs have been removed from performance-critical services.');