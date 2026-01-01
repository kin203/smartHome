import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../api/client';
import { router } from 'expo-router';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        const loadToken = async () => {
            try {
                const storedToken = await AsyncStorage.getItem('token');
                if (storedToken) {
                    setToken(storedToken);
                }
            } catch (e) {
                console.error("Failed to load token", e);
            } finally {
                setIsLoading(false);
            }
        };
        loadToken();
    }, []);

    const register = async (userData) => {
        setIsLoading(true);
        setIsError(false);
        setMessage('');
        try {
            const response = await client.post('/users', userData);
            if (response.data) {
                await AsyncStorage.setItem('token', response.data.token);
                setToken(response.data.token);
                setUser(response.data);
                // navigate handled in _layout via useEffect on token, or explicitly here
            }
        } catch (error) {
            setIsError(true);
            setMessage(error.response?.data?.message || error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (userData) => {
        setIsLoading(true);
        setIsError(false);
        setMessage('');
        try {
            const response = await client.post('/users/login', userData);
            if (response.data) {
                await AsyncStorage.setItem('token', response.data.token);
                setToken(response.data.token);
                setUser(response.data);
            }
        } catch (error) {
            setIsError(true);
            setMessage(error.response?.data?.message || error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const logout = async () => {
        await AsyncStorage.removeItem('token');
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                isLoading,
                isError,
                message,
                register,
                login,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
