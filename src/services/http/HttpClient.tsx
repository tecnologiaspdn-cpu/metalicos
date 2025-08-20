import { AuthService } from '../auth/AuthService';

interface RequestOptions extends RequestInit {
    headers?: Record<string, string>; // Opcional: Define un objeto con claves y valores de string para las cabeceras.
}

export class HttpClient {
    private baseURL: string;
    private headers: Record<string, string>;

    constructor(baseURL: string, headers: Record<string, string> = {}) {
        this.baseURL = baseURL;
        this.headers = headers;
    }

    private getAuthHeaders(): Record<string, string> {
        const token = AuthService.getToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
    }

    private async request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
        const url = `${this.baseURL}${endpoint}`;
        const headers = {
            ...this.headers,
            ...this.getAuthHeaders(),
            ...options.headers,
        };

        try {
            const response = await fetch(url, { ...options, headers });
            //console.log("1era", response)
            // Manejo de errores de autenticación
            if (response.status === 401) {//coger un error para decir sesion expirada
                //AuthService.handleAuthError();
                //throw new Error('Eror de autenticación');
            }

            if (!response.ok) {
                //throw new Error(`HTTP Error: ${response.status}`);
            }

            // Devuelve la respuesta parseada como JSON
            return (await response.json()) as T;
        } catch (error) {
            console.error('API Request Error:', error);
            throw error;
        }
    }

    public async get<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
        return this.request<T>(endpoint, { ...options, method: 'GET' });
    }

    public async post<T = any>(endpoint: string, data: any, options: RequestOptions = {}): Promise<T> {
        return this.request<T>(endpoint, {
            ...options,
            method: 'POST',
            body: JSON.stringify(data),
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });
    }

    public async put<T = any>(endpoint: string, data: any, options: RequestOptions = {}): Promise<T> {
        return this.request<T>(endpoint, {
            ...options,
            method: 'PUT',
            body: JSON.stringify(data),
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });
    }

    public async delete<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
        return this.request<T>(endpoint, { ...options, method: 'DELETE' });
    }
}
