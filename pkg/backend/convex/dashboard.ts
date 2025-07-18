import { query } from "./_generated/server";
import { v } from "convex/values";

export const getStats = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Get total projects count
    const totalProjects = await ctx.db
      .query("aiMatchingJobs")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Get start of today (midnight in local time)
    const now = Date.now();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMidnight = today.getTime();

    const completedToday = totalProjects.filter(
      (job) =>
        job.status === "completed" &&
        job.completedAt &&
        job.completedAt >= todayMidnight
    );

    // Get total price items (all items, not just active)
    const priceItems = await ctx.db
      .query("priceItems")
      .collect();

    // Get total clients
    const clients = await ctx.db
      .query("clients")
      .collect();

    // Calculate matches today
    const matchesToday = completedToday.reduce(
      (sum, job) => sum + job.matchedCount,
      0
    );

    // Get activity count for today
    const allActivities = await ctx.db
      .query("activityLogs")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Count activities from today (midnight onwards)
    const activitiesToday = allActivities.filter(
      (activity) => activity.timestamp >= todayMidnight
    ).length;
    
    // Debug logging
    console.log(`[Dashboard Stats] User ${args.userId}:`);
    console.log(`- Total activities: ${allActivities.length}`);
    console.log(`- Activities today: ${activitiesToday}`);
    console.log(`- Current time: ${new Date(now).toISOString()}`);
    console.log(`- Today midnight: ${new Date(todayMidnight).toISOString()}`);
    if (allActivities.length > 0) {
      console.log(`- Latest activity: ${new Date(allActivities[0].timestamp).toISOString()}`);
      console.log(`- Oldest activity: ${new Date(allActivities[allActivities.length - 1].timestamp).toISOString()}`);
    }

    return {
      totalProjects: totalProjects.length,
      activeProjects: totalProjects.filter((j) => j.status !== "completed" && j.status !== "failed").length,
      priceItems: priceItems.length,
      clients: clients.length,
      matchesToday,
      completedToday: completedToday.length,
      activitiesToday,
    };
  },
});

export const getRecentActivity = query({
  args: { userId: v.id("users"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;
    
    const activities = await ctx.db
      .query("activityLogs")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);

    // Get user information for each activity
    const activitiesWithUsers = await Promise.all(
      activities.map(async (activity) => {
        const user = await ctx.db.get(activity.userId);
        return {
          ...activity,
          userName: user?.name || "Unknown User",
          userEmail: user?.email || "",
        };
      })
    );

    return activitiesWithUsers;
  },
});

export const getRecentJobs = query({
  args: { userId: v.id("users"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 5;
    
    const jobs = await ctx.db
      .query("aiMatchingJobs")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);

    // Get client names for jobs
    const jobsWithClients = await Promise.all(
      jobs.map(async (job) => {
        const client = job.clientId
          ? await ctx.db.get(job.clientId)
          : null;
        return {
          ...job,
          clientName: client?.name || "No client",
        };
      })
    );

    return jobsWithClients;
  },
});

export const getActivitySummary = query({
  args: { 
    userId: v.id("users"), 
    startDate: v.number(),
    endDate: v.number()
  },
  handler: async (ctx, args) => {
    // Get all jobs for user first to check if we have any data
    const allJobs = await ctx.db
      .query("aiMatchingJobs")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Filter jobs in time range
    const jobs = allJobs.filter(job => 
      job.startedAt >= args.startDate && job.startedAt <= args.endDate
    );

    // Get all activity logs for user
    const allActivities = await ctx.db
      .query("activityLogs")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Filter activities in time range
    const activities = allActivities.filter(activity =>
      activity.timestamp >= args.startDate && activity.timestamp <= args.endDate
    );

    // Get all price items created by user
    const allPriceItems = await ctx.db
      .query("priceItems")
      .filter((q) => q.eq(q.field("createdBy"), args.userId))
      .collect();

    // Filter price items in time range
    const priceItems = allPriceItems.filter(item =>
      item.createdAt >= args.startDate && item.createdAt <= args.endDate
    );

    // Calculate totals
    const completedJobs = jobs.filter(j => j.status === "completed");
    const totalMatches = completedJobs.reduce((sum, job) => sum + job.matchedCount, 0);
    const totalValue = completedJobs.reduce((sum, job) => sum + (job.totalValue || 0), 0);

    // If no data in time range, return some sample data from all time
    if (jobs.length === 0 && activities.length === 0 && priceItems.length === 0) {
      const allCompletedJobs = allJobs.filter(j => j.status === "completed");
      return {
        jobs: {
          total: allJobs.length,
          completed: allCompletedJobs.length,
          failed: allJobs.filter(j => j.status === "failed").length,
          inProgress: allJobs.filter(j => j.status === "matching" || j.status === "parsing").length
        },
        matches: allCompletedJobs.reduce((sum, job) => sum + job.matchedCount, 0),
        totalValue: allCompletedJobs.reduce((sum, job) => sum + (job.totalValue || 0), 0),
        activities: allActivities.length,
        priceItemsAdded: allPriceItems.length,
        timeRange: {
          start: args.startDate,
          end: args.endDate,
          note: "Showing all-time data"
        }
      };
    }

    return {
      jobs: {
        total: jobs.length,
        completed: completedJobs.length,
        failed: jobs.filter(j => j.status === "failed").length,
        inProgress: jobs.filter(j => j.status === "matching" || j.status === "parsing").length
      },
      matches: totalMatches,
      totalValue,
      activities: activities.length,
      priceItemsAdded: priceItems.length,
      timeRange: {
        start: args.startDate,
        end: args.endDate
      }
    };
  },
});