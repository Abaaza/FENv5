import { v } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";

export const create = mutation({
  args: {
    id: v.string(),
    code: v.optional(v.string()),
    ref: v.optional(v.string()),
    description: v.string(),
    keywords: v.optional(v.array(v.string())),
    // Construction-specific fields
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
    // Supplier info
    supplier: v.optional(v.string()),
    location: v.optional(v.string()),
    availability: v.optional(v.string()),
    remark: v.optional(v.string()),
    // Legacy fields
    subCategoryCode: v.optional(v.string()),
    subCategoryName: v.optional(v.string()),
    sub_category: v.optional(v.string()),
    type: v.optional(v.string()),
    vehicle_type: v.optional(v.string()),
    vendor: v.optional(v.string()),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { userId, ...itemData } = args;
    const priceItemId = await ctx.db.insert("priceItems", {
      ...itemData,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: userId,
    });
    return priceItemId;
  },
});

export const update = mutation({
  args: {
    id: v.id("priceItems"),
    code: v.optional(v.string()),
    ref: v.optional(v.string()),
    description: v.optional(v.string()),
    keywords: v.optional(v.array(v.string())),
    // Construction-specific fields
    material_type: v.optional(v.string()),
    material_grade: v.optional(v.string()),
    material_size: v.optional(v.string()),
    material_finish: v.optional(v.string()),
    category: v.optional(v.string()),
    subcategory: v.optional(v.string()),
    work_type: v.optional(v.string()),
    brand: v.optional(v.string()),
    unit: v.optional(v.string()),
    rate: v.optional(v.number()),
    labor_rate: v.optional(v.number()),
    material_rate: v.optional(v.number()),
    wastage_percentage: v.optional(v.number()),
    // Supplier info
    supplier: v.optional(v.string()),
    location: v.optional(v.string()),
    availability: v.optional(v.string()),
    remark: v.optional(v.string()),
    // Legacy fields
    subCategoryCode: v.optional(v.string()),
    subCategoryName: v.optional(v.string()),
    sub_category: v.optional(v.string()),
    type: v.optional(v.string()),
    vehicle_type: v.optional(v.string()),
    vendor: v.optional(v.string()),
    // Metadata
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, ...updates }) => {
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

export const getAll = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("priceItems")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

export const getActive = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("priceItems")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

export const getById = query({
  args: { id: v.id("priceItems") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getByIds = query({
  args: { ids: v.array(v.id("priceItems")) },
  handler: async (ctx, args) => {
    const items = [];
    for (const id of args.ids) {
      const item = await ctx.db.get(id);
      if (item) {
        items.push(item);
      }
    }
    return items;
  },
});

export const getPaginated = query({
  args: { 
    paginationOpts: paginationOptsValidator,
    searchQuery: v.optional(v.string()),
    category: v.optional(v.string()),
    subcategory: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("priceItems").filter((q) => q.eq(q.field("isActive"), true));
    
    // Apply filters if provided
    if (args.category) {
      query = query.filter((q) => q.eq(q.field("category"), args.category));
    }
    
    if (args.subcategory) {
      query = query.filter((q) => q.eq(q.field("subcategory"), args.subcategory));
    }
    
    return await query.paginate(args.paginationOpts);
  },
});

// Optimized search query
export const search = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const searchQuery = args.query.toLowerCase().trim();
    const limit = args.limit || 20;
    
    if (searchQuery.length < 2) {
      return [];
    }

    // Get all active items
    const allItems = await ctx.db
      .query("priceItems")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Score each item based on search relevance
    const scoredItems = allItems.map(item => {
      let score = 0;
      const description = (item.description || '').toLowerCase();
      const code = (item.code || '').toLowerCase();
      const category = (item.category || '').toLowerCase();
      
      // Exact matches get highest score
      if (description === searchQuery || code === searchQuery) {
        score = 100;
      }
      // Starts with gets high score
      else if (description.startsWith(searchQuery) || code.startsWith(searchQuery)) {
        score = 80;
      }
      // Word boundary matches
      else if (description.includes(' ' + searchQuery) || description.includes(searchQuery + ' ')) {
        score = 60;
      }
      // Contains match
      else if (description.includes(searchQuery) || code.includes(searchQuery)) {
        score = 40;
      }
      // Category match
      else if (category.includes(searchQuery)) {
        score = 30;
      }
      // Check other fields
      else {
        const otherFields = [
          item.subcategory,
          item.material_type,
          item.brand,
          item.supplier,
        ].filter(Boolean).join(' ').toLowerCase();
        
        if (otherFields.includes(searchQuery)) {
          score = 20;
        }
      }
      
      return { item, score };
    });

    // Filter out non-matches and sort by score
    const matches = scoredItems
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ item }) => item);

    return matches;
  },
});

