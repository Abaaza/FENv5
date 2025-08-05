const { ConvexClient } = require('convex/browser');
require('dotenv').config();

const CONVEX_URL = process.env.CONVEX_URL || 'https://lovely-armadillo-372.convex.cloud';
const client = new ConvexClient(CONVEX_URL);

async function runMigration() {
  try {
    console.log('🔍 Checking current data structure...\n');
    
    // Check migration status before
    const statusBefore = await client.mutation('migratePriceItems:checkMigrationStatus', {});
    console.log('Status before migration:');
    console.log(`Sample size: ${statusBefore.sampleSize}`);
    console.log('Missing fields:', statusBefore.missingFields);
    if (statusBefore.sampleItem) {
      console.log('\nSample item:');
      console.log('  Expected fields:');
      console.log(`    code: ${statusBefore.sampleItem.code}`);
      console.log(`    subcategory: ${statusBefore.sampleItem.subcategory}`);
      console.log(`    unit: ${statusBefore.sampleItem.unit}`);
      console.log(`    rate: ${statusBefore.sampleItem.rate}`);
      console.log('  Current fields:');
      console.log(`    id: ${statusBefore.sampleItem.id}`);
      console.log(`    product_template_variant_value_ids: ${statusBefore.sampleItem.product_template_variant_value_ids}`);
      console.log(`    uom_id: ${statusBefore.sampleItem.uom_id}`);
      console.log(`    operation_cost: ${statusBefore.sampleItem.operation_cost}`);
    }
    
    console.log('\n🚀 Running migration...\n');
    
    // Run the migration
    const result = await client.mutation('migratePriceItems:migrateFieldNames', {});
    
    console.log('✅ Migration complete!');
    console.log(result.message);
    
    // Check status after
    console.log('\n🔍 Checking data after migration...\n');
    const statusAfter = await client.mutation('migratePriceItems:checkMigrationStatus', {});
    console.log('Status after migration:');
    console.log(`Sample size: ${statusAfter.sampleSize}`);
    console.log('Missing fields:', statusAfter.missingFields);
    
    if (statusAfter.sampleItem) {
      console.log('\nSample item after migration:');
      console.log(`  code: ${statusAfter.sampleItem.code}`);
      console.log(`  subcategory: ${statusAfter.sampleItem.subcategory}`);
      console.log(`  unit: ${statusAfter.sampleItem.unit}`);
      console.log(`  rate: ${statusAfter.sampleItem.rate}`);
    }
    
    console.log('\n✨ Migration completed successfully!');
    console.log('The frontend should now display all fields correctly.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await client.close();
  }
}

runMigration();