const mongoose = require('mongoose');

const rfidCardSchema = new mongoose.Schema({
    cardUID: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    cardName: {
        type: String,
        required: true,
        trim: true
    },
    device: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Device',
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Index for fast lookup
rfidCardSchema.index({ device: 1, cardUID: 1 });
rfidCardSchema.index({ device: 1, isActive: 1 });

module.exports = mongoose.model('RFIDCard', rfidCardSchema);
