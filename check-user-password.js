import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex/_generated/api.js";
import bcrypt from 'bcryptjs';

// Dev Convex URL
const CONVEX_URL = "https://lovely-armadillo-372.convex.cloud";

async function checkPassword() {
  const client = new ConvexHttpClient(CONVEX_URL);
  
  console.log("Checking user password in dev Convex...");
  
  try {
    const user = await client.query(api.users.getByEmail, { email: "abaza@tfp.com" });
    
    if (user) {
      console.log("User found:");
      console.log(`  Email: ${user.email}`);
      console.log(`  Name: ${user.name}`);
      console.log(`  Password hash: ${user.password.substring(0, 30)}...`);
      
      // Test different passwords
      const passwords = ['abaza123', 'password123', 'admin123', 'tfp123'];
      
      console.log("\nTesting passwords:");
      for (const pwd of passwords) {
        const match = await bcrypt.compare(pwd, user.password);
        console.log(`  ${pwd}: ${match ? '✅' : '❌'}`);
      }
      
      // Generate correct hash
      console.log("\nGenerating correct hash for 'abaza123':");
      const newHash = await bcrypt.hash('abaza123', 10);
      console.log(`  ${newHash}`);
      
      console.log("\nTo update the password in Convex:");
      console.log("1. Go to the Convex dashboard");
      console.log("2. Find the user document");
      console.log("3. Update the password field with the hash above");
      
    } else {
      console.log("User not found");
    }
    
  } catch (error) {
    console.error("Error:", error.message);
  }
}

checkPassword();