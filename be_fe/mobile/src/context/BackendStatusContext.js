import React, { useState, useEffect, createContext, useContext } from 'react';
import client from '../api/client';

const BackendStatusContext = createContext();

export const BackendStatusProvider = ({ children }) => {
    const [isOnline, setIsOnline] = useState(true);
    const [lastCheck, setLastCheck] = useState(Date.now());

    useEffect(() => {
        const checkBackendStatus = async () => {
            try {
                // Try to ping a lightweight endpoint
                await client.get('/devices', { timeout: 3000 });
                setIsOnline(true);
            } catch (error) {
                // Check if we got a response (even if it's an error status like 401, 500)
                // "Request failed with status code 401" means we DID reach the server.
                if (error.response || (error.message && error.message.includes('status code'))) {
                    setIsOnline(true);
                } else {
                    console.log('Backend offline:', error.message);
                    setIsOnline(false);
                }
            }
            setLastCheck(Date.now());
        };

        // Initial check
        checkBackendStatus();

        // Check every 5 seconds
        const interval = setInterval(checkBackendStatus, 5000);

        return () => clearInterval(interval);
    }, []);

    return (
        <BackendStatusContext.Provider value={{ isOnline, lastCheck }}>
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
