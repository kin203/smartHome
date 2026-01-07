import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import clsx from 'clsx';
import client from '../../src/api/client';
import { useFocusEffect } from 'expo-router';

// Helper to determine icon based on state
const DeviceCard = ({ icon, title, subtitle, isActive, type, color = "blue", onPress, isLoading }) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isLoading || type === 'sensor'}
      className={clsx("w-[48%] p-4 rounded-3xl mb-4 h-44 justify-between shadow-sm", isActive ? "bg-white" : "bg-white/60")}
    >
      <View className="flex-row justify-between items-start">
        <View className={clsx("w-10 h-10 rounded-full items-center justify-center", isActive ? `bg-${color}-100` : "bg-gray-100")}>
          {isLoading ? <ActivityIndicator size="small" color="#3B82F6" /> : icon}
        </View>
        {type === 'switch' && (
          <View className={clsx("w-12 h-7 rounded-full justify-center px-1", isActive ? "bg-blue-500" : "bg-gray-300")}>
            <View className={clsx("w-5 h-5 bg-white rounded-full shadow", isActive && "self-end")} />
          </View>
        )}
        {type === 'sensor' && (
          <View className={clsx("w-3 h-3 rounded-full", isActive ? "bg-green-500" : "bg-gray-400")} />
        )}
        {type === 'alert' && isActive && (
          <View className="bg-red-100 px-2 py-1 rounded-md animate-pulse">
            <Text className="text-red-700 text-xs font-bold">ALERT</Text>
          </View>
        )}
      </View>

      <View>
        <Text className="text-gray-800 font-bold text-lg">{title}</Text>
        <Text className={clsx("text-sm mt-1", isActive ? "text-blue-500 font-medium" : "text-gray-500")}>{subtitle}</Text>
      </View>
    </TouchableOpacity>
  );
};

