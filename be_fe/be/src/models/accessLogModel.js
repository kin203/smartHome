const mongoose = require('mongoose');

const accessLogSchema = mongoose.Schema(
    {
        device: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'Device',
        },
        cardUID: {
            type: String,
            required: true,
        },
        accessGranted: {
            type: Boolean,
            required: true,
        },
        timestamp: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('AccessLog', accessLogSchema);
