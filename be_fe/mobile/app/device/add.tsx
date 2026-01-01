import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Wifi, Server, CheckCircle, AlertCircle } from 'lucide-react-native';
import client from '../../src/api/client';

export default function AddDeviceScreen() {
    const [activeTab, setActiveTab] = useState('scan'); // 'scan' | 'manual'
    const [scanning, setScanning] = useState(false);
    const [ipAddress, setIpAddress] = useState('');
    const [discoveredDevices, setDiscoveredDevices] = useState([]);
    const [manualLoading, setManualLoading] = useState(false);
    const router = useRouter();

    const handleScan = async () => {
        setScanning(true);
        setDiscoveredDevices([]);
        try {
            const response = await client.get('/scan');
            if (response.data && response.data.length > 0) {
                setDiscoveredDevices(response.data);
                Alert.alert('Scan Complete', `Found ${response.data.length} devices.`);
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

    const handleManualAdd = async () => {
        if (!ipAddress) {
            Alert.alert('Error', 'Please enter an IP address');
            return;
        }
        setManualLoading(true);
        try {
            await client.post('/scan/manual', { ip: ipAddress });
            Alert.alert('Success', 'Device added successfully', [
                { text: 'OK', onPress: () => router.back() }
            ]);
        } catch (error) {
            console.log('Manual add error:', error);
            Alert.alert('Error', error.response?.data?.message || 'Failed to add device');
        } finally {
            setManualLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
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
                    <View className="items-center mt-10">
                        <View className="w-32 h-32 bg-blue-100 rounded-full items-center justify-center mb-6">
                            {scanning ? (
                                <ActivityIndicator size="large" color="#2563EB" />
                            ) : (
                                <Search size={48} color="#2563EB" />
                            )}
                        </View>

                        <Text className="text-xl font-bold text-gray-800 mb-2">
                            {scanning ? 'Scanning for devices...' : 'Find devices nearby'}
                        </Text>
                        <Text className="text-gray-500 text-center mb-8 px-10">
                            Make sure your ESP32 device is powered on and connected to the same Wi-Fi network.
                        </Text>

                        {!scanning && (
                            <TouchableOpacity
                                onPress={handleScan}
                                className="bg-blue-600 px-8 py-3 rounded-full shadow-md active:bg-blue-700"
                            >
                                <Text className="text-white font-bold text-lg">Start Scan</Text>
                            </TouchableOpacity>
                        )}

                        <ScrollView className="w-full mt-8">
                            {discoveredDevices.map((device, index) => (
                                <View key={index} className="bg-white p-4 rounded-xl shadow-sm mb-3 flex-row items-center justify-between">
                                    <View className="flex-row items-center gap-3">
                                        <View className="bg-green-100 p-2 rounded-full">
                                            <CheckCircle size={20} color="#16A34A" />
                                        </View>
                                        <View>
                                            <Text className="font-bold text-gray-800">{device.name || 'New Device'}</Text>
                                            <Text className="text-xs text-gray-500">{device.ip}</Text>
                                        </View>
                                    </View>
                                    <Text className="text-green-600 font-bold text-xs">Added</Text>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                ) : (
                    <View className="bg-white p-6 rounded-2xl shadow-sm mt-4">
                        <Text className="text-lg font-bold text-gray-800 mb-4">Enter Device IP</Text>
                        <Text className="text-gray-500 text-sm mb-4">
                            If automatic scanning doesn't work, you can enter the device's IP address manually (e.g., 192.168.1.100).
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
                            disabled={manualLoading}
                            className={`py-3 rounded-xl items-center ${manualLoading ? 'bg-gray-400' : 'bg-blue-600'}`}
                        >
                            {manualLoading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text className="text-white font-bold text-lg">Add Device</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
}
