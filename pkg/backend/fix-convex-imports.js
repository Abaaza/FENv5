const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all TypeScript files in src
const files = glob.sync('src/**/*.ts', { 
    ignore: ['src/convex-generated/**', 'src/lib/convex-api.ts'] 
});

console.log(`Found ${files.length} TypeScript files to check`);

let updatedCount = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    const originalContent = content;
    
    // Replace the import paths
    content = content.replace(
        /from ['"]\.\.\/\.\.\/\.\.\/convex\/_generated\/api['"]/g,
        "from '../lib/convex-api'"
    );
    
    // For files deeper in the structure
    content = content.replace(
        /from ['"]\.\.\/\.\.\/\.\.\/\.\.\/convex\/_generated\/api['"]/g,
        "from '../../lib/convex-api'"
    );
    
    // For files even deeper
    content = content.replace(
        /from ['"]\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/convex\/_generated\/api['"]/g,
        "from '../../../lib/convex-api'"
    );
    
    if (content !== originalContent) {
        fs.writeFileSync(file, content);
        console.log(`Updated: ${file}`);
        updatedCount++;
    }
});

console.log(`\nUpdated ${updatedCount} files`);
console.log('\nNow rebuild with: npx tsc -p tsconfig.lambda.json');