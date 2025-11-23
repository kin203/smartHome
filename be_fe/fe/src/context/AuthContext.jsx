import { createContext, useState, useEffect } from 'react';
import axios from '../api/axios';

export const AuthContext = createContext();


export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token') || null);
    const [isLoading, setIsLoading] = useState(false);
    const [isError, setIsError] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (token) {
            // Optional: Validate token or fetch user profile on load
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            // You might want to fetch the user here:
            // axios.get('/users/me').then(res => setUser(res.data)).catch(...)
        } else {
            delete axios.defaults.headers.common['Authorization'];
        }
    }, [token]);

    const register = async (userData) => {
        setIsLoading(true);
        setIsError(false);
        setMessage('');
        try {
            const response = await axios.post('/users', userData);
            if (response.data) {
                localStorage.setItem('token', response.data.token);
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

    const login = async (userData) => {
        setIsLoading(true);
        setIsError(false);
        setMessage('');
        try {
            const response = await axios.post('/users/login', userData);
            if (response.data) {
                localStorage.setItem('token', response.data.token);
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

    const logout = () => {
        localStorage.removeItem('token');
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

// export default AuthContext;

