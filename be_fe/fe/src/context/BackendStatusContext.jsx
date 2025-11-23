import { useState, useEffect, createContext, useContext } from 'react';
import axios from '../api/axios';

const BackendStatusContext = createContext();

export const BackendStatusProvider = ({ children }) => {
    const [isOnline, setIsOnline] = useState(true);
    const [lastCheck, setLastCheck] = useState(Date.now());

    useEffect(() => {
        const checkBackendStatus = async () => {
            try {
                // Try to ping a lightweight endpoint
                await axios.get('/devices', { timeout: 3000 });
                setIsOnline(true);
            } catch (error) {
                console.error('Backend offline:', error);
                setIsOnline(false);
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
