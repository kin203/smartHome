import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
// import { SafeAreaView } from 'react-native-safe-area-context'; // Removed to avoid double padding with Header
import { Search, Wifi, Server, CheckCircle, PlusCircle } from 'lucide-react-native';
import client from '../../src/api/client';

export default function AddDeviceScreen() {
    const [activeTab, setActiveTab] = useState('scan'); // 'scan' | 'manual'
    const [scanning, setScanning] = useState(false);
    const [ipAddress, setIpAddress] = useState('');
    const [discoveredDevices, setDiscoveredDevices] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleScan = async () => {
        setScanning(true);
        setDiscoveredDevices([]);
        try {
            const response = await client.get('/scan');
            if (response.data && response.data.length > 0) {
                setDiscoveredDevices(response.data);
            } else {
                Alert.alert('Scan Complete', 'No new devices found.');
            }
        } catch (error) {
            console.log('Scan error:', error);
            Alert.alert('Error', 'Failed to scan network.');
        } finally {
            setScanning(false);
        }
    };

    const registerDevice = async (deviceData: any) => {
        setLoading(true);
        try {
            // Register device to DB
            await client.post('/devices', {
                name: deviceData.name || 'New Device',
                type: deviceData.type || 'Hub', // Default to Hub for ESP32
                room: 'Living Room', // Default room
                ip: deviceData.ip,
                mac: deviceData.mac,
                status: deviceData.status || 'off',
                settings: deviceData.settings || {}
            });
            Alert.alert('Success', 'Device added successfully', [
                {
                    text: 'OK', onPress: () => {
                        // Safe navigation: check if can go back, otherwise replace to tabs
                        if (router.canGoBack()) {
                            router.back();
                        } else {
                            router.replace('/(tabs)');
                        }
                    }
                }
            ]);
        } catch (error: any) {
            console.error('Registration error:', error);
            Alert.alert('Error', error.response?.data?.message || 'Failed to register device');
        } finally {
            setLoading(false);
        }
    };

    const handleManualAdd = async () => {
        if (!ipAddress) {
            Alert.alert('Error', 'Please enter an IP address');
            return;
        }
        setLoading(true);
        try {
            // 1. Verify device exists
            const response = await client.post('/scan/manual', { ip: ipAddress });
            const deviceData = response.data;

            // 2. Register device
            await client.post('/devices', {
                name: deviceData.name || 'Manual Device',
                type: deviceData.type || 'Hub',
                room: 'Living Room',
                ip: deviceData.ip || ipAddress,
                mac: deviceData.mac,
                status: deviceData.status || 'off',
                settings: deviceData.settings || {}
            });

            Alert.alert('Success', 'Device added successfully', [
                {
                    text: 'OK', onPress: () => {
                        if (router.canGoBack()) {
                            router.back();
                        } else {
                            router.replace('/(tabs)');
                        }
                    }
                }
            ]);
        } catch (error: any) {
            console.log('Manual add error:', error);
            Alert.alert('Error', error.response?.data?.message || 'Failed to find/add device');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View className="flex-1 bg-gray-50">
            {/* Native Header is enabled in _layout.tsx, so no manual header needed here if using Stack.Screen properly? 
                Wait, if I use Stack.Screen inside component, it configures the parent. */}
            <Stack.Screen options={{ title: 'Add New Device', headerBackTitle: 'Cancel' }} />

            {/* Tabs */}
            <View className="flex-row border-b border-gray-200 bg-white">
                <TouchableOpacity
                    onPress={() => setActiveTab('scan')}
                    className={`flex-1 py-4 items-center flex-row justify-center gap-2 ${activeTab === 'scan' ? 'border-b-2 border-blue-600' : ''}`}
                >
                    <Wifi size={20} color={activeTab === 'scan' ? '#2563EB' : '#6B7280'} />
                    <Text className={`font-bold ${activeTab === 'scan' ? 'text-blue-600' : 'text-gray-500'}`}>Scan Network</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setActiveTab('manual')}
                    className={`flex-1 py-4 items-center flex-row justify-center gap-2 ${activeTab === 'manual' ? 'border-b-2 border-blue-600' : ''}`}
                >
                    <Server size={20} color={activeTab === 'manual' ? '#2563EB' : '#6B7280'} />
                    <Text className={`font-bold ${activeTab === 'manual' ? 'text-blue-600' : 'text-gray-500'}`}>Manual IP</Text>
                </TouchableOpacity>
            </View>

            <View className="flex-1 p-4">
                {activeTab === 'scan' ? (
                    <View className="items-center mt-6">
                        <View className="w-24 h-24 bg-blue-100 rounded-full items-center justify-center mb-6">
                            {scanning ? (
                                <ActivityIndicator size="large" color="#2563EB" />
                            ) : (
                                <Search size={40} color="#2563EB" />
                            )}
                        </View>

                        <Text className="text-xl font-bold text-gray-800 mb-2">
                            {scanning ? 'Scanning for devices...' : 'Find devices nearby'}
                        </Text>

                        {!scanning && discoveredDevices.length === 0 && (
                            <TouchableOpacity
                                onPress={handleScan}
                                className="bg-blue-600 px-8 py-3 rounded-full shadow-md active:bg-blue-700 mt-4"
                            >
                                <Text className="text-white font-bold text-lg">Start Scan</Text>
                            </TouchableOpacity>
                        )}

                        <ScrollView className="w-full mt-6">
                            {discoveredDevices.map((device, index) => (
                                <View key={index} className="bg-white p-4 rounded-xl shadow-sm mb-3 flex-row items-center justify-between">
                                    <View className="flex-row items-center gap-3 flex-1">
                                        <View className="bg-green-100 p-2 rounded-full">
                                            <Wifi size={20} color="#16A34A" />
                                        </View>
                                        <View>
                                            <Text className="font-bold text-gray-800">{device.name || 'Unknown Device'}</Text>
                                            <Text className="text-xs text-gray-500">{device.ip}</Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => registerDevice(device)}
                                        disabled={loading}
                                        className="bg-blue-100 p-2 rounded-full"
                                    >
                                        {loading ? <ActivityIndicator size="small" color="#2563EB" /> : <PlusCircle size={24} color="#2563EB" />}
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                ) : (
                    <View className="bg-white p-6 rounded-2xl shadow-sm mt-4">
                        <Text className="text-lg font-bold text-gray-800 mb-4">Enter Device IP</Text>
                        <Text className="text-gray-500 text-sm mb-4">
                            Usually: 192.168.1.x or check your router.
                        </Text>

                        <View className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-6 flex-row items-center">
                            <Server size={20} color="#9CA3AF" />
                            <TextInput
                                className="flex-1 ml-3 text-base text-gray-800"
                                placeholder="192.168.1.x"
                                value={ipAddress}
                                onChangeText={setIpAddress}
                                keyboardType="numeric"
                                autoCapitalize="none"
                            />
                        </View>

                        <TouchableOpacity
                            onPress={handleManualAdd}
                            disabled={loading}
                            className={`py-3 rounded-xl items-center ${loading ? 'bg-gray-400' : 'bg-blue-600'}`}
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text className="text-white font-bold text-lg">Add Device</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </View>
    );
}
