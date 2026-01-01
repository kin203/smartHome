import React, { useState, useEffect, useContext, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus } from 'lucide-react-native';

import client from '../../src/api/client';
import DeviceCard from '../../src/components/DeviceCard';
import { useBackendStatus } from '../../src/context/BackendStatusContext';
import { AuthContext } from '../../src/context/AuthContext';

export default function Dashboard() {
  const [devices, setDevices] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const { isOnline } = useBackendStatus();
  const { user } = useContext(AuthContext);
  const router = useRouter();

  const fetchDevices = async () => {
    try {
      const response = await client.get('/devices');
      setDevices(response.data);
    } catch (error) {
      console.error('Error fetching devices:', error);
      // Don't show alert on every fetch failure if offline, useContext handles banner
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchDevices();
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDevices();
    setRefreshing(false);
  }, []);

  const handleUpdateDevice = (updatedDevice) => {
    setDevices(devices.map((d) => d._id === updatedDevice._id ? updatedDevice : d));
  };

  const handleDeleteDevice = (deviceId) => {
    setDevices(devices.filter((d) => d._id !== deviceId));
  };

  const handleOpenDetail = (device) => {
    router.push(`/device/${device._id}`);
  };

  const handleAddDevice = () => {
    router.push('/device/add');
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="shadow-md z-10">
        <LinearGradient
          colors={['#4F46E5', '#2563EB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          className="px-6 py-6 pt-2 pb-6 flex-row justify-between items-center bg-blue-600 rounded-b-3xl"
        >
          <View>
            <Text className="text-3xl font-extrabold text-white">My Home</Text>
            <Text className="text-blue-100 text-sm mt-1">Welcome, {user?.name}</Text>
          </View>
          <TouchableOpacity onPress={handleAddDevice} className="bg-white/20 p-2.5 rounded-full border border-white/30 backdrop-blur-md">
            <Plus size={24} color="#fff" />
          </TouchableOpacity>
        </LinearGradient>
      </View>

      {/* Offline Banner */}
      {!isOnline && (
        <View className="bg-red-500 px-4 py-2 flex-row justify-center items-center">
          <Text className="text-white font-bold text-sm">Backend Offline</Text>
        </View>
      )}

      <ScrollView
        className="flex-1 px-4 py-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {devices.length === 0 ? (
          <View className="items-center justify-center py-20 bg-white rounded-xl shadow-sm mt-4">
            <Text className="text-gray-500 text-lg mb-2">No devices found</Text>
            <Text className="text-gray-400 text-sm text-center px-8">Pull down to refresh or check backend connection.</Text>
          </View>
        ) : (
          <View className="flex-row flex-wrap justify-between">
            {devices.map((device) => (
              <DeviceCard
                key={device._id}
                device={device}
                onDelete={handleDeleteDevice}
                onUpdate={handleUpdateDevice}
                onOpenDetail={handleOpenDetail}
                isOnline={isOnline}
              />
            ))}
          </View>
        )}
        <View className="h-20" />
      </ScrollView>
    </SafeAreaView>
  );
}
