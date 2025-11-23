import { useState, useEffect } from 'react';
import axios from '../api/axios';

const AccessLogPanel = ({ deviceId }) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (deviceId) {
            fetchLogs();
            const interval = setInterval(fetchLogs, 1000); // Auto-refresh every 1s for real-time
            return () => clearInterval(interval);
        }
    }, [deviceId]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`/access-logs/device/${deviceId}?limit=20`);
            setLogs(response.data.logs);
        } catch (error) {
            console.error('Failed to fetch access logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const maskUID = (uid) => {
        if (uid.length <= 4) return uid;
        return '****' + uid.slice(-4);
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleString('vi-VN');
    };

    return (
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800">🔐 Access Log</h3>
                {loading && <span className="text-sm text-gray-500 animate-pulse">Refreshing...</span>}
            </div>

            {logs.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                    <div className="text-4xl mb-2">📋</div>
                    <p>No access logs yet</p>
                </div>
            ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                    {logs.map((log, index) => {
                        // Check if this is a door event
                        const isDoorEvent = log.cardUID.includes('DOOR');
                        const isDoorOpen = log.cardUID.includes('OPEN');
                        const isDoorClose = log.cardUID.includes('CLOSE');

                        return (
                            <div
                                key={log._id || index}
                                className={`flex items-center justify-between p-3 rounded-lg ${isDoorEvent
                                        ? 'bg-blue-50 border border-blue-200'
                                        : log.accessGranted
                                            ? 'bg-green-50 border border-green-200'
                                            : 'bg-red-50 border border-red-200'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`text-2xl ${isDoorEvent
                                            ? 'text-blue-600'
                                            : log.accessGranted ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                        {isDoorEvent ? '🚪' : (log.accessGranted ? '✅' : '❌')}
                                    </div>
                                    <div>
                                        <div className="font-mono text-sm font-bold text-gray-800">
                                            {isDoorEvent ? log.cardUID : maskUID(log.cardUID)}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {formatTime(log.timestamp)}
                                        </div>
                                    </div>
                                </div>
                                <div className={`text-xs font-bold ${isDoorEvent
                                        ? 'text-blue-700'
                                        : log.accessGranted ? 'text-green-700' : 'text-red-700'
                                    }`}>
                                    {isDoorEvent
                                        ? (isDoorOpen ? 'OPEN' : 'CLOSE')
                                        : (log.accessGranted ? 'GRANTED' : 'DENIED')
                                    }
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default AccessLogPanel;
