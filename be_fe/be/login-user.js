const axios = require('axios');

const API_URL = 'http://localhost:5000/api/users/login';

const credentials = {
    email: 'admin@smarthome.com',
    password: 'admin123'
};

async function login() {
    try {
        console.log('🔐 Logging in...');
        const response = await axios.post(API_URL, credentials);

        console.log('\n✅ Login successful!');
        console.log('\n📋 User Details:');
        console.log('Name:', response.data.name);
        console.log('Email:', response.data.email);
        console.log('\n🔑 Your Auth Token:');
        console.log(response.data.token);
        console.log('\n💡 Use this token in your frontend or API calls:');
        console.log('Authorization: Bearer ' + response.data.token);

    } catch (error) {
        console.error('\n❌ Login failed:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Message:', error.response.data.message || error.response.data);
            console.error('\n💡 Make sure the server is running: npm start');
        } else if (error.code === 'ECONNREFUSED') {
            console.error('Cannot connect to server. Is it running on port 5000?');
            console.error('Run: npm start');
        } else {
            console.error(error.message);
        }
    }
}

login();
