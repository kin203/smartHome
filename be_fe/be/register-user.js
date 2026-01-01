const axios = require('axios');

// Configuration
const API_URL = 'http://localhost:5000/api/users';
const userData = {
    name: 'Admin',
    email: 'admin@smarthome.com',
    password: 'admin123'
};

async function registerUser() {
    try {
        console.log('Registering new user...');
        const response = await axios.post(API_URL, userData);

        console.log('\n✅ User registered successfully!');
        console.log('\n📋 User Details:');
        console.log('Name:', response.data.name);
        console.log('Email:', response.data.email);
        console.log('\n🔑 Token:', response.data.token);
        console.log('\nSave this token for authentication!');

    } catch (error) {
        console.error('\n❌ Error registering user:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Message:', error.response.data.message || error.response.data);
        } else {
            console.error(error.message);
        }
    }
}

registerUser();
