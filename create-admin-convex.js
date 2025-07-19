const { ConvexClient } = require("convex/browser");
const bcrypt = require("bcryptjs");

async function createAdminUser() {
  const client = new ConvexClient("https://lovely-armadillo-372.convex.cloud");
  
  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash("abaza123", 10);
    
    // Create admin user
    const result = await client.mutation("users:create", {
      email: "abaza@tfp.com",
      password: hashedPassword,
      name: "Admin User",
      role: "admin",
      isActive: true,
      createdAt: new Date().toISOString(),
      lastLogin: null
    });
    
    console.log("Admin user created successfully!");
    console.log("Email: abaza@tfp.com");
    console.log("Password: abaza123");
    console.log("User ID:", result);
  } catch (error) {
    if (error.message?.includes("already exists")) {
      console.log("User already exists. Updating password...");
      
      // Try to update existing user
      try {
        const users = await client.query("users:getByEmail", { email: "abaza@tfp.com" });
        if (users && users.length > 0) {
          await client.mutation("users:update", {
            id: users[0]._id,
            password: hashedPassword,
            role: "admin"
          });
          console.log("Password updated successfully!");
        }
      } catch (updateError) {
        console.error("Failed to update user:", updateError);
      }
    } else {
      console.error("Error creating user:", error);
    }
  }
  
  process.exit(0);
}

createAdminUser();