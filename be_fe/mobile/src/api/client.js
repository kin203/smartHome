import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Automatically detected LAN IP for better compatibility with physical devices
const DEV_BACKEND_URL = 'http://192.168.100.27:5000/api';

const client = axios.create({
    baseURL: DEV_BACKEND_URL,
});

client.interceptors.request.use(
    async (config) => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        } catch (error) {
            console.log('Error fetching token', error);
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default client;
