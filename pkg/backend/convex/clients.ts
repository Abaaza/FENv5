import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
  args: {
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
    notes: v.optional(v.string()),
    isActive: v.boolean(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { userId, ...clientData } = args;
    const clientId = await ctx.db.insert("clients", {
      ...clientData,
      createdAt: Date.now(),
      createdBy: userId,
    });
    return clientId;
  },
});

export const update = mutation({
  args: {
    _id: v.id("clients"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
    notes: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { _id, ...updates } = args;
    await ctx.db.patch(_id, updates);
  },
});

export const getAll = query({
  handler: async (ctx) => {
    return await ctx.db.query("clients").collect();
  },
});

export const getActive = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("clients")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
  },
});

export const getById = query({
  args: { _id: v.id("clients") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args._id);
  },
});

export const getByName = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("clients")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
  },
});

export const deleteClient = mutation({
  args: { _id: v.id("clients") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args._id);
  },
});