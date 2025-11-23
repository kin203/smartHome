const express = require('express');
const router = express.Router();
const {
    checkCard,
    getDeviceCards,
    addCard,
    deleteCard,
    toggleCard
} = require('../controllers/rfidCardController');
const { protect } = require('../middleware/authMiddleware');

// Public route for ESP32 to check card authorization
router.post('/check', checkCard);

// Protected routes for web UI
router.get('/device/:deviceId', protect, getDeviceCards);
router.post('/', protect, addCard);
router.delete('/:cardId', protect, deleteCard);
router.patch('/:cardId/toggle', protect, toggleCard);

module.exports = router;
