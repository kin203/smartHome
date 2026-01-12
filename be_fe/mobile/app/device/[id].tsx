import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Linking, Platform, KeyboardAvoidingView } from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Thermometer, Droplets, CloudRain, RotateCw, Lock, AlertTriangle, ArrowLeft, Settings, Power, Bell, Monitor, Key, List, Sliders, ChevronRight } from 'lucide-react-native';
import client from '../../src/api/client';
import RFIDCardManager from '../../src/components/RFIDCardManager';
import AccessLogPanel from '../../src/components/AccessLogPanel';

// --- COMPONENTS ---

const Header = ({ title, onBack, isOnline, hasDoorAlert }) => (
    <LinearGradient
        colors={hasDoorAlert ? ['#EF4444', '#DC2626'] : ['#3B82F6', '#2563EB']}
        className="pt-12 pb-6 px-6 rounded-b-[30px] shadow-lg"
    >
        <View className="flex-row items-center justify-between">
            <TouchableOpacity onPress={onBack} className="bg-white/20 p-2 rounded-full backdrop-blur-md">
                <ArrowLeft size={24} color="white" />
            </TouchableOpacity>
            <View className="items-center">
                <Text className="text-white text-lg font-bold shadow-sm">{title}</Text>
                <View className="flex-row items-center gap-1 mt-1">
                    <View className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'}`} />
                    <Text className="text-white/80 text-xs font-medium">{isOnline ? 'Online' : 'Offline'}</Text>
                </View>
            </View>
            <View className="w-10" />
        </View>
    </LinearGradient>
);