export const setActive = mutation({
  args: {
    id: v.id("priceItems"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      isActive: args.isActive,
      updatedAt: Date.now(),
    });
  },
});

export const deleteItem = mutation({
  args: { id: v.id("priceItems") },
  handler: async (ctx, args) => {
    // Instead of deleting, we'll mark as inactive
    await ctx.db.patch(args.id, {
      isActive: false,
      updatedAt: Date.now(),
    });
  },
});

export const deleteBatch = mutation({
  args: { ids: v.array(v.id("priceItems")) },
  handler: async (ctx, args) => {
    for (const id of args.ids) {
      await ctx.db.patch(id, {
        isActive: false,
        updatedAt: Date.now(),
      });
    }
  },
});

export const createBatch = mutation({
  args: {
    items: v.array(v.object({
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
      subCategoryCode: v.optional(v.string()),
      subCategoryName: v.optional(v.string()),
      sub_category: v.optional(v.string()),
      type: v.optional(v.string()),
      vehicle_type: v.optional(v.string()),
      vendor: v.optional(v.string()),
    })),
    userId: v.id("users"),
  },
  handler: async (ctx, { items, userId }) => {
    const created = [];
    for (const item of items) {
      const id = await ctx.db.insert("priceItems", {
        ...item,
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: userId,
      });
      created.push(id);
    }
    return created;
  },
});

export const getCategories = query({
  handler: async (ctx) => {
    const items = await ctx.db
      .query("priceItems")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    const categories = new Set<string>();
    items.forEach(item => {
      if (item.category) {
        categories.add(item.category);
      }
    });
    
    return Array.from(categories).sort();
  },
});

export const getCategorySubcategories = query({
  handler: async (ctx) => {
    const items = await ctx.db
      .query("priceItems")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    const categorySubcategories: Record<string, string[]> = {};
    items.forEach(item => {
      if (item.category && item.subcategory) {
        if (!categorySubcategories[item.category]) {
          categorySubcategories[item.category] = [];
        }
        if (!categorySubcategories[item.category].includes(item.subcategory)) {
          categorySubcategories[item.category].push(item.subcategory);
        }
      }
    });
    
    // Sort subcategories within each category
    Object.keys(categorySubcategories).forEach(category => {
      categorySubcategories[category].sort();
    });
    
    return categorySubcategories;
  },
});

// Internal query for getting items with embeddings
export const getItemsForEmbedding = internalQuery({
  args: {
    provider: v.union(v.literal("cohere"), v.literal("openai")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const query = ctx.db
      .query("priceItems")
      .filter((q) => q.eq(q.field("isActive"), true));
    
    const items = await query.collect();
    
    // Filter items that don't have embeddings or have embeddings from a different provider
    const itemsNeedingEmbedding = items.filter(item => 
      !item.embedding || item.embeddingProvider !== args.provider
    );
    
    return args.limit 
      ? itemsNeedingEmbedding.slice(0, args.limit)
      : itemsNeedingEmbedding;
  },
});

// Update item with embedding
export const updateEmbedding = mutation({
  args: {
    id: v.id("priceItems"),
    embedding: v.array(v.number()),
    embeddingProvider: v.union(v.literal("cohere"), v.literal("openai")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      embedding: args.embedding,
      embeddingProvider: args.embeddingProvider,
      updatedAt: Date.now(),
    });
  },
});