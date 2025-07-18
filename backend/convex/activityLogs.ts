import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
  args: {
    userId: v.id("users"),
    action: v.string(),
    entityType: v.string(),
    entityId: v.optional(v.string()),
    details: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const logId = await ctx.db.insert("activityLogs", {
      ...args,
      timestamp: Date.now(),
    });
    return logId;
  },
});

export const getByUser = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    return await ctx.db
      .query("activityLogs")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);
  },
});

export const getByEntity = query({
  args: {
    entityType: v.string(),
    entityId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    return await ctx.db
      .query("activityLogs")
      .withIndex("by_entity", (q) => 
        q.eq("entityType", args.entityType).eq("entityId", args.entityId)
      )
      .order("desc")
      .take(limit);
  },
});

export const getRecent = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    const logs = await ctx.db
      .query("activityLogs")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit);
    
    // Get user names
    const logsWithUsers = await Promise.all(
      logs.map(async (log) => {
        const user = await ctx.db.get(log.userId);
        return {
          ...log,
          userName: user?.name || "Unknown",
          userEmail: user?.email || "",
        };
      })
    );
    
    return logsWithUsers;
  },
});

export const getByDateRange = query({
  args: {
    startTime: v.number(),
    endTime: v.number(),
  },
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("activityLogs")
      .withIndex("by_timestamp")
      .order("desc")
      .collect();
    
    return logs.filter(
      (log) => log.timestamp >= args.startTime && log.timestamp <= args.endTime
    );
  },
});

export const cleanup = mutation({
  args: {
    daysToKeep: v.number(),
  },
  handler: async (ctx, args) => {
    const cutoffTime = Date.now() - args.daysToKeep * 24 * 60 * 60 * 1000;
    
    const oldLogs = await ctx.db
      .query("activityLogs")
      .withIndex("by_timestamp")
      .filter((q) => q.lt(q.field("timestamp"), cutoffTime))
      .collect();
    
    let deletedCount = 0;
    for (const log of oldLogs) {
      await ctx.db.delete(log._id);
      deletedCount++;
    }
    
    return { deletedCount };
  },
});