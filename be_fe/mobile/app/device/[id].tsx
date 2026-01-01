import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import client from '../../src/api/client';
import { Thermometer, Droplets, wind, CloudRain, ShieldAlert, DoorOpen, Bell, Monitor, Lightbulb } from 'lucide-react-native';

export default function DeviceDetailScreen() {
    const { id } = useLocalSearchParams();
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('control');
    const [device, setDevice] = useState(null);
    const [deviceOffline, setDeviceOffline] = useState(false);

    const fetchStatus = useCallback(async () => {
        try {
            const response = await client.get(`/status/${id}`);
            setStatus(response.data);
            setDeviceOffline(false);
        } catch (error) {
            console.log('Fetch status error:', error.message);
            if (error.response && error.response.status === 504) {
                setDeviceOffline(true);
            }
        }
    }, [id]);

    const fetchDevice = useCallback(async () => {
        try {
            // Fetch device details from list (or specific endpoint if available)
            // For now, assume we get it from list or just display status
            const listRes = await client.get('/devices');
            const found = listRes.data.find(d => d._id === id);
            if (found) setDevice(found);
        } catch (e) {
            console.error(e);
        }
    }, [id]);

    useEffect(() => {
        fetchDevice();
        fetchStatus();
        const interval = setInterval(fetchStatus, 2000);
        return () => clearInterval(interval);
    }, [fetchDevice, fetchStatus]);

    const sendCommand = async (deviceType, action, value, channel) => {
        setLoading(true);
        try {
            await client.post('/control', {
                deviceId: id,
                device: deviceType,
                action,
                value,
                channel
            });
            await fetchStatus();
        } catch (error) {
            console.error('Control error:', error);
            Alert.alert('Error', 'Failed to control device');
        } finally {
            setLoading(false);
        }
    };

    const toggleRelay = async (channel) => {
        if (!status) return;
        const currentState = status[`relay${channel}`];
        await sendCommand('relay', currentState ? 'off' : 'on', null, channel);
    };

    if (!status && !deviceOffline) {
        return (
            <SafeAreaView className="flex-1 justify-center items-center bg-gray-50">
                <ActivityIndicator size="large" color="#2563EB" />
                <Text className="text-gray-500 mt-4">Loading status...</Text>
            </SafeAreaView>
        );
    }

    if (!status && deviceOffline) {
        return (
            <SafeAreaView className="flex-1 bg-gray-50">
                <Stack.Screen options={{ title: device?.name || 'Device Offline', headerBackTitle: 'Back' }} />
                <View className="flex-1 justify-center items-center p-4">
                    <ShieldAlert size={48} color="#DC2626" />
                    <Text className="text-xl font-bold text-gray-800 mt-4">Device Unreachable</Text>
                    <Text className="text-gray-500 text-center mt-2">The ESP32 device is not responding (504 Gateway Timeout). Please check if it is powered on and connected to WiFi.</Text>
                    <TouchableOpacity onPress={fetchStatus} className="mt-6 bg-blue-600 px-6 py-3 rounded-full">
                        <Text className="text-white font-bold">Retry</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <Stack.Screen options={{ title: device?.name || 'Device Details', headerBackTitle: 'Back' }} />

            <View className="flex-row border-b border-gray-200 bg-white">
                <TouchableOpacity onPress={() => setActiveTab('control')} className={`flex-1 py-4 items-center ${activeTab === 'control' ? 'border-b-2 border-blue-600' : ''}`}>
                    <Text className={`font-bold ${activeTab === 'control' ? 'text-blue-600' : 'text-gray-500'}`}>Control</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setActiveTab('relay')} className={`flex-1 py-4 items-center ${activeTab === 'relay' ? 'border-b-2 border-blue-600' : ''}`}>
                    <Text className={`font-bold ${activeTab === 'relay' ? 'text-blue-600' : 'text-gray-500'}`}>Lights</Text>
                </TouchableOpacity>
                {/* Add more tabs for Logs etc. later */}
            </View>

            {deviceOffline && (
                <View className="bg-red-500 px-4 py-2 flex-row justify-center items-center">
                    <Text className="text-white font-bold text-xs">Device is Offline (Last known status)</Text>
                </View>
            )}

            <ScrollView className="flex-1 p-4">
                {activeTab === 'control' && (
                    <View className="space-y-6">
                        {/* Sensor Data */}
                        <View className="bg-blue-50 rounded-xl p-4">
                            <Text className="text-lg font-bold text-gray-800 mb-4">📊 Sensor Data</Text>
                            <View className="flex-row flex-wrap justify-between">
                                <View className="bg-white rounded-lg p-3 m-1 w-[45%] items-center shadow-sm">
                                    <Thermometer size={24} color="#2563EB" />
                                    <Text className="text-xl font-bold text-blue-600 mt-1">{status.temperature}°C</Text>
                                    <Text className="text-xs text-gray-500">Temp</Text>
                                </View>
                                <View className="bg-white rounded-lg p-3 m-1 w-[45%] items-center shadow-sm">
                                    <Droplets size={24} color="#2563EB" />
                                    <Text className="text-xl font-bold text-blue-600 mt-1">{status.humidity}%</Text>
                                    <Text className="text-xs text-gray-500">Humidity</Text>
                                </View>
                                <View className="bg-white rounded-lg p-3 m-1 w-[45%] items-center shadow-sm">
                                    <ShieldAlert size={24} color={status.gasAlert ? '#DC2626' : '#16A34A'} />
                                    <Text className={`text-xl font-bold mt-1 ${status.gasAlert ? 'text-red-600' : 'text-green-600'}`}>{status.gas}</Text>
                                    <Text className="text-xs text-gray-500">Gas</Text>
                                </View>
                                <View className="bg-white rounded-lg p-3 m-1 w-[45%] items-center shadow-sm">
                                    <CloudRain size={24} color="#4B5563" />
                                    <Text className="text-lg font-bold text-gray-700 mt-1 capitalize">{status.rain}</Text>
                                    <Text className="text-xs text-gray-500">Rain</Text>
                                </View>
                            </View>
                        </View>

                        {/* Door Control */}
                        <View className="bg-green-50 rounded-xl p-4">
                            <Text className="text-lg font-bold text-gray-800 mb-4">🚪 Door Control</Text>
                            <View className="flex-row justify-between items-center mb-4">
                                <Text className="text-2xl font-bold text-green-700 capitalize">{status.door}</Text>
                                <Text className="text-sm text-gray-600">Status</Text>
                            </View>
                            <View className="flex-row gap-2">
                                <TouchableOpacity
                                    onPress={() => sendCommand('door', 'open')}
                                    disabled={loading || status.door === 'open'}
                                    className={`flex-1 py-3 rounded-lg items-center ${status.door === 'open' ? 'bg-gray-300' : 'bg-green-600'}`}
                                >
                                    <Text className="text-white font-bold">Open</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => sendCommand('door', 'close')}
                                    disabled={loading || status.door === 'closed'}
                                    className={`flex-1 py-3 rounded-lg items-center ${status.door === 'closed' ? 'bg-gray-300' : 'bg-red-600'}`}
                                >
                                    <Text className="text-white font-bold">Close</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Buzzer & Screen */}
                        <View className="flex-row gap-4">
                            <View className="flex-1 bg-yellow-50 rounded-xl p-4">
                                <Text className="font-bold text-gray-800 mb-2">🔔 Buzzer</Text>
                                <TouchableOpacity onPress={() => sendCommand('buzzer', 'beep')} className="bg-yellow-600 py-2 rounded-lg items-center mb-2">
                                    <Text className="text-white font-bold text-xs">Beep</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => sendCommand('buzzer', 'alert')} className="bg-orange-600 py-2 rounded-lg items-center">
                                    <Text className="text-white font-bold text-xs">Alert</Text>
                                </TouchableOpacity>
                            </View>

                            <View className="flex-1 bg-purple-50 rounded-xl p-4">
                                <Text className="font-bold text-gray-800 mb-2">📺 Screen</Text>
                                <View className="space-y-2">
                                    <TouchableOpacity onPress={() => sendCommand('screen', null, 0)} className={`py-2 px-2 rounded-lg items-center ${status.screen === 0 ? 'bg-purple-600' : 'bg-white border border-purple-200'}`}>
                                        <Text className={`text-xs font-bold ${status.screen === 0 ? 'text-white' : 'text-purple-600'}`}>Main</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => sendCommand('screen', null, 1)} className={`py-2 px-2 rounded-lg items-center ${status.screen === 1 ? 'bg-purple-600' : 'bg-white border border-purple-200'}`}>
                                        <Text className={`text-xs font-bold ${status.screen === 1 ? 'text-white' : 'text-purple-600'}`}>DHT</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => sendCommand('screen', null, 2)} className={`py-2 px-2 rounded-lg items-center ${status.screen === 2 ? 'bg-purple-600' : 'bg-white border border-purple-200'}`}>
                                        <Text className={`text-xs font-bold ${status.screen === 2 ? 'text-white' : 'text-purple-600'}`}>Other</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </View>
                )}

                {activeTab === 'relay' && (
                    <View className="space-y-4">
                        <Text className="text-xl font-bold text-gray-800 mb-2">💡 Light Control</Text>
                        {[1, 2, 3, 4].map(channel => (
                            <View key={channel} className={`flex-row items-center justify-between p-4 rounded-xl shadow-sm ${status[`relay${channel}`] ? 'bg-yellow-100 border border-yellow-200' : 'bg-white'}`}>
                                <View>
                                    <Text className="text-lg font-bold text-gray-800">Light {channel}</Text>
                                    <Text className="text-xs text-gray-500">GPIO {channel === 1 ? '26' : channel === 2 ? '33' : channel === 3 ? '15' : '2'}</Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => toggleRelay(channel)}
                                    className={`w-12 h-6 rounded-full p-1 transition-colors ${status[`relay${channel}`] ? 'bg-yellow-500' : 'bg-gray-300'}`}
                                >
                                    <View className={`bg-white w-4 h-4 rounded-full shadow-md ${status[`relay${channel}`] ? 'self-end' : 'self-start'}`} />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                )}

                <View className="h-10" />
            </ScrollView>
        </SafeAreaView>
    );
}
