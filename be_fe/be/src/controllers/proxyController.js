const axios = require('axios');
const Device = require('../models/deviceModel');

// @desc    Control a device via proxy
// @route   POST /api/control
// @access  Private
const { sendCommandToDevice } = require('../mqtt/mqttHandler');

// @desc    Control a device via proxy (HTTP or MQTT)
// @route   POST /api/control
// @access  Private
const controlDevice = async (req, res) => {
    const { deviceId, device, action, value, channel } = req.body;

    try {
        const deviceDoc = await Device.findById(deviceId);
        if (!deviceDoc) {
            return res.status(404).json({ message: 'Device not found' });
        }

        // Construct payload for ESP32
        const payload = { device, action };
        if (value !== undefined) {
            payload.value = value;
        }
        if (channel !== undefined) {
            payload.channel = channel;
        }

        // --- NEW: MQTT Control ---
        // We use MQTT by default for robust remote control.
        // The ESP32 subscribes to 'cmd/<MAC_ADDRESS>'
        if (deviceDoc.mac) {
            const macCompact = deviceDoc.mac.replace(/:/g, '').toUpperCase(); // Ensure format matches ESP32 expectation
            // Actually my firmware code uses colon-separated MAC in topics usually? 
            // Let's check firmware code. Main.cpp uses `deviceMac` which has colons.
            // So topic is `cmd/AA:BB:CC:DD:EE:FF`.

            sendCommandToDevice(deviceDoc.mac, payload);

            // Optimistically update DB status for immediate UI feedback
            if (device === 'door') {
                deviceDoc.status = action === 'open' ? 'on' : 'off';
                await deviceDoc.save();
            }

            return res.json({ success: true, message: 'Command sent via MQTT', payload });
        }

        // Fallback to HTTP if no MAC (Legacy or Local-only fallback)
        if (!deviceDoc.ip) {
            return res.status(400).json({ message: 'Device IP/MAC not configured' });
        }

        const response = await axios.post(`http://${deviceDoc.ip}/control`, payload, { timeout: 3000 });
        res.json(response.data);

    } catch (error) {
        console.error('Control error:', error.message);
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

        // Return generic/cached status from DB instead of polling device IP
        // (Since Cloud Backend cannot reach Device IP)
        res.json({
            id: device.mac || 'unknown',
            door: device.status === 'on' ? 'open' : 'closed',
            temp: device.sensorData?.temp,
            temperature: device.sensorData?.temp, // Alias for UI compatibility
            humidity: device.sensorData?.humidity,
            gas: device.sensorData?.gas,
            rain: device.sensorData?.rain,
            autoLight: device.sensorData?.autoLight,
            screenMode: device.sensorData?.screenMode,
            uptime: 9999,
            wifi: -50,
            ip: device.ip,
            message: "Status from Cloud DB"
        });
    } catch (error) {
        console.error(`Status error for ${deviceId}:`, error.message);
        res.status(500).json({ message: 'Failed to get device status' });
    }
};

module.exports = { controlDevice, getDeviceStatus };
