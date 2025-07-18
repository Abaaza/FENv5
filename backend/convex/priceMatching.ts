import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const createJob = mutation({
  args: {
    userId: v.id("users"),
    fileName: v.string(),
    fileBuffer: v.optional(v.array(v.number())), // Made optional - large files exceed Convex limits
    itemCount: v.number(),
    matchingMethod: v.union(
      v.literal("LOCAL"),
      v.literal("COHERE"),
      v.literal("OPENAI")
    ),
    clientId: v.optional(v.id("clients")),
    projectId: v.optional(v.id("projects")),
    projectName: v.optional(v.string()),
    headers: v.optional(v.array(v.string())),
    sheetName: v.optional(v.string()),
    originalFileId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const jobId = await ctx.db.insert("aiMatchingJobs", {
      userId: args.userId,
      clientId: args.clientId,
      projectId: args.projectId,
      projectName: args.projectName,
      fileName: args.fileName,
      fileUrl: "", // We'll store the buffer separately
      originalFileId: args.originalFileId,
      status: "pending",
      progress: 0,
      itemCount: args.itemCount,
      matchedCount: 0,
      matchingMethod: args.matchingMethod,
      startedAt: Date.now(),
      headers: args.headers,
      sheetName: args.sheetName,
    });
    
    // Skip storing file buffer - the table schema doesn't support it
    // and large files exceed Convex limits anyway
    // if (args.fileBuffer && args.fileBuffer.length < 8192) {
    //   await ctx.db.patch(jobId, {
    //     fileBuffer: args.fileBuffer,
    //   } as any);
    // }
    
    return jobId;
  },
});

export const updateJobStatus = mutation({
  args: {
    jobId: v.string(), // Accept string ID that we'll convert
    status: v.union(
      v.literal("pending"),
      v.literal("parsing"),
      v.literal("processing"),
      v.literal("matching"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
    progress: v.optional(v.number()),
    progressMessage: v.optional(v.string()),
    matchedCount: v.optional(v.number()),
    itemCount: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: any = {};
    
    // Map "processing" to "matching" for backward compatibility
    if (args.status === "processing") {
      updates.status = "matching";
    } else {
      updates.status = args.status;
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

export const linkJobToProject = mutation({
  args: {
    jobId: v.id("aiMatchingJobs"),
    projectId: v.id("projects"),
    projectName: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      projectId: args.projectId,
      projectName: args.projectName,
    });
  },
});

export const unlinkJobFromProject = mutation({
  args: {
    jobId: v.id("aiMatchingJobs"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      projectId: undefined,
      projectName: undefined,
    });
  },
});

export const getJobsByProject = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("aiMatchingJobs")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const getUserJobs = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("aiMatchingJobs")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const getAllJobs = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("aiMatchingJobs")
      .order("desc")
      .collect();
  },
});

