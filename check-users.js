require("dotenv").config();
const { ConvexHttpClient } = require("convex/browser");
const fetch = require('node-fetch');

// Polyfill for node environment
global.fetch = fetch;

async function checkUsers() {
    try {
        console.log("Connecting to Convex at:", process.env.CONVEX_URL);
        const client = new ConvexHttpClient(process.env.CONVEX_URL);
        
        console.log("\nAttempting to list users...");
        
        // Try to query users
        try {
            const users = await client.query(async ({ db }) => {
                return await db.query("users").collect();
            });
            console.log(`Found ${users.length} users`);
            users.forEach(user => {
                console.log(`- Email: ${user.email}, Role: ${user.role}, Status: ${user.status || 'N/A'}`);
            });
        } catch (e) {
            console.log("Could not query users directly, error:", e.message);
        }
        
    } catch (error) {
        console.error("Error:", error);
    }
}

checkUsers().then(() => process.exit(0)).catch(err => {
    console.error("Script error:", err);
    process.exit(1);
});