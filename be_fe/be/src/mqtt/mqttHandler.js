const mqtt = require('mqtt');
const Device = require('../models/deviceModel');

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

    client.on('message', async (topic, message) => {
        // Handle incoming status logic
        if (topic.startsWith('device/status/')) {
            const mac = topic.split('/').pop();
            try {
                const data = JSON.parse(message.toString());

                // Map Firmware JSON to DB Schema
                const updateFields = {
                    'sensorData.temp': data.temp,
                    'sensorData.humidity': data.hum,
                    'sensorData.gas': data.gas,
                    'sensorData.rain': (data.rain === 0 ? "Rain" : "No"),
                    'sensorData.light': data.light,
                    'sensorData.autoLight': data.autoLight,
                    'sensorData.autoMode': data.autoMode,
                    'sensorData.screenMode': data.screen,
                    'sensorData.lastUpdate': new Date()
                };

                // Update Status (Door/Led)
                if (data.door) {
                    updateFields.status = (data.door === "open" ? "on" : "off");
                }

                if (data.led1) updateFields['channels.0.status'] = (data.led1 === "on" ? "on" : "off");
                if (data.led2) updateFields['channels.1.status'] = (data.led2 === "on" ? "on" : "off");
                if (data.led3) updateFields['channels.2.status'] = (data.led3 === "on" ? "on" : "off");

                // Update DB
                await Device.findOneAndUpdate(
                    { mac: mac.toUpperCase() },
                    { $set: updateFields }
                );
                // console.log(`✅ Updated DB for ${mac}`);

            } catch (e) {
                console.error('Failed to parse MQTT payload:', e.message);
            }
        }
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
