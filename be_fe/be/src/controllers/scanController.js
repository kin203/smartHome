const axios = require('axios');
const os = require('os');

// Get local IP subnet
const getLocalSubnet = () => {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Skip internal and non-IPv4 addresses
            if (iface.family === 'IPv4' && !iface.internal) {
                const parts = iface.address.split('.');
                return `${parts[0]}.${parts[1]}.${parts[2]}`;
            }
        }
    }
    return '192.168.1'; // fallback
};

// @desc    Scan for devices on local network
// @route   GET /api/scan
// @access  Private
const scanNetwork = async (req, res) => {
    const subnet = getLocalSubnet();
    console.log(`Scanning subnet: ${subnet}.x`);

    const foundDevices = [];

    // Try mDNS first
    try {
        const response = await axios.get('http://esp32-smart-home.local/scan', { timeout: 1000 });
        if (response.data && response.data.id === 'esp32-smart-home') {
            foundDevices.push({ ...response.data, ip: response.data.ip || 'esp32-smart-home.local' });
        }
    } catch (e) {
        // mDNS failed, continue with IP scan
    }

    // Scan subnet (parallel requests for speed)
    const promises = [];
    for (let i = 2; i < 255; i++) {
        const ip = `${subnet}.${i}`;
        promises.push(
            axios.get(`http://${ip}/scan`, { timeout: 300 })
                .then(response => {
                    if (response.data && response.data.id === 'esp32-smart-home') {
                        return { ...response.data, ip: response.data.ip || ip };
                    }
                    return null;
                })
                .catch(() => null)
        );
    }

    try {
        const results = await Promise.all(promises);
        const devices = results.filter(d => d !== null);
        foundDevices.push(...devices);

        // Ensure all devices have an IP
        const validDevices = foundDevices.filter(d => d && d.ip);

        // Remove duplicates by IP
        const uniqueDevices = Array.from(new Map(validDevices.map(d => [d.ip, d])).values());

        console.log(`Found ${uniqueDevices.length} device(s)`);
        res.json(uniqueDevices);
    } catch (error) {
        console.error('Scan error:', error.message);
        res.status(500).json({ message: 'Scan failed' });
    }
};

// @desc    Add device by IP manually
// @route   POST /api/scan/manual
// @access  Private
const addByIP = async (req, res) => {
    const { ip } = req.body;

    if (!ip) {
        return res.status(400).json({ message: 'IP address required' });
    }

    try {
        const response = await axios.get(`http://${ip}/scan`, { timeout: 2000 });
        if (response.data && response.data.id === 'esp32-smart-home') {
            res.json({ ...response.data, ip: response.data.ip || ip });
        } else {
            res.status(404).json({ message: 'ESP32 device not found at this IP' });
        }
    } catch (error) {
        console.error('Manual add error:', error.message);
        res.status(500).json({ message: 'Failed to connect to device' });
    }
};

module.exports = { scanNetwork, addByIP };
