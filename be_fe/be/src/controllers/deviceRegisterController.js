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

        // Create new device as UNCLAIMED (user: null)
        // Users can claim this device later via /api/devices/claim-by-mac
        device = await Device.create({
            user: null, // Unclaimed - waiting for user to claim
            name: name || `ESP32-${mac.substring(mac.length - 8)}`,
            type: 'Hub',
            ip,
            mac,
            status: 'online',
            firmwareVersion: req.body.firmwareVersion
        });

        console.log(`New unclaimed device registered: ${mac}`);
        res.status(201).json({ device, message: 'Device registered as unclaimed' });
    } catch (error) {
        console.error('Register device error:', error);
        res.status(500).json({ message: 'Failed to register device' });
    }
};

module.exports = { registerDevice };
