/**
 * Simplified Add Device Screen
 * Manual IP entry instead of BLE (Expo Go limitation)
 */
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';

export default function AddDeviceScreen() {
    const [deviceIP, setDeviceIP] = useState('');
    const [deviceName, setDeviceName] = useState('');

    const handleAddDevice = async () => {
        if (!deviceIP) {
            Alert.alert('Error', 'Please enter device IP address');
            return;
        }

        // Validate IP format
        const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (!ipPattern.test(deviceIP)) {
            Alert.alert('Error', 'Invalid IP address format');
            return;
        }

        try {
            // Test connection to device
            const response = await fetch(`http://${deviceIP}/scan`, {
                method: 'GET',
            });

            if (response.ok) {
                Alert.alert('Success', 'Device added successfully!', [
                    { text: 'OK', onPress: () => router.back() }
                ]);
            } else {
                Alert.alert('Error', 'Could not connect to device');
            }
        } catch (error) {
            Alert.alert('Error', 'Device not reachable. Check IP and WiFi connection.');
        }
    };

    return (
        <ScrollView className="flex-1 bg-gray-50">
            <View className="p-4">
                <View className="mb-6">
                    <Text className="text-2xl font-bold text-gray-900">Add Device Manually</Text>
                    <Text className="text-gray-600 mt-1">
                        Enter device IP address (must be on same WiFi)
                    </Text>
                </View>

                <View className="bg-blue-50 p-4 rounded-xl mb-6">
                    <Text className="text-sm font-medium text-blue-900 mb-2">
                        📱 Setup Instructions:
                    </Text>
                    <Text className="text-sm text-blue-700 mb-1">
                        1. Connect ESP32 to WiFi (via WiFiManager hotspot)
                    </Text>
                    <Text className="text-sm text-blue-700 mb-1">
                        2. Find device IP from Serial Monitor or Router
                    </Text>
                    <Text className="text-sm text-blue-700">
                        3. Enter IP here to add device
                    </Text>
                </View>

                <View className="space-y-4">
                    <View>
                        <Text className="text-sm font-medium text-gray-700 mb-2">
                            Device Name (Optional)
                        </Text>
                        <TextInput
                            value={deviceName}
                            onChangeText={setDeviceName}
                            placeholder="Living Room Light"
                            className="bg-white border border-gray-300 rounded-lg px-4 py-3"
                        />
                    </View>

                    <View>
                        <Text className="text-sm font-medium text-gray-700 mb-2">
                            Device IP Address *
                        </Text>
                        <TextInput
                            value={deviceIP}
                            onChangeText={setDeviceIP}
                            placeholder="192.168.1.100"
                            keyboardType="numeric"
                            className="bg-white border border-gray-300 rounded-lg px-4 py-3"
                        />
                    </View>

                    <TouchableOpacity
                        onPress={handleAddDevice}
                        className="bg-blue-600 py-4 rounded-lg mt-4 flex-row items-center justify-center"
                    >
                        <Plus size={20} color="white" />
                        <Text className="text-white text-center font-semibold text-lg ml-2">
                            Add Device
                        </Text>
                    </TouchableOpacity>

                    <View className="mt-6 p-4 bg-yellow-50 rounded-lg">
                        <Text className="text-sm font-medium text-yellow-900 mb-1">
                            💡 Note: BLE Provisioning
                        </Text>
                        <Text className="text-xs text-yellow-700">
                            BLE requires Development Build (not Expo Go).{'\n'}
                            Use WiFiManager + manual IP for now.
                        </Text>
                    </View>
                </View>
            </View>
        </ScrollView>
    );
}
