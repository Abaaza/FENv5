// Migration script to update price items to new schema
const { ConvexClient } = require('convex/browser');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const client = new ConvexClient(process.env.CONVEX_URL);

async function migrateSchema() {
  console.log('Starting schema migration...');
  
  try {
    // Get all price items
    const items = await client.query(({ db }) => 
      db.query('priceItems').collect()
    );
    
    console.log(`Found ${items.length} items to migrate`);
    
    let migrated = 0;
    let errors = 0;
    
    for (const item of items) {
      try {
        // Check if item already has new schema
        if (item.name && item.operation_cost !== undefined && item.uom_id) {
          console.log(`Item ${item.id} already migrated, skipping...`);
          continue;
        }
        
        // Migrate to new schema
        const updates = {
          // Map old fields to new fields
          name: item.description || item.name || 'Unknown Product',
          operation_cost: item.rate || item.operation_cost || 0,
          uom_id: item.unit || item.uom_id || 'Unit',
          
          // Keep optional fields
          product_template_variant_value_ids: item.product_template_variant_value_ids || 
            (item.material_size ? `size: ${item.material_size}` : ''),
          description: item.description || `${item.description || ''} ${item.remark || ''}`.trim(),
          
          // Keep category if exists
          category: item.category || 'General',
        };
        
        // Update the item
        await client.mutation(({ db }, { id, updates }) => {
          const item = db.get(id);
          if (item) {
            db.patch(id, updates);
          }
        }, { id: item._id, updates });
        
        migrated++;
        
        if (migrated % 10 === 0) {
          console.log(`Migrated ${migrated} items...`);
        }
      } catch (err) {
        console.error(`Error migrating item ${item.id}:`, err.message);
        errors++;
      }
    }
    
    console.log('\nMigration completed!');
    console.log(`Total items: ${items.length}`);
    console.log(`Migrated: ${migrated}`);
    console.log(`Errors: ${errors}`);
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateSchema().then(() => {
  console.log('Done!');
  process.exit(0);
});