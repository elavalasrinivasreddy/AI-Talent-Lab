// context/AuthContext.jsx – Authentication state management
import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const AuthContext = createContext(null);
const TOKEN_KEY = 'aitl_token';
const USER_KEY = 'aitl_user';

export function AuthProvider({ children }) {
    const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
    const [user, setUser] = useState(() => {
        const stored = localStorage.getItem(USER_KEY);
        return stored ? JSON.parse(stored) : null;
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

    const isAuthenticated = !!token && !!user;

    const _request = useCallback(async (url, body) => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`${BASE_URL}${url}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.detail || 'Request failed');
            }
            return data;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [BASE_URL]);

    const login = useCallback(async (email, password) => {
        const data = await _request('/api/auth/login', { email, password });
        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return data;
    }, [_request]);

    const register = useCallback(async (formData) => {
        const data = await _request('/api/auth/register', formData);
        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return data;
    }, [_request]);

    const logout = useCallback(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setToken(null);
        setUser(null);
    }, []);

    const clearError = useCallback(() => setError(null), []);

    return (
        <AuthContext.Provider value={{
            token, user, isAuthenticated, isLoading, error,
            login, register, logout, clearError,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
