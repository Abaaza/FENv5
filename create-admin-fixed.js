const bcrypt = require('bcryptjs');
const { ConvexClient } = require('convex/browser');

async function createAdmin() {
  const client = new ConvexClient('https://lovely-armadillo-372.convex.cloud');
  
  try {
    const hashedPassword = await bcrypt.hash('abaza123', 10);
    
    // Create user with all required fields
    const result = await client.mutation('users:create', {
      email: 'abaza@tfp.com',
      password: hashedPassword,
      name: 'Admin User',
      role: 'admin',
      isActive: true,
      isApproved: true  // Added the required field
    });
    
    console.log('Admin user created successfully!');
    console.log('Email: abaza@tfp.com');
    console.log('Password: abaza123');
    console.log('User ID:', result);
  } catch (error) {
    console.error('Error:', error.message);
    
    // If user exists, try to get and update
    if (error.message?.includes('already exists')) {
      console.log('Attempting to update existing user...');
      try {
        const users = await client.query('users:list');
        const existingUser = users.find(u => u.email === 'abaza@tfp.com');
        
        if (existingUser) {
          console.log('Found existing user:', existingUser.email);
          console.log('User is admin:', existingUser.role === 'admin');
          console.log('User is approved:', existingUser.isApproved);
        }
      } catch (e) {
        console.error('Could not query users:', e);
      }
    }
  }
  
  process.exit(0);
}

createAdmin();