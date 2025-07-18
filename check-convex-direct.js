const { ConvexHttpClient } = require("convex/server");
require("dotenv").config();

async function checkJob() {
    const jobId = "j97fx6c2kkb1txz3yffgwvy99s7kxnak";
    
    try {
        console.log("Connecting to Convex at:", process.env.CONVEX_URL);
        const client = new ConvexHttpClient(process.env.CONVEX_URL);
        
        // Try to query the job directly
        console.log(`\nChecking for job: ${jobId}`);
        
        // First, let's try to list all jobs to see if our job exists
        console.log("\nAttempting to query jobs...");
        
        // This is a guess at the API structure - adjust based on actual Convex schema
        try {
            const job = await client.query(api => api.jobs.get, { id: jobId });
            console.log("Job found:", JSON.stringify(job, null, 2));
        } catch (e) {
            console.log("Could not get specific job, error:", e.message);
        }
        
        // Try alternative query methods
        try {
            const jobs = await client.query(api => api.jobs.list);
            console.log(`\nTotal jobs in database: ${jobs.length}`);
            const ourJob = jobs.find(j => j._id === jobId);
            if (ourJob) {
                console.log("Job found in list:", JSON.stringify(ourJob, null, 2));
            } else {
                console.log(`Job ${jobId} not found in the list of ${jobs.length} jobs`);
            }
        } catch (e) {
            console.log("Could not list jobs, error:", e.message);
        }
        
    } catch (error) {
        console.error("Error connecting to Convex:", error);
    }
}

checkJob().then(() => process.exit(0)).catch(err => {
    console.error("Script error:", err);
    process.exit(1);
});