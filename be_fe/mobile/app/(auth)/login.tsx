import React, { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { AuthContext } from '../../src/context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { login, isError, message, isLoading } = useContext(AuthContext);
    const router = useRouter();

    const handleLogin = () => {
        login({ email, password });
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-900 justify-center px-6">
            <View className="bg-gray-800 p-8 rounded-2xl shadow-lg border border-gray-700">
                <Text className="text-3xl font-bold text-white mb-6 text-center">Welcome Back</Text>

                {isError && (
                    <View className="bg-red-900/50 border border-red-500 p-3 rounded-lg mb-4">
                        <Text className="text-red-200 text-center">{message}</Text>
                    </View>
                )}

                <View className="space-y-4">
                    <View>
                        <Text className="text-gray-300 text-sm font-medium mb-2">Email</Text>
                        <TextInput
                            className="w-full px-4 py-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:border-blue-500"
                            placeholder="Enter your email"
                            placeholderTextColor="#9CA3AF"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                    </View>

                    <View>
                        <Text className="text-gray-300 text-sm font-medium mb-2">Password</Text>
                        <TextInput
                            className="w-full px-4 py-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:border-blue-500"
                            placeholder="Enter your password"
                            placeholderTextColor="#9CA3AF"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />
                    </View>

                    <TouchableOpacity
                        className="w-full bg-blue-600 py-3 rounded-lg mt-4 active:bg-blue-700 items-center"
                        onPress={handleLogin}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text className="text-white font-bold text-lg">Sign In</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <View className="mt-6 flex-row justify-center">
                    <Text className="text-gray-400">Don't have an account? </Text>
                    <Link href="/(auth)/register" asChild>
                        <TouchableOpacity>
                            <Text className="text-blue-400 font-medium">Sign up</Text>
                        </TouchableOpacity>
                    </Link>
                </View>
            </View>
        </SafeAreaView>
    );
}
