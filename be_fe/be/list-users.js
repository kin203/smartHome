// List all users in database
const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/smarthome');

const User = require('./src/models/userModel');

const listUsers = async () => {
    try {
        const users = await User.find({}, 'name email createdAt');
        console.log('📋 Users in database:', users.length);
        users.forEach(u => {
            console.log(`  - ${u.email} (${u.name}) - Created: ${u.createdAt}`);
        });
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
};

listUsers();
