import { ConvexClient } from "convex/browser";
import bcrypt from 'bcryptjs';

// Production Convex URL
const CONVEX_URL = "https://determined-gazelle-449.convex.cloud";

async function createUser() {
  const client = new ConvexClient(CONVEX_URL);
  
  console.log("Creating user in production Convex...");
  
  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash('abaza123', 10);
    
    // Create user data
    const userData = {
      email: 'abaza@tfp.com',
      password: hashedPassword,
      name: 'Abaza TFP',
      role: 'admin',
      isApproved: true,
      isActive: true,
      createdAt: Date.now()
    };
    
    console.log("User data prepared:");
    console.log(`  Email: ${userData.email}`);
    console.log(`  Name: ${userData.name}`);
    console.log(`  Role: ${userData.role}`);
    console.log(`  Password hash: ${hashedPassword.substring(0, 20)}...`);
    
    // Note: We can't directly create users from outside the backend
    // The backend needs to handle user creation through its API
    
    console.log("\nTo create this user, you need to:");
    console.log("1. Use the backend's user creation endpoint");
    console.log("2. Or manually add through Convex dashboard");
    console.log("3. Or create a seed script in the backend");
    
    console.log("\nUser data for manual creation:");
    console.log(JSON.stringify(userData, null, 2));
    
  } catch (error) {
    console.error("Error:", error);
  }
}

createUser();