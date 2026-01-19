const mongoose = require('mongoose');

const deviceSchema = mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User',
        },
        name: {
            type: String,
            required: [true, 'Please add a device name'],
        },
        type: {
            type: String,
            required: [true, 'Please add a device type'],
            enum: ['Light', 'Fan', 'Sensor', 'Switch', 'Other', 'Servo', 'Buzzer', 'Hub'],
            default: 'Other',
        },
        room: {
            type: String,
            default: 'Living Room',
        },
        channels: [{
            index: Number,
            name: String,
            room: String,
            status: {
                type: String,
                default: 'off'
            }
        }],
        status: {
            type: String,
            default: 'off',
        },
        settings: {
            type: Map,
            of: String,
        },
        mac: {
            type: String,
            unique: true,
            sparse: true,
            uppercase: true, // Auto-convert to uppercase
            trim: true, // Remove whitespace
        },
        firmwareVersion: {
            type: String,
        },
        settingsPassword: {
            type: String,
        },
        ip: {
            type: String,
        },
        sensorData: {
            temp: Number,
            humidity: Number,
            gas: Number,
            rain: String,
            light: Number,
            autoLight: Boolean, // Light State (On/Off)
            autoMode: Boolean,  // Automation Mode (Enable/Disable)
            screenMode: Number,
            lastUpdate: Date
        }
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Device', deviceSchema);
