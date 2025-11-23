const express = require('express');
const router = express.Router();
const { createAccessLog, getAccessLogs, getDeviceAccessLogs } = require('../controllers/accessLogController');
const { protect } = require('../middleware/authMiddleware');

// Public route for ESP32 to create logs
router.post('/', createAccessLog);

// Protected routes for web app
router.get('/', protect, getAccessLogs);
router.get('/device/:deviceId', protect, getDeviceAccessLogs);

module.exports = router;
