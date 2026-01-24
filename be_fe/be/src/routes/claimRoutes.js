const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
    getUnclaimedDevices,
    claimDevice,
    claimDeviceByMAC,
    releaseDevice
} = require('../controllers/claimController');

// Get all unclaimed devices
router.get('/unclaimed', protect, getUnclaimedDevices);

// Claim device by ID
router.post('/claim/:deviceId', protect, claimDevice);

// Claim device by MAC address
router.post('/claim-by-mac', protect, claimDeviceByMAC);

// Release device (set user to null)
router.post('/release/:deviceId', protect, releaseDevice);

module.exports = router;
