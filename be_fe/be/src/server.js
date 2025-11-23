const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

dotenv.config();

connectDB();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use('/api/users', require('./routes/authRoutes'));
app.use('/api/devices', require('./routes/deviceRoutes'));
app.use('/api/access-logs', require('./routes/accessLogRoutes'));
app.use('/api/rfid-cards', require('./routes/rfidCardRoutes'));


const { scanNetwork, addByIP } = require('./controllers/scanController');
const { controlDevice, getDeviceStatus } = require('./controllers/proxyController');
const { protect } = require('./middleware/authMiddleware');

app.get('/api/scan', protect, scanNetwork);
app.post('/api/scan/manual', protect, addByIP);
app.post('/api/control', protect, controlDevice);
app.get('/api/status/:deviceId', protect, getDeviceStatus);




app.get('/', (req, res) => {
    res.send('API is running...');
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Internal Server Error', error: err.message });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
