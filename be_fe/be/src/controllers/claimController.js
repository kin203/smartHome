const Device = require('../models/deviceModel');

// @desc    Get unclaimed devices (user: null)
// @route   GET /api/devices/unclaimed
// @access  Private
const getUnclaimedDevices = async (req, res) => {
    try {
        const devices = await Device.find({ user: null });
        res.json(devices);
    } catch (error) {
        console.error('Get unclaimed devices error:', error);
        res.status(500).json({ message: 'Failed to fetch unclaimed devices' });
    }
};

// @desc    Claim device by ID
// @route   POST /api/devices/claim/:deviceId
// @access  Private
const claimDevice = async (req, res) => {
    try {
        const device = await Device.findById(req.params.deviceId);

        if (!device) {
            return res.status(404).json({ message: 'Device not found' });
        }

        // Check if already claimed
        if (device.user && device.user.toString() !== req.user.id) {
            return res.status(403).json({
                message: 'Device already claimed by another user'
            });
        }

        device.user = req.user.id;
        await device.save();

        res.json({ device, message: 'Device claimed successfully' });
    } catch (error) {
        console.error('Claim device error:', error);
        res.status(500).json({ message: 'Failed to claim device' });
    }
};

// @desc    Claim device by MAC address
// @route   POST /api/devices/claim-by-mac
// @access  Private
const claimDeviceByMAC = async (req, res) => {
    let { mac } = req.body;

    if (!mac) {
        return res.status(400).json({ message: 'MAC address required' });
    }

    // Normalize MAC address
    mac = mac.toUpperCase().trim();

    try {
        const device = await Device.findOne({ mac });

        if (!device) {
            return res.status(404).json({ message: 'Device not found with this MAC address' });
        }

        // Check if already claimed by another user
        if (device.user && device.user.toString() !== req.user.id) {
            return res.status(403).json({
                message: 'Device already claimed by another user. Please contact the current owner to release it.'
            });
        }

        // Claim device
        device.user = req.user.id;
        await device.save();

        console.log(`Device ${mac} claimed by user ${req.user.id}`);
        res.json({ device, message: 'Device claimed successfully' });
    } catch (error) {
        console.error('Claim by MAC error:', error);
        res.status(500).json({ message: 'Failed to claim device' });
    }
};

// @desc    Release device (set user to null)
// @route   POST /api/devices/release/:deviceId
// @access  Private
const releaseDevice = async (req, res) => {
    try {
        const device = await Device.findById(req.params.deviceId);

        if (!device) {
            return res.status(404).json({ message: 'Device not found' });
        }

        // Check if user owns this device
        if (!device.user || device.user.toString() !== req.user.id) {
            return res.status(403).json({ message: 'You do not own this device' });
        }

        // Release device (set user to null)
        device.user = null;
        await device.save();

        console.log(`Device ${device.mac} released by user ${req.user.id}`);
        res.json({ message: 'Device released successfully. Other users can now claim it.' });
    } catch (error) {
        console.error('Release device error:', error);
        res.status(500).json({ message: 'Failed to release device' });
    }
};

module.exports = {
    getUnclaimedDevices,
    claimDevice,
    claimDeviceByMAC,
    releaseDevice
};
