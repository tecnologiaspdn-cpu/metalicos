import { useState, useEffect } from 'react';
import { AuthService } from '../services/auth/AuthService';
//import { AuthService } from '../auth/AuthService';

export const useAuth = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(AuthService.isAuthenticated());

    useEffect(() => {
        const checkAuth = () => {
            setIsAuthenticated(AuthService.isAuthenticated());
        };

        window.addEventListener('storage', checkAuth);
        return () => window.removeEventListener('storage', checkAuth);
    }, []);

    return { isAuthenticated };
};