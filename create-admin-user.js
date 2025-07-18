// Script to create admin user directly via Convex
const { ConvexClient } = require("convex/browser");
const bcrypt = require("bcryptjs");

// Your Convex URL
const client = new ConvexClient("https://bright-scorpion-424.convex.cloud");

async function createAdminUser() {
  try {
    console.log("Creating admin user for The Fencing People...");
    
    // Hash the password
    const hashedPassword = await bcrypt.hash("abaza123", 10);
    console.log("Password hashed");
    
    // Create the admin user
    const userId = await client.mutation("users:create", {
      email: "abaza@tfp.com",
      password: hashedPassword,
      name: "Abaza Admin", 
      company: "The Fencing People",
      role: "admin",
      isActive: true,
      createdAt: new Date().toISOString()
    });
    
    console.log("Admin user created successfully with ID:", userId);
  } catch (error) {
    console.error("Error creating admin user:", error);
    
    // If user already exists, try to update it
    if (error.message?.includes("already exists") || error.message?.includes("duplicate")) {
      console.log("User might already exist. Checking...");
      
      try {
        const existingUser = await client.query("users:getByEmail", { 
          email: "abaza@tfp.com" 
        });
        
        if (existingUser) {
          console.log("User already exists with ID:", existingUser._id);
        }
      } catch (queryError) {
        console.log("Could not query for existing user:", queryError.message);
      }
    }
  }
}

// Run the function
createAdminUser().then(() => {
  console.log("Script completed");
  process.exit(0);
}).catch(err => {
  console.error("Script failed:", err);
  process.exit(1);
});