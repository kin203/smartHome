const express = require('express');
const router = express.Router();
const { registerDevice } = require('../controllers/deviceRegisterController');

// Public route for ESP32 auto-registration
router.post('/register', registerDevice);

module.exports = router;
