const Device = require('../models/deviceModel');
const User = require('../models/userModel');

// @desc    Get devices
// @route   GET /api/devices
// @access  Private
const getDevices = async (req, res) => {
    const devices = await Device.find({ user: req.user.id });

    res.status(200).json(devices);
};

// @desc    Set device
// @route   POST /api/devices
// @access  Private
const createDevice = async (req, res) => {
    if (!req.body.name) {
        res.status(400).json({ message: 'Please add a text field' });
        return;
    }

    let mac = req.body.mac;
    if (mac) mac = mac.toUpperCase().trim();

    try {
        let device;

        // Check if device with this MAC already exists (e.g. from Auto-Register)
        if (mac) {
            device = await Device.findOne({ mac });
            if (device) {
                console.log(`Device found by MAC ${mac}. User ${req.user.id} claiming ownership.`);
                // Update existing device
                device.name = req.body.name;
                device.type = req.body.type;
                device.room = req.body.room || 'Living Room';
                device.user = req.user.id; // Assign to current user
                if (req.body.status) device.status = req.body.status;
                if (req.body.settings) device.settings = req.body.settings;
                device.ip = req.body.ip;

                // Init channels if missing (for legacy or fresh auto-reg devices)
                if ((req.body.type === 'Switch' || req.body.type === 'Other' || req.body.name.includes('Relay')) && (!device.channels || device.channels.length === 0)) {
                    const channels = [];
                    for (let i = 1; i <= 4; i++) {
                        channels.push({
                            index: i,
                            name: `Light ${i}`,
                            room: req.body.room || 'Living Room',
                            status: 'off'
                        });
                    }
                    device.channels = channels;
                }

                await device.save();
                return res.status(200).json(device);
            }
        }

        // If not found, create new
        device = await Device.create({
            name: req.body.name,
            type: req.body.type,
            room: req.body.room || 'Living Room',
            user: req.user.id,
            status: req.body.status,
            settings: req.body.settings,
            ip: req.body.ip,
            mac: mac // Save MAC!
        });

        if (req.body.type === 'Switch' || req.body.type === 'Other' || req.body.name.includes('Relay')) {
            const channels = [];
            for (let i = 1; i <= 4; i++) {
                channels.push({
                    index: i,
                    name: `Light ${i}`,
                    room: req.body.room || 'Living Room',
                    status: 'off'
                });
            }
            device.channels = channels;
            await device.save();
        }

        res.status(200).json(device);
    } catch (error) {
        console.error("Create device error:", error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update device
// @route   PUT /api/devices/:id
// @access  Private
const updateDevice = async (req, res) => {
    const device = await Device.findById(req.params.id);

    if (!device) {
        res.status(400).json({ message: 'Device not found' });
        return;
    }

    // Check for user
    if (!req.user) {
        res.status(401).json({ message: 'User not found' });
        return;
    }

    // Make sure the logged in user matches the device user
    if (device.user.toString() !== req.user.id) {
        res.status(401).json({ message: 'User not authorized' });
        return;
    }

    const updatedDevice = await Device.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
            new: true,
        }
    );

    res.status(200).json(updatedDevice);
};

// @desc    Delete device
// @route   DELETE /api/devices/:id
// @access  Private
const deleteDevice = async (req, res) => {
    const device = await Device.findById(req.params.id);

    if (!device) {
        res.status(400).json({ message: 'Device not found' });
        return;
    }

    // Check for user
    if (!req.user) {
        res.status(401).json({ message: 'User not found' });
        return;
    }

    // Make sure the logged in user matches the device user
    if (device.user.toString() !== req.user.id) {
        res.status(401).json({ message: 'User not authorized' });
        return;
    }

    await device.deleteOne();

    res.status(200).json({ id: req.params.id });
};

module.exports = {
    getDevices,
    createDevice,
    updateDevice,
    deleteDevice,
};
