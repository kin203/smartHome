import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import client from '../../src/api/client';
import { useFocusEffect, useRouter } from 'expo-router';
import DeviceCard from '../../src/components/DeviceCard';
import { useBackendStatus } from '../../src/context/BackendStatusContext';

export default function HomeScreen() {
  const [devices, setDevices] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeDevice, setActiveDevice] = useState(null); // For detail modal if we used one, but here we navigate
  const router = useRouter();
  const { isBackendOnline } = useBackendStatus(); // Fixed: was isOnline, now matches context export

  const fetchDevices = async () => {
    try {
      const res = await client.get('/devices');
      setDevices(res.data);
    } catch (err) {
      console.error("Fetch devices error:", err);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchDevices();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDevices();
    setRefreshing(false);
  };

  const handleDeviceUpdate = (updatedDevice) => {
    setDevices(prev => prev.map(d => d._id === updatedDevice._id ? updatedDevice : d));
  };

  const handleDeviceDelete = (deviceId) => {
    setDevices(prev => prev.filter(d => d._id !== deviceId));
  };

  const handleOpenDetail = (device) => {
    router.push({ pathname: `/device/${device._id}`, params: { name: device.name } });
  };

  // Grouping Logic matching Web Dashboard
  const groupedDevices = devices.reduce((acc, device) => {
    const room = device.room || 'Khác';
    if (!acc[room]) acc[room] = [];
    acc[room].push(device);
    return acc;
  }, {});

  const roomOrder = ['Phòng Khách', 'Phòng Ngủ', 'Nhà Bếp', 'Khác'];
  const sortedRooms = Object.keys(groupedDevices).sort((a, b) => {
    const indexA = roomOrder.indexOf(a);
    const indexB = roomOrder.indexOf(b);
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return a.localeCompare(b);
  });

  return (
    <View className="flex-1">
      <StatusBar style="dark" />
      <LinearGradient
        colors={['#E6EFFD', '#F0F4FC', '#FFFFFF']}
        className="absolute inset-0"
      />

      <SafeAreaView className="flex-1 px-4 pt-2">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Header */}
          <View className="flex-row justify-between items-center mb-6">
            <View>
              <Text className="text-gray-500 font-medium uppercase text-xs tracking-wider">Home</Text>
              <Text className="text-2xl font-bold text-gray-900">My Sanctuary</Text>
            </View>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => router.push('/device/add')}
                className="w-10 h-10 bg-blue-600 rounded-full items-center justify-center shadow-lg shadow-blue-500/30"
              >
                <Ionicons name="add" size={24} color="white" />
              </TouchableOpacity>
              <TouchableOpacity className="w-10 h-10 bg-white rounded-full items-center justify-center shadow-sm">
                <Ionicons name="notifications-outline" size={20} color="black" />
              </TouchableOpacity>
            </View>
          </View>

          {!isBackendOnline && (
            <View className="bg-red-500 p-2 rounded-lg mb-4 flex-row items-center justify-center gap-2">
              <Ionicons name="cloud-offline" size={20} color="white" />
              <Text className="text-white font-bold text-xs uppercase">Backend Offline</Text>
            </View>
          )}

          {devices.length === 0 && !refreshing ? (
            <View className="items-center justify-center py-20 bg-white/50 rounded-3xl border border-white">
              <View className="w-20 h-20 bg-blue-50 rounded-full items-center justify-center mb-4">
                <Ionicons name="cube-outline" size={40} color="#3B82F6" />
              </View>
              <Text className="text-xl font-bold text-gray-800">No Devices Found</Text>
              <Text className="text-gray-500 mt-2 mb-6">Add your first smart device to get started</Text>
              <TouchableOpacity
                onPress={() => router.push('/device/add')}
                className="bg-blue-600 px-6 py-3 rounded-xl"
              >
                <Text className="text-white font-bold">Add Device</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="space-y-6">
              {sortedRooms.map(room => (
                <View key={room}>
                  <View className="flex-row items-center gap-2 mb-3">
                    <View className={`p-1.5 rounded-lg ${room === 'Phòng Khách' ? 'bg-orange-100' :
                      room === 'Phòng Ngủ' ? 'bg-indigo-100' :
                        room === 'Nhà Bếp' ? 'bg-red-100' : 'bg-gray-100'
                      }`}>
                      <Ionicons
                        name={
                          room === 'Phòng Khách' ? 'tv-outline' :
                            room === 'Phòng Ngủ' ? 'bed-outline' :
                              room === 'Nhà Bếp' ? 'restaurant-outline' : 'grid-outline'
                        }
                        size={16}
                        color={
                          room === 'Phòng Khách' ? '#EA580C' :
                            room === 'Phòng Ngủ' ? '#4F46E5' :
                              room === 'Nhà Bếp' ? '#DC2626' : '#4B5563'
                        }
                      />
                    </View>
                    <Text className="text-xl font-bold text-gray-800">{room}</Text>
                    <Text className="text-xs text-gray-400 bg-white px-2 py-0.5 rounded-full font-bold ml-auto">
                      {groupedDevices[room].length}
                    </Text>
                  </View>

                  <View className="flex-row flex-wrap justify-between">
                    {groupedDevices[room].map(device => (
                      <DeviceCard
                        key={device._id}
                        device={device}
                        onUpdate={handleDeviceUpdate}
                        onDelete={handleDeviceDelete}
                        onOpenDetail={handleOpenDetail}
                        isOnline={isBackendOnline}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