const TabSelector = ({ activeTab, onSelect }) => {
    const tabs = [
        { id: 'control', label: 'Control', icon: Power },
        { id: 'relay', label: 'Start Light', icon: Sliders },
        { id: 'cards', label: 'Cards', icon: Key },
        { id: 'logs', label: 'Logs', icon: List },
        { id: 'setup', label: 'Setup', icon: Settings },
    ];

    return (
        <View className="bg-white mx-4 -mt-8 rounded-2xl shadow-lg border border-gray-100 p-2 flex-row justify-between relative z-10">
            {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                    <TouchableOpacity
                        key={tab.id}
                        onPress={() => onSelect(tab.id)}
                        className={`items-center justify-center p-3 rounded-xl flex-1 ${isActive ? 'bg-blue-50' : 'bg-transparent'}`}
                    >
                        <tab.icon size={20} color={isActive ? '#2563EB' : '#9CA3AF'} />
                        {isActive && <View className="w-1 h-1 bg-blue-600 rounded-full mt-1" />}
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

const SensorCard = ({ icon: Icon, label, value, color, iconColor, alert }) => (
    <View className={`bg-white/80 p-4 rounded-2xl border ${alert ? 'border-red-200 bg-red-50' : 'border-white'} shadow-sm flex-1 min-w-[45%]`}>
        <View className="flex-row items-center gap-2 mb-2">
            <View className={`p-2 rounded-full ${alert ? 'bg-red-100' : 'bg-gray-100'}`}>
                <Icon size={18} color={alert ? '#DC2626' : iconColor} />
            </View>
            <Text className="text-gray-500 text-xs font-bold uppercase">{label}</Text>
        </View>
        <Text className={`text-2xl font-bold ${color}`}>{value}</Text>
    </View>
);

// --- TAB CONTENT COMPONENTS (Separated for stability) ---

const ControlTab = ({ status, loading, sendCommand }) => {
    if (!status) return null;
    return (
        <View className="space-y-6 pt-4 pb-20">
            {/* Monitor Section */}
            <View className="flex-row flex-wrap gap-4 px-4">
                <SensorCard
                    icon={Thermometer}
                    label="Temp"
                    value={`${status?.temperature || '--'}°C`}
                    color={status?.temperature > 30 ? 'text-red-500' : 'text-gray-800'}
                    iconColor="#DC2626"
                    alert={false}
                />
                <SensorCard
                    icon={Droplets}
                    label="Humidity"
                    value={`${status?.humidity || '--'}%`}
                    color="text-blue-600"
                    iconColor="#2563EB"
                    alert={false}
                />
                <SensorCard
                    icon={AlertTriangle}
                    label="Gas"
                    value={status?.gas || '0'}
                    color={status?.gas > 800 ? 'text-red-600' : 'text-green-600'}
                    iconColor="#16A34A"
                    alert={status?.gas > 800}
                />
                <SensorCard
                    icon={CloudRain}
                    label="Rain"
                    value={status?.rain === 'detected' ? 'Yes' : 'No'}
                    color={status?.rain === 'detected' ? 'text-blue-600' : 'text-gray-800'}
                    iconColor="#2563EB"
                    alert={status?.rain === 'detected'}
                />
            </View>

            {/* Door Control */}
            <View className="mx-4 bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                <View className="flex-row justify-between items-center mb-6">
                    <View>
                        <Text className="text-lg font-bold text-gray-800">Main Door</Text>
                        <Text className="text-gray-400 text-xs">Secure Entry Control</Text>
                    </View>
                    <View className={`px-4 py-2 rounded-full ${status.door === 'open' ? 'bg-green-100' : 'bg-gray-100'}`}>
                        <Text className={`font-bold ${status.door === 'open' ? 'text-green-600' : 'text-gray-500'}`}>
                            {status.door === 'open' ? 'OPEN' : 'CLOSED'}
                        </Text>
                    </View>
                </View>
                <View className="flex-row gap-4">
                    <TouchableOpacity
                        onPress={() => sendCommand('door', 'open')}
                        disabled={loading || status?.door?.includes('open')}
                        className={`flex-1 py-4 rounded-2xl items-center shadow-md active:scale-95 transition-all ${status?.door?.includes('open') ? 'bg-gray-100' : 'bg-green-500'
                            }`}
                    >
                        <Text className={`font-bold text-lg ${status?.door?.includes('open') ? 'text-gray-400' : 'text-white'}`}>Open</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => sendCommand('door', 'close')}
                        disabled={loading || status?.door === 'closed'}
                        className={`flex-1 py-4 rounded-2xl items-center shadow-md active:scale-95 transition-all ${status?.door === 'closed' ? 'bg-gray-100' : 'bg-red-500'
                            }`}
                    >
                        <Text className={`font-bold text-lg ${status?.door === 'closed' ? 'text-gray-400' : 'text-white'}`}>Close</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Quick Actions (Buzzer & Screen) */}
            <View className="mx-4 flex-row gap-4">
                <View className="flex-1 bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                    <View className="flex-row items-center gap-2 mb-4">
                        <Bell size={20} color="#F59E0B" />
                        <Text className="font-bold text-gray-800">Alarm</Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => sendCommand('buzzer', 'beep')}
                        className="bg-orange-50 p-3 rounded-xl mb-2 items-center active:bg-orange-100"
                    >
                        <Text className="text-orange-600 font-bold text-xs">Beep</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => sendCommand('buzzer', 'alert')}
                        className="bg-red-50 p-3 rounded-xl items-center active:bg-red-100"
                    >
                        <Text className="text-red-600 font-bold text-xs">Alert</Text>
                    </TouchableOpacity>
                </View>

                <View className="flex-1 bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                    <View className="flex-row items-center gap-2 mb-4">
                        <Monitor size={20} color="#3B82F6" />
                        <Text className="font-bold text-gray-800">OLED</Text>
                    </View>
                    <View className="flex-row gap-2 justify-center">
                        {[
                            { l: 'Auto', v: 0 }, { l: 'Info', v: 1 }, { l: 'Stat', v: 2 }
                        ].map(m => (
                            <TouchableOpacity
                                key={m.v}
                                onPress={() => sendCommand('screen', '', m.v)}
                                className={`w-8 h-8 rounded-full items-center justify-center ${status.screenMode === m.v ? 'bg-blue-600' : 'bg-gray-100'}`}
                            >
                                <Text className={`text-[10px] font-bold ${status.screenMode === m.v ? 'text-white' : 'text-gray-500'}`}>
                                    {m.l.charAt(0)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <Text className="text-center text-xs text-gray-400 mt-2">
                        {status.screenMode === 0 ? 'Auto Cycle' : status.screenMode === 1 ? 'Info' : 'Status'}
                    </Text>
                </View>
            </View>
        </View>
    );
};

const RelayTab = ({ status, loading, toggleRelay, sendCommand }) => {
    if (!status) return null;
    return (
        <View className="space-y-4 pt-4 px-4 pb-20">
            <Text className="text-xl font-bold text-gray-900 ml-1">Smart Lighting</Text>

            {[
                { id: 1, name: 'Bedroom (LED 1)', gpio: '32', color: 'bg-yellow-500', text: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
                { id: 2, name: 'Kitchen (LED 2)', gpio: '26', color: 'bg-blue-500', text: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
                { id: 3, name: 'Living Room (LED 3)', gpio: '15', color: 'bg-green-500', text: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
            ].map((led) => {
                const isOn = status[`relay${led.id}`];
                return (
                    <TouchableOpacity
                        key={led.id}
                        onPress={() => toggleRelay(led.id)}
                        disabled={loading}
                        className={`p-5 rounded-3xl shadow-sm border active:scale-[0.98] transition-all flex-row items-center justify-between ${isOn ? `${led.bg} ${led.border}` : 'bg-white border-gray-100'
                            }`}
                    >
                        <View className="flex-row items-center gap-4">
                            <View className={`w-12 h-12 rounded-2xl items-center justify-center ${isOn ? 'bg-white' : 'bg-gray-100'}`}>
                                <View className={`w-3 h-3 rounded-full ${isOn ? led.color : 'bg-gray-400'}`} />
                            </View>
                            <View>
                                <Text className={`text-lg font-bold ${isOn ? led.text : 'text-gray-600'}`}>{led.name}</Text>
                                <Text className="text-xs text-gray-400">GPIO {led.gpio}</Text>
                            </View>
                        </View>
                        <View className={`w-14 h-8 rounded-full p-1 transition-colors ${isOn ? led.color : 'bg-gray-200'}`}>
                            <View className={`bg-white w-6 h-6 rounded-full shadow-sm transform transition-transform ${isOn ? 'translate-x-6' : 'translate-x-0'}`} />
                        </View>
                    </TouchableOpacity>
                );
            })}

            <View className="bg-purple-50 p-6 rounded-3xl border border-purple-100 mt-2">
                <View className="flex-row justify-between items-start mb-4">
                    <View>
                        <Text className="text-lg font-bold text-gray-900">Outdoor Auto Light</Text>
                        <Text className="text-purple-600 text-xs font-bold uppercase tracking-wider mt-1">GPIO 2 • Sensor</Text>
                    </View>
                    <View className="bg-white p-2 rounded-xl">
                        <RotateCw size={20} color="#9333EA" />
                    </View>
                </View>

                <View className="bg-white/60 p-4 rounded-2xl flex-row justify-between items-center">
                    <View>
                        <Text className="font-bold text-gray-800">Auto Mode</Text>
                        <Text className="text-xs text-gray-500">Light depends on sensor</Text>
                    </View>
                    <TouchableOpacity
                        onPress={async () => {
                            const newMode = !status?.autoMode;
                            await sendCommand('auto_light', 'set_mode', newMode ? 'auto' : 'manual');
                        }}
                        className={`w-12 h-7 rounded-full p-1 transition-colors ${status?.autoMode ? 'bg-purple-600' : 'bg-gray-300'}`}
                    >
                        <View className={`bg-white w-5 h-5 rounded-full shadow-sm transform ${status?.autoMode ? 'translate-x-5' : 'translate-x-0'}`} />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const SetupTab = ({ device, status, loading, locked, unlockPass, setUnlockPass, handleUnlock, newName, setNewName, newPass, setNewPass, handleUpdateSettings }) => {
    if (!device) return null;

    if (locked) {
        return (
            <View className="px-4 pt-10">
                <View className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100 items-center">
                    <View className="bg-red-50 p-6 rounded-full mb-6">
                        <Lock size={48} color="#DC2626" />
                    </View>
                    <Text className="text-2xl font-bold text-gray-900 mb-2">Admin Locked</Text>
                    <Text className="text-gray-500 text-center mb-8 px-4">This section enables sensitive device configuration. Please authenticate.</Text>

                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="w-full">
                        <TextInput
                            className="w-full bg-gray-50 px-5 py-4 rounded-2xl text-gray-900 mb-4 border border-gray-200"
                            placeholder="Enter Admin Password"
                            secureTextEntry
                            value={unlockPass}
                            onChangeText={setUnlockPass}
                            autoCapitalize="none"
                        />
                        <TouchableOpacity
                            onPress={handleUnlock}
                            className="w-full bg-blue-600 py-4 rounded-2xl active:scale-[0.98] shadow-md shadow-blue-200"
                        >
                            <Text className="text-white font-bold text-center text-lg">Unlocks Settings</Text>
                        </TouchableOpacity>
                    </KeyboardAvoidingView>
                </View>
            </View>
        );
    }

    return (
        <View className="px-4 pt-4 space-y-6 pb-20">
            <View className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <View className="flex-row items-center gap-3 mb-6">
                    <View className="bg-blue-50 p-3 rounded-xl">
                        <Settings size={24} color="#2563EB" />
                    </View>
                    <Text className="text-xl font-bold text-gray-900">General Settings</Text>
                </View>

                <View className="space-y-4">
                    <View>
                        <Text className="text-sm font-bold text-gray-500 mb-2 ml-1">Device Name</Text>
                        <TextInput
                            className="bg-gray-50 px-4 py-3 rounded-2xl text-gray-900 border border-gray-200"
                            value={newName}
                            onChangeText={setNewName}
                            placeholder="e.g. Living Room Hub"
                        />
                    </View>
                    <View>
                        <Text className="text-sm font-bold text-gray-500 mb-2 ml-1">Change Admin Password</Text>
                        <TextInput
                            className="bg-gray-50 px-4 py-3 rounded-2xl text-gray-900 border border-gray-200"
                            value={newPass}
                            onChangeText={setNewPass}
                            placeholder="Leave empty to keep current"
                            secureTextEntry
                        />
                    </View>
                </View>
            </View>

            <View className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <View className="flex-row items-center justify-between mb-4">
                    <View className="flex-row items-center gap-3">
                        <View className="bg-indigo-50 p-3 rounded-xl">
                            <RotateCw size={24} color="#4F46E5" />
                        </View>
                        <View>
                            <Text className="text-lg font-bold text-gray-900">Firmware</Text>
                            <Text className="text-gray-400 text-xs">Current: v{device.firmwareVersion || '1.0.0'}</Text>
                        </View>
                    </View>
                </View>

                <TouchableOpacity
                    onPress={() => {
                        if (status?.updateUrl) Linking.openURL(status.updateUrl);
                        else Alert.alert('Up to date', 'No new firmware available.');
                    }}
                    className="bg-indigo-50 py-3 rounded-xl flex-row items-center justify-center gap-2 active:bg-indigo-100 border border-indigo-100"
                >
                    <Text className="text-indigo-700 font-bold">Check for Updates</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity
                onPress={handleUpdateSettings}
                disabled={loading}
                className="bg-gray-900 py-4 rounded-2xl shadow-lg active:scale-[0.98] mt-4"
            >
                {loading ? (
                    <ActivityIndicator color="white" />
                ) : (
                    <Text className="text-white font-bold text-center text-lg">Save Configuration</Text>
                )}
            </TouchableOpacity>
        </View>
    );
};

export default function DeviceDetailScreen() {
    const { id } = useLocalSearchParams();
    const navigation = useNavigation();
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('control');
    const [device, setDevice] = useState(null);
    const [deviceOffline, setDeviceOffline] = useState(false);

    // Setup Tab State
    const [locked, setLocked] = useState(false);
    const [newPass, setNewPass] = useState('');
    const [unlockPass, setUnlockPass] = useState('');
    const [newName, setNewName] = useState('');

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
            const listRes = await client.get('/devices');
            const found = listRes.data.find((d) => d._id === id);
            if (found) {
                setDevice(found);
                setNewName(found.name);
                if (found.settingsPassword) {
                    setLocked(true);
                }
                // Custom header is used, so we hide the native one
                navigation.setOptions({ headerShown: false });
            }
        } catch (e) {
            console.error(e);
        }
    }, [id, navigation]);

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
        await sendCommand('relay', currentState ? 'off' : 'on', undefined, channel);
    };

    const handleUpdateSettings = async () => {
        setLoading(true);
        try {
            await client.put(`/devices/${id}`, {
                name: newName,
                settingsPassword: newPass
            });
            Alert.alert('Success', 'Settings saved successfully');
            fetchDevice();
        } catch (error) {
            Alert.alert('Error', 'Failed to save settings');
        } finally {
            setLoading(false);
        }
    };

    const handleUnlock = () => {
        if (unlockPass === device?.settingsPassword) {
            setLocked(false);
        } else {
            Alert.alert('Error', 'Incorrect Password');
        }
    };

    const isLoadingInitial = !status && !deviceOffline;

    return (
        <View className="flex-1 bg-gray-50">
            {/* Custom Header replaces Navigation Bar */}
            <Header
                title={device?.name || 'Loading...'}
                onBack={() => navigation.goBack()}
                isOnline={!deviceOffline}
                hasDoorAlert={status?.door === 'open'}
            />

            {isLoadingInitial ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#3B82F6" />
                    <Text className="text-gray-400 mt-4 font-medium">Connecting to device...</Text>
                </View>
            ) : deviceOffline ? (
                <View className="flex-1 justify-center items-center p-8">
                    <View className="bg-red-50 p-6 rounded-full mb-4">
                        <AlertTriangle size={64} color="#DC2626" />
                    </View>
                    <Text className="text-2xl font-bold text-gray-800">Device Offline</Text>
                    <Text className="text-gray-500 text-center mt-2 mb-8">Cannot connect to ESP32 Hub. Please check power and Wi-Fi connection.</Text>
                    <TouchableOpacity onPress={fetchStatus} className="bg-blue-600 px-8 py-4 rounded-2xl shadow-lg active:scale-95">
                        <Text className="text-white font-bold">Try Reconnecting</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <>
                    <TabSelector activeTab={activeTab} onSelect={setActiveTab} />

                    <ScrollView className="flex-1 mt-4" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                        {activeTab === 'control' && <ControlTab status={status} loading={loading} sendCommand={sendCommand} />}

                        {activeTab === 'relay' && <RelayTab status={status} loading={loading} toggleRelay={toggleRelay} sendCommand={sendCommand} />}

                        {activeTab === 'cards' && (
                            <View className="px-4 pt-4 pb-20">
                                <RFIDCardManager deviceId={id} />
                            </View>
                        )}

                        {activeTab === 'logs' && (
                            <View className="px-4 pt-4 pb-20">
                                <AccessLogPanel deviceId={id} />
                            </View>
                        )}

                        {activeTab === 'setup' && (
                            <SetupTab
                                device={device}
                                status={status}
                                loading={loading}
                                locked={locked}
                                unlockPass={unlockPass}
                                setUnlockPass={setUnlockPass}
                                handleUnlock={handleUnlock}
                                newName={newName}
                                setNewName={setNewName}
                                newPass={newPass}
                                setNewPass={setNewPass}
                                handleUpdateSettings={handleUpdateSettings}
                            />
                        )}
                    </ScrollView>
                </>
            )}
        </View>
    );
}
