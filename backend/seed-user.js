// Seed script to create admin user
require('dotenv').config();
const bcrypt = require('bcryptjs');

// Set required environment variables
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "tfp-boq-matching-access-secret-key-2025-secure";
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "tfp-boq-matching-refresh-secret-key-2025-secure";
// Force production Convex URL
process.env.CONVEX_URL = "https://determined-gazelle-449.convex.cloud";

const { getConvexClient } = require('./dist/config/convex');
const { api } = require('./dist/lib/convex-api');

async function seedUser() {
  try {
    console.log('Connecting to Convex...');
    console.log('Convex URL:', process.env.CONVEX_URL);
    
    const convex = getConvexClient();
    
    // Check if user already exists
    console.log('Checking if user exists...');
    const existingUser = await convex.query(api.users.getByEmail, { 
      email: 'abaza@tfp.com' 
    });
    
    if (existingUser) {
      console.log('User already exists:', {
        email: existingUser.email,
        name: existingUser.name,
        role: existingUser.role
      });
      return;
    }
    
    // Hash password
    console.log('Creating new user...');
    const hashedPassword = await bcrypt.hash('abaza123', 10);
    
    // Create user
    const userId = await convex.mutation(api.users.create, {
      email: 'abaza@tfp.com',
      password: hashedPassword,
      name: 'Abaza TFP',
      role: 'admin',
      isApproved: true,
      isActive: true,
      createdAt: Date.now()
    });
    
    console.log('✅ User created successfully!');
    console.log('User ID:', userId);
    console.log('Email: abaza@tfp.com');
    console.log('Password: abaza123');
    console.log('Role: admin');
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

seedUser();