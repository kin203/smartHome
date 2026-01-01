import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Lightbulb, Fan, Thermometer, Plug, DoorOpen, Bell, Smartphone, Trash2 } from 'lucide-react-native';
import client from '../api/client';

const DeviceCard = ({ device, onDelete, onUpdate, onOpenDetail, isOnline = true }) => {
    const [isLoading, setIsLoading] = useState(false);

    const toggleStatus = async () => {
        if (!isOnline) return;

        setIsLoading(true);
        try {
            const newStatus = device.status === 'on' ? 'off' : 'on';

            if (device.ip) {
                const action = newStatus === 'on' ? 'open' : 'close';
                await client.post('/control', {
                    deviceId: device._id,
                    device: 'door',
                    action: action
                });
                onUpdate({ ...device, status: newStatus });
            } else {
                const response = await client.put(`/devices/${device._id}`, {
                    status: newStatus,
                });
                onUpdate(response.data);
            }
        } catch (error) {
            console.error('Error updating device:', error);
            Alert.alert('Error', 'Failed to control device');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = () => {
        if (!isOnline) return;

        Alert.alert('Delete Device', 'Are you sure you want to delete this device?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await client.delete(`/devices/${device._id}`);
                        onDelete(device._id);
                    } catch (error) {
                        console.error('Error deleting device:', error);
                    }
                }
            }
        ]);
    };

    const getIcon = () => {
        const color = isOnline ? (device.status === 'on' ? '#fff' : '#4B5563') : '#9CA3AF';
        const size = 32;
        switch (device.type) {
            case 'Light': return <Lightbulb size={size} color={color} />;
            case 'Fan': return <Fan size={size} color={color} />;
            case 'Sensor': return <Thermometer size={size} color={color} />;
            case 'Switch': return <Plug size={size} color={color} />;
            case 'Servo': return <DoorOpen size={size} color={color} />;
            case 'Buzzer': return <Bell size={size} color={color} />;
            default: return <Smartphone size={size} color={color} />;
        }
    };

    const isOn = device.status === 'on';

    return (
        <TouchableOpacity
            onPress={() => isOnline && onOpenDetail && onOpenDetail(device)}
            className={`rounded-2xl mb-4 mx-1 w-full shadow-sm flex-1 ${!isOnline ? 'opacity-60' : ''}`}
            style={{
                minWidth: '45%',
                shadowColor: "#000",
                shadowOffset: {
                    width: 0,
                    height: 2,
                },
                shadowOpacity: 0.1,
                shadowRadius: 3.84,
                elevation: 5,
            }}
        >
            <LinearGradient
                colors={isOnline && isOn ? ['#4F46E5', '#2563EB'] : ['#FFFFFF', '#F8FAFC']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="p-4 rounded-2xl h-full justify-between"
            >
                {!isOnline && (
                    <View className="absolute top-2 left-2 bg-red-500 px-2 py-0.5 rounded-full z-10">
                        <Text className="text-white text-[10px] font-bold">OFFLINE</Text>
                    </View>
                )}

                <View className="flex-row justify-between items-start mb-2">
                    <View className={`p-2.5 rounded-xl ${!isOnline
                        ? 'bg-gray-100'
                        : isOn ? 'bg-white/20' : 'bg-blue-50'
                        }`}>
                        {getIcon()}
                    </View>
                    <TouchableOpacity onPress={handleDelete} disabled={!isOnline} className="p-2">
                        <Trash2 size={18} color={!isOnline ? '#9CA3AF' : isOn ? '#fff' : '#94A3B8'} />
                    </TouchableOpacity>
                </View>

                <View>
                    <Text className={`text-lg font-bold mb-0.5 ${!isOnline ? 'text-gray-400' : isOn ? 'text-white' : 'text-slate-800'}`} numberOfLines={1}>
                        {device.name}
                    </Text>
                    <Text className={`text-xs ${!isOnline ? 'text-gray-300' : isOn ? 'text-blue-100' : 'text-slate-500'}`}>
                        {device.type}
                    </Text>
                </View>

                <View className="mt-4 flex-row justify-between items-center">
                    <Text className={`text-sm font-medium ${!isOnline ? 'text-gray-300' : isOn ? 'text-blue-50' : 'text-slate-400'}`}>
                        {isOn ? 'On' : 'Off'}
                    </Text>

                    <TouchableOpacity
                        onPress={(e) => { e.stopPropagation(); toggleStatus(); }}
                        disabled={isLoading || !isOnline}
                        className={`w-11 h-6 rounded-full p-0.5 justify-center transition-all ${!isOnline
                            ? 'bg-gray-200'
                            : isOn ? 'bg-white/30' : 'bg-slate-200'
                            }`}
                    >
                        {isLoading ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <View className={`bg-white w-5 h-5 rounded-full shadow-sm ${isOn ? 'self-end' : 'self-start'}`} />
                        )}
                    </TouchableOpacity>
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );
};

export default DeviceCard;
