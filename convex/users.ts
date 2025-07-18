import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
    role: v.union(v.literal("user"), v.literal("admin")),
    isApproved: v.boolean(),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.db.insert("users", {
      ...args,
      isActive: args.isActive ?? true,
      createdAt: Date.now(),
    });
    return userId;
  },
});

export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
  },
});

export const getByRefreshToken = query({
  args: { refreshToken: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_refresh_token", (q) => q.eq("refreshToken", args.refreshToken))
      .first();
  },
});

export const updateLastLogin = mutation({
  args: {
    userId: v.id("users"),
    refreshToken: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      lastLogin: Date.now(),
      refreshToken: args.refreshToken,
    });
  },
});

export const updateRefreshToken = mutation({
  args: {
    userId: v.id("users"),
    refreshToken: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      refreshToken: args.refreshToken,
    });
  },
});

export const clearRefreshToken = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      refreshToken: undefined,
    });
  },
});

export const getPendingUsers = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("isApproved"), false))
      .collect();
  },
});

export const approveUser = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      isApproved: true,
    });
  },
});

export const setUserRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("user"), v.literal("admin")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      role: args.role,
    });
  },
});

export const getAllUsers = query({
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});

export const getById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

export const updatePassword = mutation({
  args: {
    userId: v.id("users"),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      password: args.password,
    });
  },
});

export const updateProfile = mutation({
  args: {
    userId: v.id("users"),
    updates: v.object({
      name: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, args.updates);
  },
});