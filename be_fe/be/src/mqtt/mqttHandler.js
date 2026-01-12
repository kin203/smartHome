const aedes = require('aedes')();
const server = require('net').createServer(aedes.handle);
const Device = require('../models/deviceModel');

const MQTT_PORT = 1883; // Standard MQTT port

// Store connected clients for debugging
const clients = new Map();

const setupMQTT = (httpServer) => {
    // Start MQTT Broker
    server.listen(MQTT_PORT, () => {
        console.log(`✅ MQTT Broker started on port ${MQTT_PORT}`);
    });

    // Client Connected
    aedes.on('client', (client) => {
        console.log(`🔌 MQTT Client Connected: ${client ? client.id : client}`);
        clients.set(client.id, client);
    });

    // Client Disconnected
    aedes.on('clientDisconnect', (client) => {
        console.log(`❌ MQTT Client Disconnected: ${client ? client.id : client}`);
        clients.delete(client.id);

        // Update device status to offline in DB
        if (client && client.id) {
            markDeviceOffline(client.id);
        }
    });

    // Publish (logging)
    aedes.on('publish', async (packet, client) => {
        if (client) {
            // console.log(`Client ${client.id} published to ${packet.topic}: ${packet.payload.toString()}`);
            if (packet.topic.startsWith('device/status/')) {
                // Handle status updates from device
                const deviceId = client.id; // Assuming ClientID is the Device MAC or ID
                try {
                    const statusData = JSON.parse(packet.payload.toString());
                    // Logic to update device status in real-time or cache it
                    // For now, we mainly use this to confirm it's alive
                } catch (e) {
                    console.error('Failed to parse status payload');
                }
            }
        }
    });
};

// Helper: Mark device offline
const markDeviceOffline = async (clientId) => {
    // Logic to update DB status if we were tracking "online" state strictly 
    // For now, just logging
};

// Helper: Send Command to Device
const sendCommandToDevice = (deviceMac, commandObj) => {
    const topic = `cmd/${deviceMac}`;
    const payload = JSON.stringify(commandObj);

    // Publish to the topic
    aedes.publish({
        topic: topic,
        payload: payload,
        qos: 1,
        retain: false
    }, (err) => {
        if (err) {
            console.error('MQTT Publish Error:', err);
        } else {
            console.log(`🚀 CMD Sent to ${topic}: ${payload}`);
        }
    });
};

module.exports = { setupMQTT, sendCommandToDevice };
