import { AuthService } from '../auth/AuthService';

interface RequestOptions extends RequestInit {
    headers?: Record<string, string>; // Opcional: Define un objeto con claves y valores de string para las cabeceras.
}

export type BlobWithName = { blob: Blob; filename?: string | null };
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
    public async postFormData<T = any>(endpoint: string, formData: FormData): Promise<T> {
        const url = `${this.baseURL}${endpoint}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                body: formData, // 👈 El navegador arma el multipart con boundary
            });

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }

            return (await response.json()) as T;
        } catch (error) {
            console.error("Error en postFormData:", error);
            throw error;
        }
    }

    // En HttpClient

    public async postBlob<T = any>(endpoint: string, data: any, options: RequestOptions = {}): Promise<BlobWithName> {
        const url = `${this.baseURL}${endpoint}`;
        const headers = {
            ...this.headers,
            ...this.getAuthHeaders(),         // usa auth si tu API lo requiere
            'Content-Type': 'application/json',
            ...options.headers,
        };

        const response = await fetch(url, {
            ...options,
            method: 'POST',
            headers,
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            // si tu API devuelve JSON con error, puedes intentar leerlo aquí
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const blob = await response.blob();
        const dispo = response.headers.get('Content-Disposition');
        let filename: string | null = null;
        if (dispo) {
            const m = dispo.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)["']?/i);
            filename = m ? decodeURIComponent(m[1]) : null;
        }
        return { blob, filename };
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

    public async patch<T = any>(endpoint: string, data: any, options: RequestOptions = {}): Promise<T> {
        return this.request<T>(endpoint, {
            ...options,
            method: 'PATCH',
            body: JSON.stringify(data),
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });
    }

    public async delete<T = any>(endpoint: string, data: any, options: RequestOptions = {}): Promise<T> {
        return this.request<T>(endpoint, {
            ...options,
            method: 'DELETE',
            body: JSON.stringify(data),
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            }
        });
    }
}
