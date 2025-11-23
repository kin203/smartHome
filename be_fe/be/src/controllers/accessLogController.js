const AccessLog = require('../models/accessLogModel');
const Device = require('../models/deviceModel');

// @desc    Create access log (from ESP32)
// @route   POST /api/access-logs
// @access  Public (ESP32 doesn't have JWT)
const createAccessLog = async (req, res) => {
    let { deviceMac, cardUID, accessGranted } = req.body;

    // Normalize MAC address to uppercase and trim whitespace
    if (deviceMac) {
        deviceMac = deviceMac.toUpperCase().trim();
    }

    try {
        // Find device by MAC address
        const device = await Device.findOne({ mac: deviceMac });
        if (!device) {
            console.log(`Device not found for MAC: ${deviceMac}`);
            return res.status(404).json({ message: 'Device not found' });
        }

        const accessLog = await AccessLog.create({
            device: device._id,
            cardUID,
            accessGranted,
            timestamp: new Date(),
        });

        res.status(201).json(accessLog);
    } catch (error) {
        console.error('Create access log error:', error);
        res.status(500).json({ message: 'Failed to create access log' });
    }
};

// @desc    Get all access logs
// @route   GET /api/access-logs
// @access  Private
const getAccessLogs = async (req, res) => {
    try {
        const { limit = 50, skip = 0 } = req.query;

        const logs = await AccessLog.find()
            .populate('device', 'name type')
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip));

        const total = await AccessLog.countDocuments();

        res.json({ logs, total });
    } catch (error) {
        console.error('Get access logs error:', error);
        res.status(500).json({ message: 'Failed to fetch access logs' });
    }
};

// @desc    Get access logs for specific device
// @route   GET /api/access-logs/device/:deviceId
// @access  Private
const getDeviceAccessLogs = async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { limit = 50, skip = 0 } = req.query;

        const logs = await AccessLog.find({ device: deviceId })
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip));

        const total = await AccessLog.countDocuments({ device: deviceId });

        res.json({ logs, total });
    } catch (error) {
        console.error('Get device access logs error:', error);
        res.status(500).json({ message: 'Failed to fetch device access logs' });
    }
};

module.exports = { createAccessLog, getAccessLogs, getDeviceAccessLogs };
