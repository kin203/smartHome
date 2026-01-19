const mqtt = require('mqtt');

// HiveMQ Cloud Credentials
const MQTT_HOST = '678449c3ad964efd8f7099eb6f54a138.s1.eu.hivemq.cloud';
const MQTT_PORT = 8883;
const MQTT_USER = 'nk203';
const MQTT_PASS = 'Nk2032003@';

let client = null;

const setupMQTT = () => {
    const connectUrl = `mqtts://${MQTT_HOST}:${MQTT_PORT}`;

    console.log(`Connecting to MQTT Broker: ${MQTT_HOST}...`);

    client = mqtt.connect(connectUrl, {
        username: MQTT_USER,
        password: MQTT_PASS,
        rejectUnauthorized: false // HiveMQ certificates usually trusted, but false is safer for quick setup
    });

    client.on('connect', () => {
        console.log('✅ Connected to HiveMQ Cloud');
        // Subscribe to all device statuses
        client.subscribe('device/status/#', (err) => {
            if (!err) {
                console.log('📡 Subscribed to device/status/#');
            }
        });
    });

    client.on('error', (err) => {
        console.error('❌ MQTT Connection Error:', err);
    });

    client.on('message', (topic, message) => {
        // console.log(`MSG on ${topic}: ${message.toString()}`);
        // Handle incoming status logic if needed (e.g. update DB online status)
    });
};

// Helper: Send Command to Device
const sendCommandToDevice = (deviceMac, commandObj) => {
    if (!client || !client.connected) {
        console.error('⚠️ cannot send command: MQTT not connected');
        return;
    }

    const topic = `cmd/${deviceMac}`;
    const payload = JSON.stringify(commandObj);

    client.publish(topic, payload, { qos: 1 }, (err) => {
        if (err) {
            console.error('MQTT Publish Error:', err);
        } else {
            console.log(`🚀 CMD Sent to ${topic}: ${payload}`);
        }
    });
};

module.exports = { setupMQTT, sendCommandToDevice };
