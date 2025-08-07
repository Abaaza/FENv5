// Script to create admin user for The Fencing People
import { ConvexClient } from "convex/browser";
import bcrypt from "bcryptjs";

// Your Convex URL
const client = new ConvexClient("https://bright-scorpion-424.convex.cloud");

async function createAdminUser() {
  try {
    console.log("Connecting to Convex...");
    
    // First, let's just try to create the user with plain password
    // The backend should hash it
    const userId = await client.mutation(api => api.users.create, {
      email: "abaza@tfp.com",
      password: "abaza123", // Backend will hash this
      name: "Abaza Admin",
      company: "The Fencing People", 
      role: "admin"
    });
    
    console.log("Admin user created successfully with ID:", userId);
  } catch (error) {
    console.error("Error creating user:", error.message);
    
    // Try alternate approach - direct HTTP request to your backend
    console.log("\nTrying direct HTTP request to backend...");
    
    try {
      const response = await fetch("http://44.223.70.138:5000/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "abaza@tfp.com",
          password: "abaza123",
          name: "Abaza Admin",
          company: "The Fencing People",
          role: "admin"
        })
      });
      
      const result = await response.json();
      console.log("Backend response:", result);
      
      if (result.token) {
        console.log("✅ User created successfully!");
      }
    } catch (httpError) {
      console.error("HTTP request failed:", httpError.message);
    }
  } finally {
    await client.close();
  }
}

// Run the function
createAdminUser().then(() => {
  console.log("\nScript completed");
  process.exit(0);
}).catch(err => {
  console.error("Script failed:", err);
  process.exit(1);
});