export default function HomeScreen() {
  const [devices, setDevices] = useState([]);
  const [deviceStatus, setDeviceStatus] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingControl, setLoadingControl] = useState(null); // 'relay1' | 'relay2' etc.

  const fetchDevices = async () => {
    try {
      const res = await client.get('/devices');
      setDevices(res.data);
      if (res.data.length > 0) {
        fetchStatus(res.data[0]._id);
      }
    } catch (err) {
      console.error("Fetch devices error:", err);
    }
  };

  const fetchStatus = async (deviceId) => {
    try {
      const res = await client.get(`/status/${deviceId}`);
      setDeviceStatus(res.data);
    } catch (err) {
      console.error("Fetch status error:", err);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchDevices();
      const interval = setInterval(() => {
        if (devices.length > 0) fetchStatus(devices[0]._id);
      }, 2000);
      return () => clearInterval(interval);
    }, [devices.length]) // Re-run if devices list changes to start polling
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDevices();
    setRefreshing(false);
  };

  const handleControl = async (type, channel, currentState) => {
    if (!devices[0]) return;
    const action = currentState ? 'off' : 'on';
    setLoadingControl(`relay${channel}`);
    try {
      await client.post('/control', {
        deviceId: devices[0]._id,
        device: type,
        action: action,
        channel: channel
      });
      // Optimistic update or wait for poll
      await fetchStatus(devices[0]._id);
    } catch (err) {
      Alert.alert("Error", "Failed to control device");
    } finally {
      setLoadingControl(null);
    }
  };

  // Main UI Data
  const mainDevice = devices[0];
  const temp = deviceStatus?.temperature || '--';
  const hum = deviceStatus?.humidity || '--';
  const weatherIcon = deviceStatus?.rain === 'detected' ? 'rainy' : 'sunny';

  // Channels
  // Mapping: Relays to Rooms (Based on user config: 1=Bedroom, 2=Kitchen, 3=Living)
  const relay1 = deviceStatus?.relay1; // Bedroom
  const relay2 = deviceStatus?.relay2; // Kitchen
  const relay3 = deviceStatus?.relay3; // Living Room

  const gasLevel = deviceStatus?.gas || 0;
  const gasAlert = deviceStatus?.gasAlert || false;

  return (
    <View className="flex-1">
      <StatusBar style="dark" />
      <LinearGradient
        colors={['#E6EFFD', '#F0F4FC', '#FFFFFF']}
        className="absolute inset-0"
      />

      <SafeAreaView className="flex-1 px-6 pt-2">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >

          {/* Header */}
          <View className="flex-row justify-between items-center mb-6">
            <View>
              <View className="flex-row items-center gap-1">
                <Text className="text-gray-500 font-medium uppercase text-xs tracking-wider">Home</Text>
              </View>
              <View className="flex-row items-center gap-1">
                <Text className="text-xl font-bold text-gray-900">My Sanctuary</Text>
                <Ionicons name="chevron-down" size={18} color="black" />
              </View>
            </View>
            <TouchableOpacity className="w-10 h-10 bg-white rounded-full items-center justify-center shadow-sm">
              <Ionicons name="notifications-outline" size={20} color="black" />
              <View className="absolute top-2 right-3 w-2 h-2 bg-red-500 rounded-full" />
            </TouchableOpacity>
          </View>

          <Text className="text-3xl font-extrabold text-gray-900 mb-1">Good Morning!</Text>
          <Text className="text-gray-500 text-base mb-8">
            {mainDevice ? `Connected to ${mainDevice.name}` : 'Searching for devices...'}
          </Text>

          {/* Weather Widget */}
          <LinearGradient
            colors={['#FDFBF7', '#F4F7FC']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="w-full rounded-[30px] p-6 mb-8 flex-row items-center justify-between shadow-sm border border-white/50"
          >
            <View className="flex-row items-center gap-4">
              <View className="w-16 h-16 bg-orange-100 rounded-full items-center justify-center">
                <Ionicons name={weatherIcon} size={32} color={weatherIcon === 'sunny' ? "#F97316" : "#3B82F6"} />
              </View>
              <View>
                <Text className="text-3xl font-bold text-gray-900">{temp}°C</Text>
                <Text className="text-gray-500 font-medium">{weatherIcon === 'sunny' ? 'Good' : 'Raining'}</Text>
              </View>
            </View>

            <View className="h-full justify-center gap-2 border-l border-gray-100 pl-6">
              <View className="flex-row items-center gap-2">
                <Ionicons name="water-outline" size={16} color="#3B82F6" />
                <Text className="text-gray-700 font-bold">{hum}%</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <MaterialCommunityIcons name="weather-windy" size={16} color="#10B981" />
                <Text className="text-gray-700 font-bold">Good</Text>
              </View>
            </View>
          </LinearGradient>

          {/* Living Room Section */}
          <View className="flex-row justify-between items-end mb-4">
            <Text className="text-xl font-bold text-gray-900">Living Room</Text>
            <Text className="text-blue-500 font-bold text-xs tracking-wider">GPIO 15</Text>
          </View>

          <View className="flex-row flex-wrap justify-between">
            <DeviceCard
              title="Living Light"
              subtitle={relay3 ? "On" : "Off"}
              icon={<Ionicons name="bulb" size={20} color={relay3 ? "#3B82F6" : "#9CA3AF"} />}
              type="switch"
              isActive={relay3}
              onPress={() => handleControl('relay', 3, relay3)}
              isLoading={loadingControl === 'relay3'}
              color="blue"
            />
            <DeviceCard
              title="Climate"
              subtitle={`${temp}°C | ${hum}%`}
              icon={<MaterialCommunityIcons name="thermometer" size={20} color="#6B7280" />}
              type="sensor"
              isActive={true}
              status="active"
              color="gray"
            />
          </View>

          {/* Kitchen Section */}
          <View className="flex-row justify-between items-end mb-4 mt-4">
            <Text className="text-xl font-bold text-gray-900">Kitchen</Text>
            <Text className="text-blue-500 font-bold text-xs tracking-wider">GPIO 26</Text>
          </View>

          <View className="flex-row flex-wrap justify-between">
            <DeviceCard
              title="Kitchen Light"
              subtitle={relay2 ? "On" : "Off"}
              icon={<MaterialCommunityIcons name="ceiling-light" size={20} color={relay2 ? "#F59E0B" : "#9CA3AF"} />}
              type="switch"
              isActive={relay2}
              onPress={() => handleControl('relay', 2, relay2)}
              isLoading={loadingControl === 'relay2'}
              color="orange"
            />
            <DeviceCard
              title="Gas Sensor"
              subtitle={gasAlert ? "CRITICAL" : "Normal"}
              icon={<MaterialCommunityIcons name="gas-cylinder" size={20} color={gasAlert ? "#EF4444" : "#10B981"} />}
              type={gasAlert ? 'alert' : 'sensor'}
              isActive={true}
              color={gasAlert ? "red" : "green"}
            />
          </View>

          {/* Bedroom Section */}
          <View className="flex-row justify-between items-end mb-4 mt-4">
            <Text className="text-xl font-bold text-gray-900">Bedroom</Text>
            <Text className="text-blue-500 font-bold text-xs tracking-wider">GPIO 32</Text>
          </View>

          <View className="flex-row flex-wrap justify-between">
            <DeviceCard
              title="Bedroom Light"
              subtitle={relay1 ? "On" : "Off"}
              icon={<Ionicons name="bed" size={20} color={relay1 ? "#8B5CF6" : "#9CA3AF"} />}
              type="switch"
              isActive={relay1}
              onPress={() => handleControl('relay', 1, relay1)}
              isLoading={loadingControl === 'relay1'}
              color="purple"
            />
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
