import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
  args: {
    userId: v.id("users"),
    type: v.string(),
    totalItems: v.number(),
    fileName: v.string(),
  },
  handler: async (ctx, args) => {
    const jobId = await ctx.db.insert("importJobs", {
      userId: args.userId,
      type: args.type,
      totalItems: args.totalItems,
      fileName: args.fileName,
      status: "pending",
      progress: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return jobId;
  },
});

export const updateStatus = mutation({
  args: {
    jobId: v.id("importJobs"),
    status: v.union(v.literal("pending"), v.literal("processing"), v.literal("completed"), v.literal("failed")),
    progress: v.optional(v.number()),
    results: v.optional(v.object({
      created: v.number(),
      updated: v.number(),
      skipped: v.number(),
      errors: v.array(v.string()),
    })),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: any = {
      status: args.status,
      updatedAt: Date.now(),
    };
    
    if (args.progress !== undefined) {
      updates.progress = args.progress;
    }
    
    if (args.results) {
      updates.results = args.results;
    }
    
    if (args.error) {
      updates.error = args.error;
    }
    
    if (args.status === "completed" || args.status === "failed") {
      updates.completedAt = Date.now();
    }
    
    await ctx.db.patch(args.jobId, updates);
  },
});

export const updateProgress = mutation({
  args: {
    jobId: v.id("importJobs"),
    progress: v.number(),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: any = {
      progress: args.progress,
      updatedAt: Date.now(),
    };
    
    if (args.message) {
      updates.progressMessage = args.message;
    }
    
    await ctx.db.patch(args.jobId, updates);
  },
});

export const getById = query({
  args: { jobId: v.id("importJobs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

export const getByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("importJobs")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const getActive = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("importJobs")
      .filter((q) => 
        q.or(
          q.eq(q.field("status"), "pending"),
          q.eq(q.field("status"), "processing")
        )
      )
      .order("desc")
      .collect();
  },
});