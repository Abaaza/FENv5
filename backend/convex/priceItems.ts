import { v } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";

export const create = mutation({
  args: {
    id: v.string(),
    name: v.string(),
    product_template_variant_value_ids: v.optional(v.string()),
    operation_cost: v.number(),
    uom_id: v.string(),
    description: v.optional(v.string()),
    keywords: v.optional(v.array(v.string())),
    category: v.optional(v.string()),
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
    name: v.optional(v.string()),
    product_template_variant_value_ids: v.optional(v.string()),
    operation_cost: v.optional(v.number()),
    uom_id: v.optional(v.string()),
    description: v.optional(v.string()),
    keywords: v.optional(v.array(v.string())),
    category: v.optional(v.string()),
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
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("priceItems").filter((q) => q.eq(q.field("isActive"), true));
    
    // Apply filters if provided
    if (args.category) {
      query = query.filter((q) => q.eq(q.field("category"), args.category));
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
      const name = (item.name || '').toLowerCase();
      const description = (item.description || '').toLowerCase();
      const variant = (item.product_template_variant_value_ids || '').toLowerCase();
      const category = (item.category || '').toLowerCase();
      
      // Exact matches get highest score
      if (name === searchQuery || description === searchQuery) {
        score = 100;
      }
      // Starts with gets high score
      else if (name.startsWith(searchQuery) || description.startsWith(searchQuery)) {
        score = 80;
      }
      // Word boundary matches
      else if (name.includes(' ' + searchQuery) || name.includes(searchQuery + ' ')) {
        score = 60;
      }
      // Contains match
      else if (name.includes(searchQuery) || description.includes(searchQuery) || variant.includes(searchQuery)) {
        score = 40;
      }
      // Category match
      else if (category.includes(searchQuery)) {
        score = 30;
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
      name: v.string(),
      product_template_variant_value_ids: v.optional(v.string()),
      operation_cost: v.number(),
      uom_id: v.string(),
      description: v.optional(v.string()),
      keywords: v.optional(v.array(v.string())),
      category: v.optional(v.string()),
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
    
    // Since we don't have subcategories anymore, return categories with their unique names
    const categoryProducts: Record<string, string[]> = {};
    items.forEach(item => {
      if (item.category) {
        if (!categoryProducts[item.category]) {
          categoryProducts[item.category] = [];
        }
        if (!categoryProducts[item.category].includes(item.name)) {
          categoryProducts[item.category].push(item.name);
        }
      }
    });
    
    // Sort products within each category
    Object.keys(categoryProducts).forEach(category => {
      categoryProducts[category].sort();
    });
    
    return categoryProducts;
  },
});

// Internal query for getting items with embeddings
export const getItemsForEmbedding = internalQuery({
  args: {
    provider: v.union(v.literal("V2"), v.literal("V1")),
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
    embeddingProvider: v.union(v.literal("V2"), v.literal("V1")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      embedding: args.embedding,
      embeddingProvider: args.embeddingProvider,
      updatedAt: Date.now(),
    });
  },
});

// Deactivate all items (used when importing new price list)
export const deactivateAll = mutation({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db
      .query("priceItems")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    for (const item of items) {
      await ctx.db.patch(item._id, {
        isActive: false,
        updatedAt: Date.now(),
      });
    }
    
    return items.length;
  },
});