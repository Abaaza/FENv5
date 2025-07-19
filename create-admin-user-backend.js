const axios = require('axios');
const bcrypt = require('bcryptjs');

async function createAdminUser() {
  try {
    // First, let's create the user directly via the backend API
    const response = await axios.post('https://54.90.3.22/api/auth/register', {
      email: 'abaza@tfp.com',
      password: 'abaza123',
      name: 'Admin User',
      role: 'admin'
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      // Ignore SSL certificate errors for self-signed cert
      httpsAgent: new (require('https').Agent)({
        rejectUnauthorized: false
      })
    });

    console.log('Admin user created successfully!');
    console.log('Email: abaza@tfp.com');
    console.log('Password: abaza123');
    console.log('Response:', response.data);
  } catch (error) {
    if (error.response?.status === 409) {
      console.log('User already exists!');
    } else {
      console.error('Error creating user:', error.response?.data || error.message);
    }
  }
}

// Run the function
createAdminUser();