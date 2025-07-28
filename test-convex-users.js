import { ConvexHttpClient } from "convex/browser";
import bcrypt from 'bcryptjs';

// Production Convex URL
const CONVEX_URL = "https://determined-gazelle-449.convex.cloud";

async function testUsers() {
  const client = new ConvexHttpClient(CONVEX_URL);
  
  console.log("Testing Convex user operations...");
  
  try {
    // Try to get user by email
    console.log("\n1. Checking if user exists...");
    const existingUser = await client.query(({ db }, { email }) => 
      db.query("users").filter(q => q.eq(q.field("email"), email)).first(),
      { email: "abaza@tfp.com" }
    );
    
    if (existingUser) {
      console.log("✅ User found:");
      console.log(`   Name: ${existingUser.name}`);
      console.log(`   Email: ${existingUser.email}`);
      console.log(`   Role: ${existingUser.role}`);
      console.log(`   Approved: ${existingUser.isApproved}`);
    } else {
      console.log("❌ User not found");
      
      // Try to create user
      console.log("\n2. Creating user...");
      const hashedPassword = await bcrypt.hash('abaza123', 10);
      
      const newUser = await client.mutation(({ db }, userData) => {
        return db.insert("users", userData);
      }, {
        email: 'abaza@tfp.com',
        password: hashedPassword,
        name: 'Abaza TFP',
        role: 'admin',
        isApproved: true,
        isActive: true,
        createdAt: Date.now()
      });
      
      console.log("✅ User created:", newUser);
    }
    
  } catch (error) {
    console.error("Error:", error.message);
    
    // If direct access fails, provide manual instructions
    console.log("\n📝 Manual User Creation Steps:");
    console.log("1. Go to https://dashboard.convex.dev");
    console.log("2. Select the production deployment");
    console.log("3. Go to Data tab > users table");
    console.log("4. Click 'Add Document'");
    console.log("5. Add the following fields:");
    
    const hashedPassword = await bcrypt.hash('abaza123', 10);
    console.log(`
{
  "email": "abaza@tfp.com",
  "password": "${hashedPassword}",
  "name": "Abaza TFP",
  "role": "admin",
  "isApproved": true,
  "isActive": true,
  "createdAt": ${Date.now()}
}
    `);
  }
}

testUsers();