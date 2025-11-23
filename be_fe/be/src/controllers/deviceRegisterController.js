const Device = require('../models/deviceModel');

// @desc    Auto-register device by MAC address (called by ESP32 on boot)
// @route   POST /api/devices/register
// @access  Public (ESP32 doesn't have JWT)
const registerDevice = async (req, res) => {
    let { mac, ip, name } = req.body;

    // Normalize MAC address to uppercase and trim whitespace
    if (mac) {
        mac = mac.toUpperCase().trim();
    }

    try {
        // Find existing device by MAC
        let device = await Device.findOne({ mac });

        if (device) {
            // Device exists by MAC - update IP and FW version
            device.ip = ip;
            if (req.body.firmwareVersion) device.firmwareVersion = req.body.firmwareVersion;
            if (name) device.name = name;
            await device.save();
            console.log(`Device ${mac} updated with IP ${ip}`);
            return res.json({ device, message: 'Device updated' });
        }

        // If not found by MAC, try finding by IP (to merge with manually added devices)
        device = await Device.findOne({ ip });
        if (device) {
            console.log(`Found existing device by IP ${ip}. Updating MAC to ${mac}`);
            device.mac = mac;
            if (req.body.firmwareVersion) device.firmwareVersion = req.body.firmwareVersion;
            if (name) device.name = name;
            await device.save();
            return res.json({ device, message: 'Device linked to MAC' });
        }

        // Create new device (assign to first user for now)
        const User = require('../models/userModel');
        const firstUser = await User.findOne();

        if (!firstUser) {
            return res.status(500).json({ message: 'No users found. Please create a user first.' });
        }

        device = await Device.create({
            user: firstUser._id,
            name: name || `ESP32-${mac.substring(mac.length - 8)}`,
            type: 'Other',
            ip,
            mac,
            status: 'online'
        });

        console.log(`New device registered: ${mac}`);
        res.status(201).json({ device, message: 'Device registered' });
    } catch (error) {
        console.error('Register device error:', error);
        res.status(500).json({ message: 'Failed to register device' });
    }
};

module.exports = { registerDevice };
