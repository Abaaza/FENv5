import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex/_generated/api.js";
import bcrypt from 'bcryptjs';

// Production Convex URL
const CONVEX_URL = "https://determined-gazelle-449.convex.cloud";

async function checkUser() {
  const client = new ConvexHttpClient(CONVEX_URL);
  
  console.log("Checking for user in production Convex...");
  
  try {
    // Use the defined API function
    const user = await client.query(api.users.getByEmail, { email: "abaza@tfp.com" });
    
    if (user) {
      console.log("✅ User found:");
      console.log(`   Name: ${user.name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Approved: ${user.isApproved}`);
      console.log(`   Active: ${user.isActive}`);
      
      // Test password
      console.log("\nTesting password...");
      const passwordMatch = await bcrypt.compare('abaza123', user.password);
      console.log(`   Password match: ${passwordMatch ? '✅' : '❌'}`);
      
      if (!passwordMatch) {
        console.log("\n⚠️  Password doesn't match. The hash for 'abaza123' should be:");
        const correctHash = await bcrypt.hash('abaza123', 10);
        console.log(`   ${correctHash}`);
      }
    } else {
      console.log("❌ User not found");
      
      console.log("\nTo create the user:");
      console.log("1. You can use the backend API (if it has a registration endpoint)");
      console.log("2. Or manually add through Convex dashboard");
      
      const hashedPassword = await bcrypt.hash('abaza123', 10);
      console.log("\nUser data for manual creation in Convex dashboard:");
      console.log(JSON.stringify({
        email: "abaza@tfp.com",
        password: hashedPassword,
        name: "Abaza TFP",
        role: "admin",
        isApproved: true,
        isActive: true,
        createdAt: Date.now()
      }, null, 2));
    }
    
  } catch (error) {
    console.error("Error:", error.message);
    
    // Provide alternative approach
    console.log("\n📝 Alternative: Create user via backend seed script");
    console.log("Add this to your backend and run it:");
    
    const hashedPassword = await bcrypt.hash('abaza123', 10);
    console.log(`
// seed-user.js
const { getConvexClient } = require('./dist/config/convex');
const { api } = require('./dist/lib/convex-api');
const bcrypt = require('bcryptjs');

async function seedUser() {
  const convex = getConvexClient();
  
  const hashedPassword = await bcrypt.hash('abaza123', 10);
  
  const userId = await convex.mutation(api.users.create, {
    email: 'abaza@tfp.com',
    password: hashedPassword,
    name: 'Abaza TFP',
    role: 'admin',
    isApproved: true,
    isActive: true,
    createdAt: Date.now()
  });
  
  console.log('User created:', userId);
}

seedUser().catch(console.error);
    `);
  }
}

checkUser();