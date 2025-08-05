import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const migrateFieldNames = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all price items
    const items = await ctx.db.query("priceItems").collect();
    
    let updated = 0;
    let errors = 0;
    
    console.log(`Starting migration of ${items.length} items...`);
    
    // Process in batches to avoid timeout
    const batchSize = 100;
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, Math.min(i + batchSize, items.length));
      
      for (const item of batch) {
        try {
          // Prepare update object
          const updates: any = {};
          
          // Map old field names to new ones
          if (!item.code && item.id) {
            updates.code = item.id;
          }
          
          if (!item.subcategory && item.product_template_variant_value_ids) {
            updates.subcategory = item.product_template_variant_value_ids;
          }
          
          if (!item.unit && item.uom_id) {
            updates.unit = item.uom_id;
          }
          
          if (!item.rate && item.operation_cost !== undefined) {
            updates.rate = item.operation_cost;
          }
          
          // Only update if there are changes
          if (Object.keys(updates).length > 0) {
            await ctx.db.patch(item._id, updates);
            updated++;
          }
        } catch (error) {
          console.error(`Error updating item ${item._id}:`, error);
          errors++;
        }
      }
      
      // Log progress
      console.log(`Processed ${Math.min(i + batchSize, items.length)}/${items.length} items`);
    }
    
    return {
      total: items.length,
      updated,
      errors,
      message: `Migration complete: ${updated} items updated, ${errors} errors`
    };
  },
});

export const checkMigrationStatus = mutation({
  args: {},
  handler: async (ctx) => {
    // Get a sample of items to check
    const items = await ctx.db.query("priceItems").take(10);
    
    const missingFields = {
      code: 0,
      subcategory: 0,
      unit: 0,
      rate: 0
    };
    
    items.forEach(item => {
      if (!item.code) missingFields.code++;
      if (!item.subcategory) missingFields.subcategory++;
      if (!item.unit) missingFields.unit++;
      if (item.rate === undefined || item.rate === null) missingFields.rate++;
    });
    
    const sampleItem = items[0] || null;
    
    return {
      sampleSize: items.length,
      missingFields,
      sampleItem: sampleItem ? {
        _id: sampleItem._id,
        code: sampleItem.code || 'MISSING',
        subcategory: sampleItem.subcategory || 'MISSING',
        unit: sampleItem.unit || 'MISSING',
        rate: sampleItem.rate !== undefined ? sampleItem.rate : 'MISSING',
        // Show original fields
        id: sampleItem.id || 'N/A',
        product_template_variant_value_ids: sampleItem.product_template_variant_value_ids || 'N/A',
        uom_id: sampleItem.uom_id || 'N/A',
        operation_cost: sampleItem.operation_cost || 'N/A'
      } : null
    };
  },
});