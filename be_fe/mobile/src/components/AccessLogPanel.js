import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { DoorOpen, CheckCircle, XCircle } from 'lucide-react-native';
import client from '../api/client';

const AccessLogPanel = ({ deviceId }) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (deviceId) {
            fetchLogs();
            const interval = setInterval(fetchLogs, 2000); // Refresh every 2s
            return () => clearInterval(interval);
        }
    }, [deviceId]);

    const fetchLogs = async () => {
        // Don't show loading spinner on background refreshes to avoid flicker
        try {
            const response = await client.get(`/access-logs/device/${deviceId}?limit=20`);
            setLogs(response.data.logs);
        } catch (error) {
            console.error('Failed to fetch access logs:', error);
        }
    };

    const maskUID = (uid) => {
        if (!uid || uid.length <= 4) return uid;
        return '****' + uid.slice(-4);
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleString('vi-VN'); // Adjust locale as needed
    };

    return (
        <View className="bg-gray-100 rounded-xl p-4">
            <View className="flex-row justify-between items-center mb-4">
                <Text className="text-lg font-bold text-gray-800">🔐 Access Log</Text>
            </View>

            {logs.length === 0 ? (
                <View className="items-center py-10">
                    <Text className="text-4xl mb-2">📋</Text>
                    <Text className="text-gray-500">No access logs yet</Text>
                </View>
            ) : (
                <ScrollView className="max-h-96">
                    {logs.map((log, index) => {
                        const isDoorEvent = log.cardUID && log.cardUID.includes('DOOR');
                        const isDoorOpen = log.cardUID && log.cardUID.includes('OPEN');

                        // Determine styling based on event type
                        let bgClass = 'bg-white border-gray-200';
                        let icon = <XCircle size={24} color="#DC2626" />; // Default Denied
                        let statusText = 'DENIED';
                        let statusColor = 'text-red-700';

                        if (isDoorEvent) {
                            bgClass = 'bg-blue-50 border-blue-200';
                            icon = <DoorOpen size={24} color="#2563EB" />;
                            statusText = isDoorOpen ? 'OPEN' : 'CLOSE';
                            statusColor = 'text-blue-700';
                        } else if (log.accessGranted) {
                            bgClass = 'bg-green-50 border-green-200';
                            icon = <CheckCircle size={24} color="#16A34A" />;
                            statusText = 'GRANTED';
                            statusColor = 'text-green-700';
                        }

                        return (
                            <View
                                key={log._id || index}
                                className={`flex-row items-center justify-between p-3 rounded-lg mb-2 border ${bgClass}`}
                            >
                                <View className="flex-row items-center gap-3">
                                    {icon}
                                    <View>
                                        <Text className="font-mono text-sm font-bold text-gray-800">
                                            {isDoorEvent ? log.cardUID : maskUID(log.cardUID)}
                                        </Text>
                                        <Text className="text-xs text-gray-500">
                                            {formatTime(log.timestamp)}
                                        </Text>
                                    </View>
                                </View>
                                <Text className={`text-xs font-bold ${statusColor}`}>
                                    {statusText}
                                </Text>
                            </View>
                        );
                    })}
                </ScrollView>
            )}
        </View>
    );
};

export default AccessLogPanel;
