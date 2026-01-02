import { useState, useEffect } from 'react';
import axios from '../api/axios';
import AccessLogPanel from './AccessLogPanel';
import RFIDCardManager from './RFIDCardManager';

const DeviceDetailModal = ({ device, isOpen, onClose }) => {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('control');

    useEffect(() => {
        if (isOpen && device) {
            fetchStatus();
            const interval = setInterval(fetchStatus, 1000); // Poll every 1s for real-time
            return () => clearInterval(interval);
        }
    }, [isOpen, device]);

    const fetchStatus = async () => {
        try {
            const response = await axios.get(`/status/${device._id}`);
            setStatus(response.data);
        } catch (error) {
            console.error('Failed to fetch status:', error);
        }
    };

    const sendCommand = async (deviceType, action, value, channel) => {
        setLoading(true);
        try {
            await axios.post('/control', {
                deviceId: device._id,
                device: deviceType,
                action,
                value,
                channel
            });
            await fetchStatus();
        } catch (error) {
            console.error('Control error:', error);
            alert('Failed to control device');
        } finally {
            setLoading(false);
        }
    };

    const toggleRelay = async (channel) => {
        const currentState = status[`relay${channel}`];
        await sendCommand('relay', currentState ? 'off' : 'on', null, channel);
    };

    if (!isOpen || !device) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-8 w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">{device.name}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                    <h2 className="text-2xl font-bold text-gray-800">{device.name}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                </div>

                {/* Critical Gas Alert Banner */}
                {status && status.gasAlert && (
                    <div className="mb-6 bg-red-600 text-white p-4 rounded-xl flex items-center gap-4 animate-pulse shadow-xl shadow-red-500/50">
                        <div className="text-4xl">⚠️</div>
                        <div className="flex-1">
                            <h3 className="text-xl font-bold uppercase">Critical Gas Leak Detected!</h3>
                            <p className="font-bold opacity-90">Gas Level: {status.gas} detected. Evacuate immediately!</p>
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex gap-2 mb-6 border-b border-gray-200">
                    <button onClick={() => setActiveTab('control')} className={`px-6 py-3 font-bold transition-all ${activeTab === 'control' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                        🎛️ Control
                    </button>
                    <button onClick={() => setActiveTab('relay')} className={`px-6 py-3 font-bold transition-all ${activeTab === 'relay' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                        💡 Lights
                    </button>
                    <button onClick={() => setActiveTab('cards')} className={`px-6 py-3 font-bold transition-all ${activeTab === 'cards' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                        🔑 Cards
                    </button>
                    <button onClick={() => setActiveTab('logs')} className={`px-6 py-3 font-bold transition-all ${activeTab === 'logs' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                        🔐 Access Log
                    </button>
                    <button onClick={() => setActiveTab('setup')} className={`px-6 py-3 font-bold transition-all ${activeTab === 'setup' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                        ⚙️ Setup
                    </button>
                </div>

                {!status ? (
                    <div className="text-center py-10">
                        <div className="animate-spin text-4xl">↻</div>
                        <p className="text-gray-500 mt-4">Loading device status...</p>
                    </div>
                ) : (
                    <>
                        {activeTab === 'control' && (
                            <div className="space-y-6">
                                {/* Sensor Data */}
                                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6">
                                    <h3 className="text-lg font-bold text-gray-800 mb-4">📊 Sensor Data</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="bg-white rounded-lg p-4 text-center">
                                            <div className="text-3xl mb-2">🌡️</div>
                                            <div className="text-2xl font-bold text-blue-600">{status.temperature}°C</div>
                                            <div className="text-sm text-gray-500">Temperature</div>
                                        </div>
                                        <div className="bg-white rounded-lg p-4 text-center">
                                            <div className="text-3xl mb-2">💧</div>
                                            <div className="text-2xl font-bold text-blue-600">{status.humidity}%</div>
                                            <div className="text-sm text-gray-500">Humidity</div>
                                        </div>
                                        <div className="bg-white rounded-lg p-4 text-center">
                                            <div className="text-3xl mb-2">{status.gas > 800 ? '⚠️' : '✅'}</div>
                                            <div className={`text-2xl font-bold ${status.gas > 800 ? 'text-red-600' : 'text-green-600'}`}>{status.gas}</div>
                                            <div className="text-sm text-gray-500">Gas Level</div>
                                        </div>
                                        <div className="bg-white rounded-lg p-4 text-center">
                                            <div className="text-3xl mb-2">{status.rain === 'detected' ? '🌧️' : '☀️'}</div>
                                            <div className="text-lg font-bold text-gray-700 capitalize">{status.rain}</div>
                                            <div className="text-sm text-gray-500">Rain</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Door Control */}
                                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6">
                                    <h3 className="text-lg font-bold text-gray-800 mb-4">🚪 Door Control</h3>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-3xl font-bold text-green-700 capitalize">{status.door}</div>
                                            <div className="text-sm text-gray-600 mt-1">Current Status</div>
                                        </div>
                                        <div className="flex gap-3">
                                            <button onClick={() => sendCommand('door', 'open')} disabled={loading || status.door === 'open'} className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-6 py-3 rounded-lg font-bold transition-all">
                                                Open Door
                                            </button>
                                            <button onClick={() => sendCommand('door', 'close')} disabled={loading || status.door === 'closed'} className="bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white px-6 py-3 rounded-lg font-bold transition-all">
                                                Close Door
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Buzzer & Screen */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-6">
                                        <h3 className="text-lg font-bold text-gray-800 mb-4">🔔 Buzzer</h3>
                                        <div className="flex gap-3">
                                            <button onClick={() => sendCommand('buzzer', 'beep')} disabled={loading} className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-3 rounded-lg font-bold">
                                                Beep
                                            </button>
                                            <button onClick={() => sendCommand('buzzer', 'alert')} disabled={loading} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white px-4 py-3 rounded-lg font-bold">
                                                Alert
                                            </button>
                                        </div>
                                    </div>

                                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6">
                                        <h3 className="text-lg font-bold text-gray-800 mb-4">📺 Display</h3>
                                        <div className="grid grid-cols-3 gap-2">
                                            <button onClick={() => sendCommand('screen', null, 0)} disabled={loading} className={`px-3 py-2 rounded-lg font-bold text-sm ${status.screen === 0 ? 'bg-purple-600 text-white' : 'bg-white text-purple-600'}`}>
                                                Main
                                            </button>
                                            <button onClick={() => sendCommand('screen', null, 1)} disabled={loading} className={`px-3 py-2 rounded-lg font-bold text-sm ${status.screen === 1 ? 'bg-purple-600 text-white' : 'bg-white text-purple-600'}`}>
                                                DHT
                                            </button>
                                            <button onClick={() => sendCommand('screen', null, 2)} disabled={loading} className={`px-3 py-2 rounded-lg font-bold text-sm ${status.screen === 2 ? 'bg-purple-600 text-white' : 'bg-white text-purple-600'}`}>
                                                Rain/Gas
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'relay' && (
                            <div className="space-y-4">
                                <h3 className="text-xl font-bold text-gray-800 mb-4">💡 Light Control</h3>
                                <p className="text-sm text-gray-600 mb-4">Control 3 LEDs connected to your ESP32</p>

                                {/* LED 1 */}
                                <div className={`flex items-center justify-between p-6 rounded-xl transition-all ${status['relay1'] ? 'bg-gradient-to-r from-yellow-100 to-yellow-200 shadow-md' : 'bg-gray-100'}`}>
                                    <div>
                                        <div className="text-lg font-bold">Phòng ngủ (LED 1)</div>
                                        <div className="text-sm text-gray-600">GPIO 32</div>
                                    </div>
                                    <button
                                        onClick={() => toggleRelay(1)}
                                        disabled={loading}
                                        className={`relative w-20 h-10 rounded-full p-1 transition-all ${status['relay1'] ? 'bg-yellow-500' : 'bg-gray-300'}`}
                                    >
                                        <div className={`bg-white w-8 h-8 rounded-full shadow-md transform transition-transform ${status['relay1'] ? 'translate-x-10' : 'translate-x-0'}`} />
                                    </button>
                                </div>

                                {/* LED 2 */}
                                <div className={`flex items-center justify-between p-6 rounded-xl transition-all ${status['relay2'] ? 'bg-gradient-to-r from-blue-100 to-blue-200 shadow-md' : 'bg-gray-100'}`}>
                                    <div>
                                        <div className="text-lg font-bold">Bếp (LED 2)</div>
                                        <div className="text-sm text-gray-600">GPIO 26</div>
                                    </div>
                                    <button
                                        onClick={() => toggleRelay(2)}
                                        disabled={loading}
                                        className={`relative w-20 h-10 rounded-full p-1 transition-all ${status['relay2'] ? 'bg-blue-500' : 'bg-gray-300'}`}
                                    >
                                        <div className={`bg-white w-8 h-8 rounded-full shadow-md transform transition-transform ${status['relay2'] ? 'translate-x-10' : 'translate-x-0'}`} />
                                    </button>
                                </div>

                                {/* LED 3 */}
                                <div className={`flex items-center justify-between p-6 rounded-xl transition-all ${status['relay3'] ? 'bg-gradient-to-r from-green-100 to-green-200 shadow-md' : 'bg-gray-100'}`}>
                                    <div>
                                        <div className="text-lg font-bold">Phòng khách (LED 3)</div>
                                        <div className="text-sm text-gray-600">GPIO 15</div>
                                    </div>
                                    <button
                                        onClick={() => toggleRelay(3)}
                                        disabled={loading}
                                        className={`relative w-20 h-10 rounded-full p-1 transition-all ${status['relay3'] ? 'bg-green-500' : 'bg-gray-300'}`}
                                    >
                                        <div className={`bg-white w-8 h-8 rounded-full shadow-md transform transition-transform ${status['relay3'] ? 'translate-x-10' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'cards' && (
                            <RFIDCardManager deviceId={device._id} />
                        )}

                        {activeTab === 'logs' && (
                            <AccessLogPanel deviceId={device._id} />
                        )}

                        {activeTab === 'setup' && (
                            <div className="space-y-6">
                                <div className="bg-white rounded-xl p-6 border border-gray-200">
                                    <h3 className="text-xl font-bold text-gray-800 mb-4">⚙️ Device Setup</h3>

                                    {/* Channel Setup */}
                                    {device.channels && device.channels.length > 0 && (
                                        <div className="mb-6 border-b border-gray-200 pb-6">
                                            <h4 className="font-bold text-gray-700 mb-4">Channels Configuration</h4>
                                            {device.channels.map((channel, idx) => (
                                                <div key={idx} className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                                                    <div className="font-bold text-sm text-gray-500 mb-2">Channel {channel.index}</div>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                                                            <input
                                                                type="text"
                                                                defaultValue={channel.name}
                                                                id={`channel-name-${idx}`}
                                                                className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-500 mb-1">Room</label>
                                                            <select
                                                                defaultValue={channel.room || 'Living Room'}
                                                                id={`channel-room-${idx}`}
                                                                className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                                            >
                                                                <option value="Phòng Khách">Phòng Khách</option>
                                                                <option value="Phòng Ngủ">Phòng Ngủ</option>
                                                                <option value="Nhà Bếp">Nhà Bếp</option>
                                                                <option value="Khác">Khác</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            <button
                                                onClick={async () => {
                                                    const updatedChannels = device.channels.map((ch, idx) => ({
                                                        ...ch,
                                                        name: document.getElementById(`channel-name-${idx}`).value,
                                                        room: document.getElementById(`channel-room-${idx}`).value
                                                    }));

                                                    try {
                                                        await axios.put(`/devices/${device._id}`, {
                                                            channels: updatedChannels
                                                        });
                                                        alert('Channel settings saved!');
                                                        window.location.reload();
                                                    } catch (err) {
                                                        console.error(err);
                                                        alert('Failed to save channels');
                                                    }
                                                }}
                                                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition-colors text-sm"
                                            >
                                                Save Channels
                                            </button>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Read-only Info */}
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-500">MAC Address</label>
                                                <div className="text-lg font-mono bg-gray-50 p-2 rounded border border-gray-200">{device.mac || 'N/A'}</div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-500">IP Address</label>
                                                <div className="text-lg font-mono bg-gray-50 p-2 rounded border border-gray-200">{device.ip || 'N/A'}</div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-500">Firmware Version</label>
                                                <div className="text-lg font-mono bg-gray-50 p-2 rounded border border-gray-200">{device.firmwareVersion || 'Unknown'}</div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-500 mb-2">System Update</label>
                                                <button
                                                    onClick={() => window.open(`http://${device.ip}/update`, '_blank')}
                                                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded transition-colors flex items-center justify-center gap-2"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                                                    </svg>
                                                    Update Firmware (OTA)
                                                </button>
                                            </div>
                                        </div>

                                        {/* Editable Settings */}
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Device Name</label>
                                                <input
                                                    type="text"
                                                    defaultValue={device.name}
                                                    id="setup-name"
                                                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Room (Device Default)</label>
                                                <select
                                                    id="setup-room"
                                                    defaultValue={device.room || 'Khác'}
                                                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                >
                                                    <option value="Phòng Khách">Phòng Khách</option>
                                                    <option value="Phòng Ngủ">Phòng Ngủ</option>
                                                    <option value="Nhà Bếp">Nhà Bếp</option>
                                                    <option value="Khác">Khác</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Settings Password</label>
                                                <input
                                                    type="text"
                                                    defaultValue={device.settingsPassword}
                                                    id="setup-password"
                                                    placeholder="Enter password"
                                                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                />
                                            </div>
                                            <button
                                                onClick={async () => {
                                                    const name = document.getElementById('setup-name').value;
                                                    const room = document.getElementById('setup-room').value;
                                                    const password = document.getElementById('setup-password').value;
                                                    try {
                                                        await axios.put(`/devices/${device._id}`, {
                                                            name,
                                                            room,
                                                            settingsPassword: password
                                                        });
                                                        alert('Settings saved!');
                                                        window.location.reload(); // Reload to reflect name change
                                                    } catch (err) {
                                                        console.error(err);
                                                        alert('Failed to save settings');
                                                    }
                                                }}
                                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors"
                                            >
                                                Save Settings
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default DeviceDetailModal;
