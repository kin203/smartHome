const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

dotenv.config();

// Models
const User = require('./src/models/userModel');
const Device = require('./src/models/deviceModel');

const setupDatabase = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB Connected');

        // Create admin user
        const email = 'admin@smarthome.com';
        let user = await User.findOne({ email });

        if (!user) {
            user = await User.create({
                name: 'Admin',
                email: email,
                password: 'admin123'
            });
            console.log('✅ Admin user created');
            console.log('   Email:', email);
            console.log('   Password: admin123');
        } else {
            console.log('ℹ️  Admin user already exists');
        }

        // Check for devices
        const deviceCount = await Device.countDocuments();
        console.log(`\n📱 Found ${deviceCount} device(s) in database`);

        if (deviceCount > 0) {
            const devices = await Device.find();
            console.log('\nDevices:');
            devices.forEach(device => {
                console.log(`  - ${device.name} (MAC: ${device.mac || 'N/A'}, IP: ${device.ip || 'N/A'})`);
            });
        } else {
            console.log('ℹ️  No devices found. ESP32 will auto-register on next boot.');
        }

        console.log('\n✅ Database setup complete!');
        console.log('\n🔑 To get your auth token, run:');
        console.log('   node login-user.js');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
};

setupDatabase();
