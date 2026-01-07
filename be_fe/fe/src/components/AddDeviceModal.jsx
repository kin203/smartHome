import { useState, useEffect } from 'react';
import axios from '../api/axios';

const AddDeviceModal = ({ isOpen, onClose, onAdd }) => {
    // Steps: 'scan' | 'results' | 'manual' | 'config'
    const [step, setStep] = useState('scan');
    const [foundDevices, setFoundDevices] = useState([]);
    const [manualIP, setManualIP] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Config Form State
    const [formData, setFormData] = useState({
        name: '',
        type: 'Light',
        room: 'Phòng Khách',
        ip: '',
        mac: ''
    });

    useEffect(() => {
        if (isOpen) {
            startScan();
        } else {
            // Reset state on close
            setStep('scan');
            setFoundDevices([]);
            setManualIP('');
            setFormData({ name: '', type: 'Light', room: 'Phòng Khách', ip: '', mac: '' });
        }
    }, [isOpen]);

    const startScan = async () => {
        setStep('scan');
        setIsLoading(true);
        try {
            const response = await axios.get('/scan');
            // Assuming response.data is an array of devices found on network
            // Filter out devices that might already be in DB if possible, or just show all
            setFoundDevices(response.data);
            setStep('results');
        } catch (error) {
            console.error('Scan failed:', error);
            setFoundDevices([]);
            setStep('results'); // Show empty results to allow manual add
        } finally {
            setIsLoading(false);
        }
    };

    const handleManualConnect = async () => {
        if (!manualIP) return;
        setIsLoading(true);
        try {
            const response = await axios.post('/scan/manual', { ip: manualIP });
            const device = response.data;
            if (device) {
                proceedToConfig(device);
            }
        } catch (error) {
            console.error('Manual connect failed:', error);
            alert('Could not connect to device at ' + manualIP);
        } finally {
            setIsLoading(false);
        }
    };

    const proceedToConfig = (device) => {
        setFormData(prev => ({
            ...prev,
            name: device.name || `Device ${device.ip.split('.').pop()}`,
            ip: device.ip,
            mac: device.mac || ''
        }));
        setStep('config');
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            // Register device in DB
            const response = await axios.post('/devices', {
                name: formData.name,
                type: formData.type,
                room: formData.room,
                ip: formData.ip,
                mac: formData.mac,
                status: 'off'
            });

            // Try to notify ESP32 of its ID (optional, legacy support)
            try {
                // If the device supports this endpoint
                // await axios.post(`http://${formData.ip}/set-device-id`, { deviceId: response.data._id });
            } catch (err) {
                console.warn('Failed to configure ESP32:', err);
            }

            onAdd(response.data);
            onClose();
        } catch (error) {
            console.error('Error saving device:', error);
            alert('Failed to save device');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="bg-gray-50 px-8 py-6 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800">
                        {step === 'scan' ? 'Scanning Network...' :
                            step === 'results' ? 'Found Devices' :
                                step === 'manual' ? 'Add by IP' :
                                    'Configure Device'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 overflow-y-auto custom-scrollbar">

                    {/* STEP 1: SCANNING */}
                    {step === 'scan' && (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-6"></div>
                            <p className="text-gray-500 font-medium">Searching for local smart devices...</p>
                        </div>
                    )}

                    {/* STEP 2: RESULTS */}
                    {step === 'results' && (
                        <div className="space-y-6">
                            {foundDevices.length > 0 ? (
                                <div className="space-y-3">
                                    <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Available Devices</p>
                                    {foundDevices.map((device, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-4 bg-blue-50 border border-blue-100 rounded-xl hover:shadow-md transition-all">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-white p-2 rounded-lg shadow-sm">📱</div>
                                                <div>
                                                    <div className="font-bold text-gray-800">{device.name || 'Unknown Device'}</div>
                                                    <div className="text-xs text-gray-500 font-mono">{device.ip}</div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => proceedToConfig(device)}
                                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm"
                                            >
                                                Setup
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 bg-gray-50 rounded-xl border border-gray-100 border-dashed">
                                    <p className="text-gray-500 mb-2">No devices found automatically.</p>
                                    <p className="text-xs text-gray-400">Ensure devices are powered on and connected to the same WiFi.</p>
                                </div>
                            )}

                            <div className="pt-6 border-t border-gray-100">
                                <button
                                    onClick={() => setStep('manual')}
                                    className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-bold hover:border-blue-500 hover:text-blue-500 transition-all flex items-center justify-center gap-2"
                                >
                                    <span>➕</span> Add Manually by IP
                                </button>
                                <button
                                    onClick={startScan}
                                    className="w-full mt-3 py-3 text-blue-600 font-bold hover:bg-blue-50 rounded-xl transition-colors"
                                >
                                    ↻ Rescan
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: MANUAL IP */}
                    {step === 'manual' && (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-gray-700 text-sm font-bold mb-2">Device IP Address</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none font-mono"
                                    placeholder="e.g., 192.168.1.100"
                                    value={manualIP}
                                    onChange={(e) => setManualIP(e.target.value)}
                                    autoFocus
                                />
                                <p className="text-xs text-gray-400 mt-2">Enter the local IP address of your ESP32 device.</p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep('results')}
                                    className="flex-1 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleManualConnect}
                                    disabled={!manualIP || isLoading}
                                    className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-lg shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? 'Connecting...' : 'Connect'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 4: CONFIGURATION */}
                    {step === 'config' && (
                        <form onSubmit={handleSave} className="space-y-5">
                            <div className="bg-green-50 text-green-700 p-4 rounded-xl text-sm flex items-center gap-2 mb-4">
                                <span>✅</span> Connected to <strong>{formData.ip}</strong>
                            </div>

                            <div>
                                <label className="block text-gray-700 text-sm font-bold mb-2">Device Name</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-gray-700 text-sm font-bold mb-2">Kind</label>
                                    <select
                                        className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                                        value={formData.type}
                                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    >
                                        <option value="Light">Light</option>
                                        <option value="Fan">Fan</option>
                                        <option value="Sensor">Sensor</option>
                                        <option value="Switch">Switch</option>
                                        <option value="Servo">Door/Gate</option>
                                        <option value="Buzzer">Alarm</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-gray-700 text-sm font-bold mb-2">Location</label>
                                    <select
                                        className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                                        value={formData.room}
                                        onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                                    >
                                        <option value="Phòng Khách">Phòng Khách</option>
                                        <option value="Phòng Ngủ">Phòng Ngủ</option>
                                        <option value="Nhà Bếp">Nhà Bếp</option>
                                        <option value="Khác">Khác</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setStep('results')}
                                    className="flex-1 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl"
                                >
                                    Back
                                </button>
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 disabled:opacity-50"
                                >
                                    {isLoading ? 'Saving...' : 'Finish Setup'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AddDeviceModal;
