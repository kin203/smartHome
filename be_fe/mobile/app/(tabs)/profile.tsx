import React, { useContext } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { AuthContext } from '../../src/context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogOut, User } from 'lucide-react-native';

export default function ProfileScreen() {
    const { user, logout } = useContext(AuthContext);

    const handleLogout = () => {
        Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Logout',
                style: 'destructive',
                onPress: logout
            }
        ]);
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <View className="bg-white p-6 shadow-sm mb-6 items-center">
                <View className="bg-blue-100 p-4 rounded-full mb-4">
                    <User size={48} color="#2563EB" />
                </View>
                <Text className="text-xl font-bold text-gray-800">{user?.name || 'User'}</Text>
                <Text className="text-gray-500">{user?.email || 'email@example.com'}</Text>
            </View>

            <View className="px-6">
                <View className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <TouchableOpacity
                        onPress={handleLogout}
                        className="flex-row items-center p-4 active:bg-gray-50"
                    >
                        <View className="bg-red-100 p-2 rounded-lg mr-4">
                            <LogOut size={20} color="#DC2626" />
                        </View>
                        <Text className="text-red-600 font-medium text-lg">Logout</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}
