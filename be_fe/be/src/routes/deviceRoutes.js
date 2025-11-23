const express = require('express');
const router = express.Router();
const {
    getDevices,
    createDevice,
    updateDevice,
    deleteDevice,
} = require('../controllers/deviceController');
const { registerDevice } = require('../controllers/deviceRegisterController');
const { protect } = require('../middleware/authMiddleware');

// Public route for auto-registration (MUST be before /:id)
router.post('/register', registerDevice);

router.route('/').get(protect, getDevices).post(protect, createDevice);
router.route('/:id').put(protect, updateDevice).delete(protect, deleteDevice);

module.exports = router;
