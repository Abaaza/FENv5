const fs = require('fs');
const path = require('path');

const filesToUpdate = [
    'src/controllers/priceList.controller.ts',
    'src/controllers/projects.controller.ts', 
    'src/services/jobPolling.service.ts',
    'src/utils/convexId.ts'
];

filesToUpdate.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace Id imports
    content = content.replace(
        /import { Id } from ['"]\.\.\/\.\.\/\.\.\/convex\/_generated\/dataModel['"]/g,
        "import { Id } from '../lib/convex-api'"
    );
    
    // Replace TableNames imports
    content = content.replace(
        /import { TableNames } from ['"]\.\.\/\.\.\/\.\.\/convex\/_generated\/dataModel['"]/g,
        "import type { TableNames } from '../convex-generated/dataModel'"
    );
    
    fs.writeFileSync(file, content);
    console.log(`Updated: ${file}`);
});

console.log('All imports updated!');