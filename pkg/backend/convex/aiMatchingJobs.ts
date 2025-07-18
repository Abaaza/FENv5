import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const updateJobStatus = mutation({
  args: {
    jobId: v.string(),
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("parsing"),
      v.literal("processing"),
      v.literal("matching"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled")
    )),
    progress: v.optional(v.number()),
    progressMessage: v.optional(v.string()),
    matchedCount: v.optional(v.number()),
    itemCount: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: any = {};
    
    if (args.status !== undefined) {
      // Map "processing" to "matching" for backward compatibility
      if (args.status === "processing") {
        updates.status = "matching";
      } else {
        updates.status = args.status;
      }
    }
    
    if (args.progress !== undefined) {
      updates.progress = args.progress;
    }
    
    if (args.progressMessage !== undefined) {
      updates.progressMessage = args.progressMessage;
    }
    
    if (args.matchedCount !== undefined) {
      updates.matchedCount = args.matchedCount;
    }
    
    if (args.itemCount !== undefined) {
      updates.itemCount = args.itemCount;
    }
    
    if (args.error !== undefined) {
      updates.error = args.error;
    }
    
    if (args.status === "completed" || args.status === "failed" || args.status === "cancelled") {
      updates.completedAt = Date.now();
    }
    
    // Convert string ID to Convex ID
    await ctx.db.patch(args.jobId as any, updates);
  },
});

export const getJob = query({
  args: {
    jobId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId as any);
  },
});

export const getAll = query({
  handler: async (ctx) => {
    return await ctx.db.query("aiMatchingJobs").collect();
  },
});