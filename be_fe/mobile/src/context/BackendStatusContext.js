import React, { useState, useEffect, createContext, useContext } from 'react';
import axios from 'axios';
import client from '../api/client';

const BackendStatusContext = createContext();

export const BackendStatusProvider = ({ children }) => {
    const [isOnline, setIsOnline] = useState(true);
    const [lastCheck, setLastCheck] = useState(Date.now());

    useEffect(() => {
        // Create a separate axios instance for status check (without /api suffix)
        const baseUrl = client.defaults.baseURL.replace('/api', '');
        const statusClient = axios.create({
            baseURL: baseUrl,
            timeout: 3000
        });

        const checkBackendStatus = async () => {
            try {
                // Hit root endpoint which doesn't require auth
                await statusClient.get('/');
                setIsOnline(true);
            } catch (error) {
                // If we got ANY response (even 404, 401, 500), backend is online
                if (error.response) {
                    setIsOnline(true);
                } else {
                    // Network error (ECONNREFUSED, timeout) = backend offline
                    console.log('Backend offline:', error.message);
                    setIsOnline(false);
                }
            }
            setLastCheck(Date.now());
        };

        // Initial check
        checkBackendStatus();

        // Check every 15 seconds
        const interval = setInterval(checkBackendStatus, 15000);

        return () => clearInterval(interval);
    }, []);

    return (
        <BackendStatusContext.Provider value={{ isBackendOnline: isOnline, lastCheck }}>
            {children}
        </BackendStatusContext.Provider>
    );
};

export const useBackendStatus = () => {
    const context = useContext(BackendStatusContext);
    if (!context) {
        throw new Error('useBackendStatus must be used within BackendStatusProvider');
    }
    return context;
};
