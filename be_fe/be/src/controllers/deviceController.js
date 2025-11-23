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

    const device = await Device.create({
        name: req.body.name,
        type: req.body.type,
        user: req.user.id,
        status: req.body.status,
        settings: req.body.settings,
        ip: req.body.ip,
    });


    res.status(200).json(device);
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
