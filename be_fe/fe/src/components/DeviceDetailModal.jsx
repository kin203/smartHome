import { useState, useEffect } from 'react';
import axios from '../api/axios';
import AccessLogPanel from './AccessLogPanel';
import RFIDCardManager from './RFIDCardManager';

const DeviceDetailModal = ({ device, isOpen, onClose }) => {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('control');
    const [locked, setLocked] = useState(false);

    useEffect(() => {
        if (device && device.settingsPassword) {
            setLocked(true);
        } else {
            setLocked(false);
        }
    }, [device]);

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 transition-all duration-300">
            <div className="bg-white w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden transform transition-all">
                {/* Header Section */}
                <div className="px-8 py-5 border-b border-gray-100 flex justify-between items-center bg-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${device.status === 'on' || status ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                        <h2 className="text-2xl font-bold text-gray-800 tracking-tight">{device.name}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Tabs Section */}
                <div className="px-8 bg-gray-50/50 border-b border-gray-200 shrink-0">
                    <div className="flex gap-6 overflow-x-auto no-scrollbar">
                        {[
                            { id: 'control', label: 'Control', icon: '🎛️' },
                            { id: 'relay', label: 'Lights', icon: '💡' },
                            { id: 'cards', label: 'Cards', icon: '🔑' },
                            { id: 'logs', label: 'Access Log', icon: '🔐' },
                            { id: 'setup', label: 'Setup', icon: '⚙️' },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`pb-4 pt-4 px-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${activeTab === tab.id
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                <span className="text-lg">{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto bg-gray-50/30 p-8 custom-scrollbar relative">
                    {/* Critical Gas Alert - Sticky within content or just top of content */}
                    {status && status.gasAlert && (
                        <div className="mb-8 bg-red-600 text-white p-5 rounded-xl flex items-center gap-5 animate-pulse shadow-lg shadow-red-500/30">
                            <div className="text-4xl bg-white/20 w-16 h-16 rounded-full flex items-center justify-center">⚠️</div>
                            <div className="flex-1">
                                <h3 className="text-xl font-bold uppercase tracking-wide">Critical Gas Leak Detected!</h3>
                                <p className="font-medium opacity-90 mt-1">Gas Sensor Reading: {status.gas}. Evacuate area immediately.</p>
                            </div>
                        </div>
                    )}

                    {!status ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500">
                            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                            <p className="font-medium">Connecting to device...</p>
                        </div>
                    ) : (
                        <div className="animate-fadeIn">
                            {activeTab === 'control' && (
                                <div className="space-y-6 max-w-4xl mx-auto">
                                    {/* Sensor Data */}
                                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100 shadow-sm">
                                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                            <span>📊</span> Live Monitor
                                        </h3>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            {[
                                                {
                                                    label: 'Temp',
                                                    value: `${status.temperature}°C`,
                                                    icon: '🌡️',
                                                    color: status.temperature > 30 ? 'text-red-600' : status.temperature < 20 ? 'text-blue-600' : 'text-green-600'
                                                },
                                                { label: 'Humidity', value: `${status.humidity}%`, icon: '💧', color: 'text-blue-600' },
                                                { label: 'Gas Level', value: status.gas, icon: status.gas > 800 ? '⚠️' : '✅', color: status.gas > 800 ? 'text-red-600' : 'text-green-600' },
                                                { label: 'Rain', value: status.rain === 'detected' ? 'Yes' : 'No', icon: status.rain === 'detected' ? '🌧️' : '☀️', color: 'text-gray-700' },
                                            ].map((item, idx) => (
                                                <div key={idx} className="bg-white/80 backdrop-blur rounded-xl p-4 text-center border border-white shadow-sm hover:shadow-md transition-shadow">
                                                    <div className="text-3xl mb-2 filter drop-shadow-sm">{item.icon}</div>
                                                    <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
                                                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-1">{item.label}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Door Control */}
                                    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><span>🚪</span> Cổng nhà</h3>
                                            <span className={`px-3 py-1 rounded-full text-sm font-bold capitalize ${status.door === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                                State: {status.door}
                                            </span>
                                        </div>
                                        <div className="flex gap-4">
                                            <button
                                                onClick={() => sendCommand('door', 'open')}
                                                disabled={loading || status.door.includes('open')}
                                                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 text-white py-4 rounded-xl font-bold transition-all shadow-md hover:shadow-lg disabled:shadow-none flex items-center justify-center gap-2"
                                            >
                                                <span>Open</span>
                                            </button>
                                            <button
                                                onClick={() => sendCommand('door', 'close')}
                                                disabled={loading || status.door === 'closed'}
                                                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-200 disabled:text-gray-400 text-white py-4 rounded-xl font-bold transition-all shadow-md hover:shadow-lg disabled:shadow-none flex items-center justify-center gap-2"
                                            >
                                                <span>Close</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Interactive Controls Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><span>🔔</span> Alarm System</h3>
                                            <div className="grid grid-cols-2 gap-3">
                                                <button onClick={() => sendCommand('buzzer', 'beep')} disabled={loading} className="bg-yellow-500 hover:bg-yellow-600 text-white p-3 rounded-lg font-bold shadow-sm transition-all active:scale-95">
                                                    Beep Once
                                                </button>
                                                <button onClick={() => sendCommand('buzzer', 'alert')} disabled={loading} className="bg-red-500 hover:bg-red-600 text-white p-3 rounded-lg font-bold shadow-sm transition-all active:scale-95 animate-pulse">
                                                    🚨 Alert Mode
                                                </button>
                                            </div>
                                        </div>

                                        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><span>📺</span> OLED Display</h3>
                                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                                {[
                                                    { label: 'Auto Cycle', val: 0 },
                                                    { label: 'General Info', val: 1 },
                                                    { label: 'Home Status', val: 2 }
                                                ].map((mode) => (
                                                    <button
                                                        key={mode.val}
                                                        onClick={() => sendCommand('screen', null, mode.val)}
                                                        className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${status.screenMode === mode.val ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                                    >
                                                        {mode.label}
                                                    </button>
                                                ))}
                                            </div>
                                            <p className="text-xs text-gray-400 mt-2 text-center">
                                                {status.screenMode === 0 ? "Cycling every 10s" : "Static Display"}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'relay' && (
                                <div className="space-y-6 max-w-4xl mx-auto">
                                    <h3 className="text-xl font-bold text-gray-800 mb-2">Smart Lighting Control</h3>
                                    <p className="text-gray-500 mb-6">Manage connected lights and set automation preferences.</p>

                                    <div className="grid grid-cols-1 gap-4">
                                        {[
                                            { id: 1, name: 'Phòng ngủ (LED 1)', gpio: '32', color: 'yellow' },
                                            { id: 2, name: 'Bếp (LED 2)', gpio: '26', color: 'blue' },
                                            { id: 3, name: 'Phòng khách (LED 3)', gpio: '15', color: 'green' },
                                        ].map((led) => (
                                            <div key={led.id} className="group bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl transition-colors ${status[`relay${led.id}`] ? `bg-${led.color}-100 text-${led.color}-600` : 'bg-gray-100 text-gray-400'}`}>
                                                        💡
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-gray-800 text-lg">{led.name}</div>
                                                        <div className="text-sm text-gray-500 font-mono">GPIO: {led.gpio}</div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => toggleRelay(led.id)}
                                                    disabled={loading}
                                                    className={`w-16 h-8 rounded-full p-1 transition-all ${status[`relay${led.id}`] ? 'bg-green-500' : 'bg-gray-300'}`}
                                                >
                                                    <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-300 ${status[`relay${led.id}`] ? 'translate-x-8' : 'translate-x-0'}`} />
                                                </button>
                                            </div>
                                        ))}

                                        {/* Auto Light (GPIO D2) */}
                                        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-6 rounded-2xl border border-purple-100 shadow-sm mt-4">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xl">
                                                        🤖
                                                    </div>
                                                    <div>
                                                        <h4 className="text-lg font-bold text-gray-800">Đèn ngoài nhà</h4>
                                                        <p className="text-sm text-gray-600">GPIO 2 • Light Sensor Controlled</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-6 grid grid-cols-2 gap-4">
                                                <div className="bg-white/60 p-4 rounded-xl flex items-center justify-between border border-purple-100">
                                                    <div>
                                                        <div className="font-bold text-gray-700">Auto Mode</div>
                                                        <div className="text-xs text-gray-500">Enable sensor logic</div>
                                                    </div>
                                                    <button
                                                        onClick={async () => {
                                                            const newMode = !status.autoMode;
                                                            await sendCommand('auto_light', 'set_mode', newMode ? 'auto' : 'manual');
                                                        }}
                                                        disabled={loading}
                                                        className={`w-12 h-6 rounded-full p-1 transition-all ${status.autoMode ? 'bg-purple-600' : 'bg-gray-300'}`}
                                                    >
                                                        <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-300 ${status.autoMode ? 'translate-x-6' : 'translate-x-0'}`} />
                                                    </button>
                                                </div>

                                                <div className={`bg-white/60 p-4 rounded-xl flex items-center justify-between border border-purple-100 transition-opacity ${status.autoMode ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                                                    <div>
                                                        <div className="font-bold text-gray-700">Manual Override</div>
                                                        <div className="text-xs text-gray-500">Force On/Off</div>
                                                    </div>
                                                    <button
                                                        onClick={async () => {
                                                            const newState = !status.autoLight;
                                                            await sendCommand('auto_light', 'turn', newState ? 'on' : 'off');
                                                        }}
                                                        disabled={loading || status.autoMode}
                                                        className={`w-12 h-6 rounded-full p-1 transition-all ${status.autoLight ? 'bg-indigo-500' : 'bg-gray-300'}`}
                                                    >
                                                        <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-300 ${status.autoLight ? 'translate-x-6' : 'translate-x-0'}`} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
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
                                <div className="space-y-6 max-w-5xl mx-auto">
                                    <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100">
                                        <div className="flex items-center gap-3 mb-8 border-b border-gray-100 pb-4">
                                            <div className="bg-gray-100 p-2 rounded-lg text-2xl">⚙️</div>
                                            <div>
                                                <h3 className="text-xl font-bold text-gray-800">Device Configuration</h3>
                                                <p className="text-gray-500 text-sm">Manage advanced settings and firmware</p>
                                            </div>
                                        </div>

                                        {/* Channel Setup */}
                                        {device.channels && device.channels.length > 0 && (
                                            <div className="mb-8 p-6 bg-gray-50 rounded-xl border border-gray-200">
                                                <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                                                    <span>🔌</span> Channels Mapping
                                                </h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {device.channels.map((channel, idx) => (
                                                        <div key={idx} className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                                                            <div className="font-bold text-xs text-gray-400 uppercase tracking-wider mb-2">Channel {channel.index}</div>
                                                            <div className="space-y-3">
                                                                <input
                                                                    type="text"
                                                                    defaultValue={channel.name}
                                                                    id={`channel-name-${idx}`}
                                                                    placeholder="Device Name"
                                                                    className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                                                />
                                                                <select
                                                                    defaultValue={channel.room || 'Living Room'}
                                                                    id={`channel-room-${idx}`}
                                                                    className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                                                >
                                                                    <option value="Phòng Khách">Phòng Khách</option>
                                                                    <option value="Phòng Ngủ">Phòng Ngủ</option>
                                                                    <option value="Nhà Bếp">Nhà Bếp</option>
                                                                    <option value="Khác">Khác</option>
                                                                </select>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="mt-4 flex justify-end">
                                                    <button
                                                        onClick={async () => {
                                                            const updatedChannels = device.channels.map((ch, idx) => ({
                                                                ...ch,
                                                                name: document.getElementById(`channel-name-${idx}`).value,
                                                                room: document.getElementById(`channel-room-${idx}`).value
                                                            }));

                                                            try {
                                                                await axios.put(`/devices/${device._id}`, { channels: updatedChannels });
                                                                alert('Channel settings saved!');
                                                                window.location.reload();
                                                            } catch (err) {
                                                                console.error(err);
                                                                alert('Failed to save channels');
                                                            }
                                                        }}
                                                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors text-sm shadow-md"
                                                    >
                                                        Save Mapping
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            {/* Read-only Info */}
                                            <div className="space-y-6">
                                                <div className="bg-gray-50/80 p-6 rounded-2xl border border-gray-100 shadow-inner relative overflow-hidden">
                                                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-32 w-32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                    </div>
                                                    <div className="space-y-4 relative z-10">
                                                        <div>
                                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">MAC Address</label>
                                                            <div className="text-sm font-mono bg-white p-3 rounded-lg border border-gray-200 text-gray-700 select-all font-semibold">
                                                                {device.mac || 'N/A'}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">IP Address</label>
                                                            <div className="text-sm font-mono bg-white p-3 rounded-lg border border-gray-200 text-gray-700 select-all font-semibold">
                                                                {device.ip || 'N/A'}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Firmware</label>
                                                            <div className="flex items-center gap-2">
                                                                <div className="text-sm font-mono bg-white p-3 rounded-lg border border-gray-200 text-gray-700 flex-1 font-semibold">
                                                                    {device.firmwareVersion || 'Unknown'}
                                                                </div>
                                                                <span className="bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full border border-green-200 shadow-sm">
                                                                    v1.0
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Editable Settings */}
                                            <div className="space-y-6">
                                                <div className="space-y-5">
                                                    <div>
                                                        <label className="block text-sm font-bold text-gray-700 mb-2">Device Name</label>
                                                        <input
                                                            type="text"
                                                            defaultValue={device.name}
                                                            id="setup-name"
                                                            disabled={locked}
                                                            className={`w-full p-3 border rounded-lg transition-all ${locked
                                                                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                                                : 'bg-white border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm'
                                                                }`}
                                                        />
                                                    </div>

                                                    <div className="pt-4 border-t border-gray-100">
                                                        <label className="block text-sm font-bold text-gray-700 mb-3">System Updates</label>
                                                        {locked ? (
                                                            <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200 text-gray-500 text-sm">
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                                                </svg>
                                                                <span>Unlock to verify updates</span>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => window.open(`http://${device.ip}/update`, '_blank')}
                                                                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 transform active:scale-95"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                                                                </svg>
                                                                Check for Updates
                                                            </button>
                                                        )}
                                                    </div>

                                                    <div className="pt-4 border-t border-gray-100">
                                                        {locked ? (
                                                            <div className="space-y-3">
                                                                <label className="block text-sm font-bold text-gray-700">Restricted Access</label>
                                                                <div className="flex gap-2">
                                                                    <input
                                                                        type="password"
                                                                        id="unlock-password"
                                                                        placeholder="Enter Admin Password"
                                                                        className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                                                                    />
                                                                    <button
                                                                        onClick={() => {
                                                                            const input = document.getElementById('unlock-password').value;
                                                                            if (input === device.settingsPassword) {
                                                                                setLocked(false);
                                                                            } else {
                                                                                alert("Incorrect Password!");
                                                                            }
                                                                        }}
                                                                        className="bg-gray-800 hover:bg-black text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-md"
                                                                    >
                                                                        Unlock
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-4 animate-fadeIn">
                                                                <div>
                                                                    <label className="block text-sm font-bold text-gray-700 mb-2">Change Admin Password</label>
                                                                    <input
                                                                        type="text"
                                                                        defaultValue={device.settingsPassword}
                                                                        id="setup-password"
                                                                        placeholder="New password (leave empty to remove)"
                                                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                                                                    />
                                                                </div>
                                                                <button
                                                                    onClick={async () => {
                                                                        const name = document.getElementById('setup-name').value;
                                                                        const password = document.getElementById('setup-password').value;
                                                                        try {
                                                                            await axios.put(`/devices/${device._id}`, {
                                                                                name,
                                                                                settingsPassword: password
                                                                            });
                                                                            alert('Settings saved!');
                                                                            window.location.reload();
                                                                        } catch (err) {
                                                                            console.error(err);
                                                                            alert('Failed to save settings');
                                                                        }
                                                                    }}
                                                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-all shadow-md hover:shadow-lg transform active:scale-95 text-lg"
                                                                >
                                                                    Save Changes
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DeviceDetailModal;
