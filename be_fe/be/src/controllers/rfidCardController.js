const RFIDCard = require('../models/rfidCardModel');
const Device = require('../models/deviceModel');

// @desc    Check if RFID card is authorized (called by ESP32)
// @route   POST /api/rfid-cards/check
// @access  Public (ESP32 doesn't have JWT)
const checkCard = async (req, res) => {
    let { deviceMac, cardUID } = req.body;

    // Normalize MAC address to uppercase and trim whitespace
    if (deviceMac) {
        deviceMac = deviceMac.toUpperCase().trim();
    }

    try {
        // Find device by MAC address
        const device = await Device.findOne({ mac: deviceMac });

        if (!device) {
            console.log(`Device not found for MAC: ${deviceMac}`);
            return res.json({ authorized: false, cardName: null });
        }

        // Find active card for this device
        const card = await RFIDCard.findOne({
            device: device._id,
            cardUID: cardUID.toUpperCase(),
            isActive: true
        });

        res.json({
            authorized: !!card,
            cardName: card ? card.cardName : null
        });
    } catch (error) {
        console.error('Check card error:', error);
        res.status(500).json({ authorized: false, error: 'Failed to check card' });
    }
};

// @desc    Get all RFID cards for a device
// @route   GET /api/rfid-cards/device/:deviceId
// @access  Private
const getDeviceCards = async (req, res) => {
    try {
        const { deviceId } = req.params;

        const cards = await RFIDCard.find({ device: deviceId })
            .sort({ createdAt: -1 });

        res.json({ cards });
    } catch (error) {
        console.error('Get cards error:', error);
        res.status(500).json({ message: 'Failed to fetch cards' });
    }
};

// @desc    Add new RFID card
// @route   POST /api/rfid-cards
// @access  Private
const addCard = async (req, res) => {
    const { deviceId, cardUID, cardName } = req.body;

    try {
        // Verify device exists
        const device = await Device.findById(deviceId);
        if (!device) {
            return res.status(404).json({ message: 'Device not found' });
        }

        // Check if card already exists
        const existing = await RFIDCard.findOne({ cardUID: cardUID.toUpperCase() });
        if (existing) {
            // Card exists - update to new device (in case device was re-added)
            existing.device = deviceId;
            existing.cardName = cardName;
            existing.isActive = true;
            await existing.save();
            console.log(`Card ${cardUID} reassigned to device ${deviceId}`);
            return res.status(200).json(existing);
        }

        const card = await RFIDCard.create({
            device: deviceId,
            cardUID: cardUID.toUpperCase(),
            cardName,
            isActive: true
        });

        res.status(201).json(card);
    } catch (error) {
        console.error('Add card error:', error);
        res.status(500).json({ message: 'Failed to add card' });
    }
};

// @desc    Delete RFID card
// @route   DELETE /api/rfid-cards/:cardId
// @access  Private
const deleteCard = async (req, res) => {
    try {
        const card = await RFIDCard.findById(req.params.cardId);

        if (!card) {
            return res.status(404).json({ message: 'Card not found' });
        }

        await card.deleteOne();
        res.json({ message: 'Card removed' });
    } catch (error) {
        console.error('Delete card error:', error);
        res.status(500).json({ message: 'Failed to delete card' });
    }
};

// @desc    Toggle card active status
// @route   PATCH /api/rfid-cards/:cardId/toggle
// @access  Private
const toggleCard = async (req, res) => {
    try {
        const card = await RFIDCard.findById(req.params.cardId);

        if (!card) {
            return res.status(404).json({ message: 'Card not found' });
        }

        card.isActive = !card.isActive;
        await card.save();

        res.json(card);
    } catch (error) {
        console.error('Toggle card error:', error);
        res.status(500).json({ message: 'Failed to toggle card' });
    }
};

module.exports = {
    checkCard,
    getDeviceCards,
    addCard,
    deleteCard,
    toggleCard
};
