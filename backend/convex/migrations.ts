import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const deleteOldJobs = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all jobs with old matching methods
    const jobs = await ctx.db.query("aiMatchingJobs").collect();
    
    let deleted = 0;
    
    for (const job of jobs) {
      if (["ADVANCED", "HYBRID", "LOCAL_UNIT", "HYBRID_CATEGORY"].includes(job.matchingMethod)) {
        // Delete the job
        await ctx.db.delete(job._id);
        
        // Also delete all match results for this job
        const results = await ctx.db
          .query("matchResults")
          .filter(q => q.eq(q.field("jobId"), job._id))
          .collect();
          
        for (const result of results) {
          await ctx.db.delete(result._id);
        }
        
        deleted++;
      }
    }
    
    return { deleted, total: jobs.length };
  },
});