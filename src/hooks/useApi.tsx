import React, { useState, useEffect, useCallback } from 'react';
import { AuthService } from '../services/auth/AuthService';

type ApiMethod<T> = (params?: any) => Promise<T>;

interface UseApiResult<T> {
    data: T | null;
    loading: boolean;
    error: Error | null;
    refresh: () => void;
}

export function useApi<T>(apiMethod: ApiMethod<T>, params: any = null): UseApiResult<T> {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const result = params ? await apiMethod(params) : await apiMethod();
            setData(result);
        } catch (err: any) {
            console.log("error", err);
            setError(err);

            if (err?.message === 'Sesión expirada') {
                AuthService.handleAuthError();
            }
        } finally {
            setLoading(false);
        }
    }, [apiMethod, params]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const refresh = useCallback(() => {
        fetchData();
    }, [fetchData]);

    return { data, loading, error, refresh };
}
