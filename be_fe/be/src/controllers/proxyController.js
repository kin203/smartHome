const axios = require('axios');
const Device = require('../models/deviceModel');

// @desc    Control a device via proxy
// @route   POST /api/control
// @access  Private
const controlDevice = async (req, res) => {
    const { deviceId, device, action, value, channel } = req.body;

    try {
        const deviceDoc = await Device.findById(deviceId);
        if (!deviceDoc) {
            return res.status(404).json({ message: 'Device not found' });
        }

        if (!deviceDoc.ip) {
            return res.status(400).json({ message: 'Device IP not configured' });
        }

        // Construct payload for ESP32
        const payload = { device, action };
        if (value !== undefined) {
            payload.value = value;
        }
        if (channel !== undefined) {
            payload.channel = channel;
        }

        const response = await axios.post(`http://${deviceDoc.ip}/control`, payload, { timeout: 2000 });

        // Update device status in DB if successful
        if (response.status === 200) {
            if (device === 'door' || device === 'servo') {
                deviceDoc.status = action === 'open' ? 'on' : 'off';
            }
            await deviceDoc.save();
        }

        res.json(response.data);
    } catch (error) {
        console.error('Proxy error:', error.message);
        res.status(500).json({ message: 'Failed to communicate with device' });
    }
};

// @desc    Get device status from ESP32
// @route   GET /api/status/:deviceId
// @access  Private
const getDeviceStatus = async (req, res) => {
    const { deviceId } = req.params;

    try {
        const device = await Device.findById(deviceId);
        if (!device) {
            return res.status(404).json({ message: 'Device not found' });
        }

        if (!device.ip) {
            return res.status(400).json({ message: 'Device IP not configured' });
        }

        const response = await axios.get(`http://${device.ip}/status`, { timeout: 3000 });
        res.json(response.data);
    } catch (error) {
        console.error(`Status error for ${deviceId}:`, error.message);
        if (error.code === 'ECONNABORTED') {
            return res.status(504).json({ message: 'Device timeout' });
        }
        if (error.code === 'ECONNREFUSED') {
            return res.status(502).json({ message: 'Device unreachable' });
        }
        res.status(500).json({ message: 'Failed to get device status' });
    }
};

module.exports = { controlDevice, getDeviceStatus };
