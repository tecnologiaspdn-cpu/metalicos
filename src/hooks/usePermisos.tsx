import { useState, useEffect, useCallback } from 'react';
import { AuthService } from '../services/auth/AuthService';
import { apiManager } from '../services/api/ApiManager';
import { useApi } from '../hooks/useApi';

export const usePermisos = () => {
    const [permisos, setPermisos] = useState<string[]>([]);

    const obtenerPermisos = useCallback(async () => {
        try {
            //const response = await AuthService.getPermisos();
            const response = await apiManager.auth.getPermisos();
            setPermisos(response); // Asegúrate de que 'response' sea un array de strings
        } catch (error) {
            console.error('Error al obtener los permisos:', error);
        }
    }, []);

    useEffect(() => {
        obtenerPermisos();
    }, [obtenerPermisos]);

    const tienePermiso = (permiso: string): boolean => {
        return permisos.includes(permiso);
    };

    return { permisos, tienePermiso }; // Retornamos ambos para mayor utilidad
};
