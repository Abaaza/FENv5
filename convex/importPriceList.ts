import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const importPriceItems = mutation({
  args: {
    items: v.array(
      v.object({
        id: v.string(),
        code: v.optional(v.string()),
        ref: v.optional(v.string()),
        description: v.string(),
        keywords: v.optional(v.array(v.string())),
        material_type: v.optional(v.string()),
        material_grade: v.optional(v.string()),
        material_size: v.optional(v.string()),
        material_finish: v.optional(v.string()),
        category: v.optional(v.string()),
        subcategory: v.optional(v.string()),
        work_type: v.optional(v.string()),
        brand: v.optional(v.string()),
        unit: v.optional(v.string()),
        rate: v.number(),
        labor_rate: v.optional(v.number()),
        material_rate: v.optional(v.number()),
        wastage_percentage: v.optional(v.number()),
        supplier: v.optional(v.string()),
        location: v.optional(v.string()),
        availability: v.optional(v.string()),
        remark: v.optional(v.string()),
      })
    ),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { items, userId } = args;
    
    let created = 0;
    let updated = 0;
    let errors: string[] = [];

    for (const item of items) {
      try {
        // Check if item with this ID already exists
        const existing = await ctx.db
          .query("priceItems")
          .withIndex("by_item_id", (q) => q.eq("id", item.id))
          .first();

        if (existing) {
          // Update existing item
          await ctx.db.patch(existing._id, {
            ...item,
            updatedAt: Date.now(),
          });
          updated++;
        } else {
          // Create new item
          await ctx.db.insert("priceItems", {
            ...item,
            isActive: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            createdBy: userId,
          });
          created++;
        }
      } catch (error) {
        errors.push(`Error processing item ${item.id}: ${error}`);
      }
    }

    return {
      success: true,
      created,
      updated,
      errors,
      total: items.length,
    };
  },
});

export const clearAllPriceItems = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Get all price items
    const items = await ctx.db.query("priceItems").collect();
    
    // Delete each item
    for (const item of items) {
      await ctx.db.delete(item._id);
    }
    
    return {
      success: true,
      deleted: items.length,
    };
  },
});