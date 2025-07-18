const fs = require('fs');
const path = require('path');

console.log('Preparing Lambda deployment...');

// Clean up large files that shouldn't be deployed
const filesToDelete = [
    'lambda-deploy',
    'min-deploy', 
    'deploy.tar.gz',
    'final-backend.zip',
    'complete-app.zip',
    'complete-app.tar.gz',
    'manual-deploy.tar.gz',
    'convex-auth.zip',
    'express-deploy.zip',
    'manual-deploy-code.tar.gz'
];

const jsonFilesToDelete = [
    'mjd_complete_pricelist.json',
    'mjd_optimized_pricelist.json',
    'mjd_pricelist_extracted.json',
    'mjd_pricelist_for_import.json',
    'mjd_pricelist_import_ready.json',
    'mjd_optimized_import.json',
    'mjd_consolidated_import.json'
];

const csvFilesToDelete = [
    'mjd_complete_pricelist.csv',
    'mjd_optimized_pricelist.csv',
    'mjd_pricelist_extracted.csv',
    'mjd_consolidated_pricelist.csv',
    'mjd_consolidated_pricelist_enhanced.csv'
];

// Delete files
[...filesToDelete, ...jsonFilesToDelete, ...csvFilesToDelete].forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        if (fs.lstatSync(filePath).isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true });
            console.log(`Deleted directory: ${file}`);
        } else {
            fs.unlinkSync(filePath);
            console.log(`Deleted file: ${file}`);
        }
    }
});

// Create minimal package.json for Lambda
const originalPackageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const lambdaPackageJson = {
    name: originalPackageJson.name,
    version: originalPackageJson.version,
    main: "dist/server.js",
    dependencies: {
        // Core dependencies only
        "serverless-http": originalPackageJson.dependencies["serverless-http"],
        "express": originalPackageJson.dependencies["express"],
        "cors": originalPackageJson.dependencies["cors"],
        "dotenv": originalPackageJson.dependencies["dotenv"],
        "convex": originalPackageJson.dependencies["convex"],
        "jsonwebtoken": originalPackageJson.dependencies["jsonwebtoken"],
        "bcryptjs": originalPackageJson.dependencies["bcryptjs"],
        "multer": originalPackageJson.dependencies["multer"],
        "exceljs": originalPackageJson.dependencies["exceljs"],
        "fuse.js": originalPackageJson.dependencies["fuse.js"],
        "lodash": originalPackageJson.dependencies["lodash"],
        "winston": originalPackageJson.dependencies["winston"],
        "uuid": originalPackageJson.dependencies["uuid"],
        "compression": originalPackageJson.dependencies["compression"],
        "helmet": originalPackageJson.dependencies["helmet"],
        "express-rate-limit": originalPackageJson.dependencies["express-rate-limit"],
        "lru-cache": originalPackageJson.dependencies["lru-cache"],
        "natural": originalPackageJson.dependencies["natural"],
        "string-similarity": originalPackageJson.dependencies["string-similarity"],
        "csv-parse": originalPackageJson.dependencies["csv-parse"],
        "csv-stringify": originalPackageJson.dependencies["csv-stringify"]
    }
};

// Save minimal package.json
fs.writeFileSync('package-lambda.json', JSON.stringify(lambdaPackageJson, null, 2));
console.log('Created minimal package-lambda.json');

console.log('\nLambda preparation complete!');
console.log('You can now run: serverless deploy');