export const getJob = query({
  args: {
    jobId: v.id("aiMatchingJobs"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

export const getMatchResults = query({
  args: {
    jobId: v.id("aiMatchingJobs"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("matchResults")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();
  },
});

export const getMatchResult = query({
  args: {
    resultId: v.id("matchResults"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.resultId);
  },
});

export const createMatchResult = mutation({
  args: {
    jobId: v.id("aiMatchingJobs"),
    rowNumber: v.number(),
    originalDescription: v.string(),
    originalQuantity: v.optional(v.number()),
    originalUnit: v.optional(v.string()),
    originalRowData: v.optional(v.any()),
    // contextHeaders: v.optional(v.array(v.string())), // Temporarily removed until schema is synced
    matchedItemId: v.optional(v.string()), // Keep as string for now to match deployed schema
    matchedDescription: v.optional(v.string()),
    matchedCode: v.optional(v.string()),
    matchedUnit: v.optional(v.string()),
    matchedRate: v.optional(v.number()),
    confidence: v.number(),
    matchMethod: v.string(),
    totalPrice: v.optional(v.number()),
    notes: v.optional(v.string()),
    isManuallyEdited: v.optional(v.boolean()), // Add to match schema
  },
  handler: async (ctx, args) => {
    // Clean the args to ensure we only save what the schema expects
    const { matchedItemId, isManuallyEdited, ...cleanArgs } = args;
    await ctx.db.insert("matchResults", {
      ...cleanArgs,
      matchedItemId: matchedItemId ? matchedItemId as any : undefined,
      isManuallyEdited: isManuallyEdited ?? false, // Default to false if not provided
    });
  },
});

export const updateMatchResult = mutation({
  args: {
    resultId: v.id("matchResults"),
    updates: v.object({
      matchedItemId: v.optional(v.string()), // Keep as string for now to match deployed schema
      matchedDescription: v.optional(v.string()),
      matchedCode: v.optional(v.string()),
      matchedUnit: v.optional(v.string()),
      matchedRate: v.optional(v.number()),
      confidence: v.optional(v.number()),
      totalPrice: v.optional(v.number()),
      notes: v.optional(v.string()),
      isManuallyEdited: v.optional(v.boolean()),
      matchMethod: v.optional(v.string()),
    }),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { matchedItemId, isManuallyEdited, ...otherUpdates } = args.updates;
    await ctx.db.patch(args.resultId, {
      ...otherUpdates,
      matchedItemId: matchedItemId ? matchedItemId as any : undefined,
      isManuallyEdited: isManuallyEdited ?? true, // Default to true for manual updates
    });
  },
});

export const autoSaveMatchResult = mutation({
  args: {
    resultId: v.id("matchResults"),
    updates: v.any(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Auto-save with minimal validation
    await ctx.db.patch(args.resultId, {
      ...args.updates,
      lastAutoSave: Date.now(),
    } as any);
  },
});

export const getJobById = query({
  args: {
    jobId: v.id("aiMatchingJobs"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

export const deleteJob = mutation({
  args: {
    jobId: v.id("aiMatchingJobs"),
  },
  handler: async (ctx, args) => {
    // Delete all match results first
    const results = await ctx.db
      .query("matchResults")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();
    
    for (const result of results) {
      await ctx.db.delete(result._id);
    }
    
    // Then delete the job
    await ctx.db.delete(args.jobId);
  },
});

export const updateMatchedCount = mutation({
  args: {
    jobId: v.id("aiMatchingJobs"),
    matchedCount: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      matchedCount: args.matchedCount,
    });
  },
});

export const updateTotalValue = mutation({
  args: {
    jobId: v.id("aiMatchingJobs"),
    totalValue: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      totalValue: args.totalValue,
    });
  },
});

export const getRunningJobs = query({
  args: {},
  handler: async (ctx) => {
    // Get all jobs that are not completed or failed
    const runningJobs = await ctx.db
      .query("aiMatchingJobs")
      .filter((q) => 
        q.and(
          q.neq(q.field("status"), "completed"),
          q.neq(q.field("status"), "failed")
        )
      )
      .collect();
    
    return runningJobs;
  },
});

export const addParsedItem = mutation({
  args: {
    jobId: v.id("aiMatchingJobs"),
    rowNumber: v.number(),
    description: v.string(),
    quantity: v.optional(v.number()),
    unit: v.optional(v.string()),
    originalRowData: v.any(),
    contextHeaders: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // Store parsed items in a separate table or as part of the job
    // For now, we'll store them as match results with pending status
    await ctx.db.insert("matchResults", {
      jobId: args.jobId,
      rowNumber: args.rowNumber,
      originalDescription: args.description,
      originalQuantity: args.quantity,
      originalUnit: args.unit,
      originalRowData: args.originalRowData,
      confidence: 0,
      matchMethod: "pending",
    });
  },
});

export const getParsedItems = query({
  args: {
    jobId: v.id("aiMatchingJobs"),
  },
  handler: async (ctx, args) => {
    // Get all match results for this job that are pending
    const items = await ctx.db
      .query("matchResults")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .filter((q) => q.eq(q.field("matchMethod"), "pending"))
      .collect();
    
    return items.map(item => ({
      rowNumber: item.rowNumber,
      description: item.originalDescription,
      quantity: item.originalQuantity,
      unit: item.originalUnit,
      originalData: item.originalRowData,
      contextHeaders: [],
    }));
  },
});

export const deleteJobResults = mutation({
  args: {
    jobId: v.id("aiMatchingJobs"),
  },
  handler: async (ctx, args) => {
    // Delete all match results for this job
    const results = await ctx.db
      .query("matchResults")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();
    
    for (const result of results) {
      await ctx.db.delete(result._id);
    }
  },
});