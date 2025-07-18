import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
  args: {
    jobId: v.string(),
    level: v.union(v.literal("info"), v.literal("error"), v.literal("warning")),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("jobLogs", {
      jobId: args.jobId,
      level: args.level,
      message: args.message,
      timestamp: Date.now(),
    });
  },
});

export const getJobLogs = query({
  args: {
    jobId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("jobLogs")
      .filter((q) => q.eq(q.field("jobId"), args.jobId))
      .order("desc")
      .take(100);
  },
});

export const clearJobLogs = mutation({
  args: {
    jobId: v.string(),
  },
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("jobLogs")
      .filter((q) => q.eq(q.field("jobId"), args.jobId))
      .collect();
    
    for (const log of logs) {
      await ctx.db.delete(log._id);
    }
  },
});