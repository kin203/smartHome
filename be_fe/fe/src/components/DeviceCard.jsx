import { useState } from 'react';
import axios from '../api/axios';
import { useBackendStatus } from '../context/BackendStatusContext';

const DeviceCard = ({ device, onDelete, onUpdate, onOpenDetail }) => {
    const [isLoading, setIsLoading] = useState(false);
    const { isOnline } = useBackendStatus();

    const toggleStatus = async () => {
        if (!isOnline) return; // Prevent action when offline

        setIsLoading(true);
        try {
            const newStatus = device.status === 'on' ? 'off' : 'on';

            if (device.ip) {
                const action = newStatus === 'on' ? 'open' : 'close';
                await axios.post('/control', {
                    deviceId: device._id,
                    device: 'door',
                    action: action
                });
                onUpdate({ ...device, status: newStatus });
            } else {
                const response = await axios.put(`/devices/${device._id}`, {
                    status: newStatus,
                });
                onUpdate(response.data);
            }
        } catch (error) {
            console.error('Error updating device:', error);
            alert('Failed to control device');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!isOnline) return; // Prevent action when offline

        if (window.confirm('Are you sure you want to delete this device?')) {
            try {
                await axios.delete(`/devices/${device._id}`);
                onDelete(device._id);
            } catch (error) {
                console.error('Error deleting device:', error);
            }
        }
    };

    const handleRelease = async () => {
        if (!isOnline) return;

        if (window.confirm('Release this device? Other users can claim it after release.')) {
            try {
                await axios.post(`/devices/release/${device._id}`);
                alert('Device released successfully!');
                onDelete(device._id); // Remove from current user's list
            } catch (error) {
                console.error('Error releasing device:', error);
                alert(error.response?.data?.message || 'Failed to release device');
            }
        }
    };

    const handleCardClick = () => {
        if (isOnline && onOpenDetail) {
            onOpenDetail(device);
        }
    };

    const getIcon = () => {
        switch (device.type) {
            case 'Light':
                return '💡';
            case 'Fan':
                return '💨';
            case 'Sensor':
                return '🌡️';
            case 'Switch':
                return '🔌';
            case 'Servo':
                return '🚪';
            case 'Buzzer':
                return '🔔';
            default:
                return '📱';
        }
    };

    const isOn = device.status === 'on';

    return (
        <div
            onClick={handleCardClick}
            className={`relative overflow-hidden rounded-2xl p-6 transition-all duration-300 ${!isOnline
                ? 'bg-gray-200 opacity-60 cursor-not-allowed'
                : `cursor-pointer hover:scale-105 ${isOn ? 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30' : 'bg-white shadow-md hover:shadow-lg'}`
                }`}
        >
            {/* Offline badge */}
            {!isOnline && (
                <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                    OFFLINE
                </div>
            )}

            <div className="flex justify-between items-start mb-4">
                <div className={`text-4xl p-3 rounded-xl ${!isOnline
                    ? 'bg-gray-300 text-gray-500'
                    : isOn ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                    {getIcon()}
                </div>
                <div className="flex gap-1">
                    <button
                        onClick={(e) => { e.stopPropagation(); handleRelease(); }}
                        disabled={!isOnline}
                        title="Release device"
                        className={`p-2 rounded-full transition-colors ${!isOnline
                            ? 'text-gray-400 cursor-not-allowed'
                            : isOn ? 'text-white/70 hover:text-white hover:bg-white/20' : 'text-gray-400 hover:text-orange-500 hover:bg-orange-50'
                            }`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                        disabled={!isOnline}
                        title="Delete device"
                        className={`p-2 rounded-full transition-colors ${!isOnline
                            ? 'text-gray-400 cursor-not-allowed'
                            : isOn ? 'text-white/70 hover:text-white hover:bg-white/20' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                            }`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
            </div>

            <div>
                <h3 className={`text-lg font-bold mb-1 ${!isOnline ? 'text-gray-600' : isOn ? 'text-white' : 'text-gray-800'}`}>{device.name}</h3>
                <p className={`text-sm ${!isOnline ? 'text-gray-500' : isOn ? 'text-blue-100' : 'text-gray-500'}`}>{device.type}</p>
                {device.ip ? (
                    <p className={`text-xs mt-1 ${!isOnline ? 'text-gray-400' : isOn ? 'text-blue-200' : 'text-gray-400'}`}>IP: {device.ip}</p>
                ) : (
                    <p className={`text-xs mt-1 ${!isOnline ? 'text-gray-400' : isOn ? 'text-blue-200' : 'text-gray-400'}`}>Offline / No IP</p>
                )}
                <p className={`text-xs ${!isOnline ? 'text-gray-400' : isOn ? 'text-blue-200' : 'text-gray-400'}`}>
                    {!isOnline ? 'Backend offline' : 'Click for details'}
                </p>
            </div>


        </div>
    );
};

export default DeviceCard;
