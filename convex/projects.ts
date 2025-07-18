import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
  args: {
    name: v.string(),
    clientId: v.id("clients"),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { userId, ...projectData } = args;
    const projectId = await ctx.db.insert("projects", {
      ...projectData,
      totalValue: 0,
      createdAt: Date.now(),
      createdBy: userId,
    });
    return projectId;
  },
});

export const update = mutation({
  args: {
    _id: v.id("projects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("completed"),
      v.literal("cancelled")
    )),
    totalValue: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { _id, ...updates } = args;
    await ctx.db.patch(_id, updates);
  },
});

export const getAll = query({
  handler: async (ctx) => {
    const projects = await ctx.db.query("projects").collect();
    
    // Get client names
    const projectsWithClients = await Promise.all(
      projects.map(async (project) => {
        const client = await ctx.db.get(project.clientId);
        return {
          ...project,
          clientName: client?.name || "Unknown",
        };
      })
    );
    
    return projectsWithClients;
  },
});

export const getByClient = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("projects")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();
  },
});

export const getByStatus = query({
  args: { status: v.union(
    v.literal("draft"),
    v.literal("active"),
    v.literal("completed"),
    v.literal("cancelled")
  )},
  handler: async (ctx, args) => {
    return await ctx.db
      .query("projects")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .collect();
  },
});

export const getById = query({
  args: { _id: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args._id);
    if (!project) return null;
    
    const client = await ctx.db.get(project.clientId);
    return {
      ...project,
      clientName: client?.name || "Unknown",
    };
  },
});

export const updateTotalValue = mutation({
  args: {
    _id: v.id("projects"),
    totalValue: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args._id, { totalValue: args.totalValue });
  },
});

export const addMatchingJob = mutation({
  args: {
    projectId: v.id("projects"),
    jobId: v.string(),
  },
  handler: async (ctx, args) => {
    // This mutation exists for compatibility but jobs are now linked via the aiMatchingJobs table
    // The relationship is managed through the projectId field in aiMatchingJobs
    return { success: true };
  },
});

export const removeMatchingJob = mutation({
  args: {
    projectId: v.id("projects"),
    jobId: v.string(),
  },
  handler: async (ctx, args) => {
    // This mutation exists for compatibility but jobs are now linked via the aiMatchingJobs table
    // The relationship is managed through the projectId field in aiMatchingJobs
    return { success: true };
  },
});

export const get = query({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.id);
    if (!project) return null;
    
    const client = await ctx.db.get(project.clientId);
    
    // Get all jobs for this project
    const jobs = await ctx.db
      .query("aiMatchingJobs")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .collect();
    
    return {
      ...project,
      clientName: client?.name || "Unknown",
      jobCount: jobs.length,
      jobs: jobs.map(job => ({
        _id: job._id,
        fileName: job.fileName,
        status: job.status,
        progress: job.progress,
        itemCount: job.itemCount,
        matchedCount: job.matchedCount,
        totalValue: job.totalValue,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
      })),
    };
  },
});