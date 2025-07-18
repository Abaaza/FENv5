const { ConvexClient } = require("convex/browser");

async function checkUsers() {
  try {
    // Connect to the old Convex database
    const client = new ConvexClient("https://good-dolphin-454.convex.cloud");
    
    console.log("Connecting to Convex at: https://good-dolphin-454.convex.cloud");
    
    // Try to query users
    const users = await client.query("users:list");
    console.log("Users found:", users);
    
  } catch (error) {
    console.error("Error:", error.message);
  }
}

checkUsers();