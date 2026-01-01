import { useState, useEffect, useContext } from 'react';
import axios from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import { useBackendStatus } from '../context/BackendStatusContext';
import DeviceCard from '../components/DeviceCard';
import AddDeviceModal from '../components/AddDeviceModal';
import DeviceDetailModal from '../components/DeviceDetailModal';

const Dashboard = () => {
    const [devices, setDevices] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [showManualAdd, setShowManualAdd] = useState(false);
    const [manualIP, setManualIP] = useState('');
    const [selectedDevice, setSelectedDevice] = useState(null);
    const { user, logout } = useContext(AuthContext);
    const { isOnline } = useBackendStatus();

    useEffect(() => {
        fetchDevices();
    }, []);

    const fetchDevices = async () => {
        try {
            const response = await axios.get('/devices');
            setDevices(response.data);
        } catch (error) {
            console.error('Error fetching devices:', error);
        }
    };

    const handleAddDevice = (newDevice) => {
        setDevices([...devices, newDevice]);
    };

    const handleUpdateDevice = (updatedDevice) => {
        setDevices(
            devices.map((device) =>
                device._id === updatedDevice._id ? updatedDevice : device
            )
        );
    };

    const handleDeleteDevice = (deviceId) => {
        setDevices(devices.filter((device) => device._id !== deviceId));
    };

    const handleScan = async () => {
        setIsScanning(true);
        try {
            const response = await axios.get('/scan');
            const foundDevices = response.data;

            if (foundDevices.length > 0) {
                const device = foundDevices[0];
                const deviceIp = device.ip || 'Unknown IP';
                if (window.confirm(`Found device: ${device.name} (${deviceIp}). Add it?`)) {
                    const newDevice = {
                        name: device.name,
                        type: 'Servo',
                        ip: device.ip,
                        mac: device.mac,
                        status: 'off'
                    };
                    const createRes = await axios.post('/devices', newDevice);
                    const createdDevice = createRes.data;

                    // Set deviceId on ESP32 for access logging
                    try {
                        // Device ID is now handled by MAC address auto-registration
                        // await axios.post(`http://${device.ip}/set-device-id`, { deviceId: createdDevice._id });
                        console.log('Device ID set on ESP32');
                    } catch (err) {
                        console.warn('Failed to set device ID on ESP32:', err);
                    }

                    setDevices([...devices, createdDevice]);
                }
            } else {
                alert('No devices found. Try adding by IP manually.');
            }
        } catch (error) {
            console.error('Scan error:', error);
            alert('Scan failed. Try adding by IP manually.');
        } finally {
            setIsScanning(false);
        }
    };

    const handleManualAdd = async () => {
        if (!manualIP) {
            alert('Please enter an IP address');
            return;
        }

        setIsScanning(true);
        try {
            const response = await axios.post('/scan/manual', { ip: manualIP });
            const device = response.data;
            const deviceIp = device.ip || 'Unknown IP';

            if (window.confirm(`Found device: ${device.name} (${deviceIp}). Add it?`)) {
                const newDevice = {
                    name: device.name,
                    type: 'Servo',
                    ip: device.ip,
                    mac: device.mac,
                    status: 'off'
                };
                const createRes = await axios.post('/devices', newDevice);
                const createdDevice = createRes.data;

                // Set deviceId on ESP32 for access logging
                try {
                    // Device ID is now handled by MAC address auto-registration
                    // await axios.post(`http://${device.ip}/set-device-id`, { deviceId: createdDevice._id });
                    console.log('Device ID set on ESP32');
                } catch (err) {
                    console.warn('Failed to set device ID on ESP32:', err);
                }

                setDevices([...devices, createdDevice]);
                setManualIP('');
                setShowManualAdd(false);
            }
        } catch (error) {
            console.error('Manual add error:', error);
            alert('Failed to connect to device at this IP');
        } finally {
            setIsScanning(false);
        }
    };

    // Helper to group devices by room
    const groupedDevices = devices.reduce((acc, device) => {
        const room = device.room || 'Khác';
        if (!acc[room]) {
            acc[room] = [];
        }
        acc[room].push(device);
        return acc;
    }, {});

    // Ensure specific order: Living Room, Bedroom, Kitchen, Others
    const roomOrder = ['Phòng Khách', 'Phòng Ngủ', 'Nhà Bếp', 'Khác'];
    const sortedRooms = Object.keys(groupedDevices).sort((a, b) => {
        const indexA = roomOrder.indexOf(a);
        const indexB = roomOrder.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
    });

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-600 p-2 rounded-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-800">Smart Home</h1>
                    </div>
                    <div className="flex items-center gap-6">
                        <span className="text-gray-600 font-medium hidden sm:block">Welcome, {user?.name}</span>
                        <button onClick={logout} className="text-gray-500 hover:text-red-600 font-medium transition-colors">Logout</button>
                    </div>
                </div>
            </header>

            {/* Offline Banner */}
            {!isOnline && (
                <div className="bg-red-500 text-white py-3 px-4 shadow-lg">
                    <div className="max-w-7xl mx-auto flex items-center justify-center gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span className="font-bold">Backend Server Offline</span>
                        <span className="text-sm opacity-90">- All controls are disabled. Dashboard is in view-only mode.</span>
                    </div>
                </div>
            )}

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
                        <p className="text-gray-500 mt-1">Manage your connected devices by room</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handleScan}
                            disabled={isScanning || !isOnline}
                            className={`px-6 py-3 rounded-xl font-bold shadow-lg transition-all flex items-center gap-2 ${!isOnline
                                ? 'bg-gray-400 cursor-not-allowed text-white'
                                : 'bg-green-600 hover:bg-green-700 text-white shadow-green-500/30'
                                }`}
                        >
                            {isScanning ? <span className="animate-spin">↻</span> : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>}
                            {isScanning ? 'Scanning...' : 'Scan Network'}
                        </button>
                        <button
                            onClick={() => setShowManualAdd(!showManualAdd)}
                            disabled={!isOnline}
                            className={`px-6 py-3 rounded-xl font-bold shadow-lg transition-all ${!isOnline
                                ? 'bg-gray-400 cursor-not-allowed text-white'
                                : 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-500/30'
                                }`}
                        >
                            Add by IP
                        </button>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            disabled={!isOnline}
                            className={`px-6 py-3 rounded-xl font-bold shadow-lg transition-all flex items-center gap-2 ${!isOnline
                                ? 'bg-gray-400 cursor-not-allowed text-white'
                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/30'
                                }`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                            Add Device
                        </button>
                    </div>
                </div>

                {showManualAdd && (
                    <div className="mb-6 bg-white p-6 rounded-xl shadow-md">
                        <h3 className="text-lg font-bold mb-4">Add Device by IP Address</h3>
                        <div className="flex gap-3">
                            <input
                                type="text"
                                placeholder="e.g., 192.168.100.28"
                                value={manualIP}
                                onChange={(e) => setManualIP(e.target.value)}
                                className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                            />
                            <button onClick={handleManualAdd} disabled={isScanning} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-bold transition-all">
                                {isScanning ? 'Connecting...' : 'Connect'}
                            </button>
                        </div>
                    </div>
                )}

                {devices.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-3xl shadow-sm border border-gray-100">
                        <div className="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">No devices found</h3>
                        <p className="text-gray-500 mb-8">Get started by scanning or adding your first smart device.</p>
                        <button onClick={() => setIsModalOpen(true)} className="text-blue-600 font-bold hover:text-blue-700">Add Device Now &rarr;</button>
                    </div>
                ) : (
                    <div className="space-y-10">
                        {sortedRooms.map((room) => (
                            <div key={room}>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className={`p-2 rounded-lg ${room === 'Phòng Khách' ? 'bg-orange-100 text-orange-600' :
                                        room === 'Phòng Ngủ' ? 'bg-indigo-100 text-indigo-600' :
                                            room === 'Nhà Bếp' ? 'bg-red-100 text-red-600' :
                                                'bg-gray-100 text-gray-600'
                                        }`}>
                                        {room === 'Phòng Khách' && <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>}
                                        {room === 'Phòng Ngủ' && <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>}
                                        {room === 'Nhà Bếp' && <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>}
                                        {(room !== 'Phòng Khách' && room !== 'Phòng Ngủ' && room !== 'Nhà Bếp') && <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-800">{room}</h3>
                                    <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full font-medium">{groupedDevices[room].length} devices</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {groupedDevices[room].map((device) => (
                                        <DeviceCard
                                            key={device._id}
                                            device={device}
                                            onDelete={handleDeleteDevice}
                                            onUpdate={handleUpdateDevice}
                                            onOpenDetail={setSelectedDevice}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            <AddDeviceModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onAdd={handleAddDevice} />
            <DeviceDetailModal device={selectedDevice} isOpen={!!selectedDevice} onClose={() => setSelectedDevice(null)} />
        </div>
    );
};

export default Dashboard;
