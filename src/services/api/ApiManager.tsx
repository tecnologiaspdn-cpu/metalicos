import { API_CONFIG } from '../config/apiConfig';
import { ENDPOINTS } from '../config/endpoints';
import { HttpClient } from '../http/HttpClient';
import { AuthService } from '../auth/AuthService';

type HttpMethod = 'get' | 'post' | 'put' | 'delete';
class ApiManager {
    private httpClient: HttpClient;
    constructor() {
        this.httpClient = new HttpClient(API_CONFIG.BASE_URL, API_CONFIG.HEADERS);
    }
    // Método genérico para hacer peticiones
    request = async (method: HttpMethod, endpoint: string, data: any = null, options: Record<string, any> = {}) => {
        try {
            return await this.httpClient[method](endpoint, data, options);
        } catch (error) {
            console.error(`Error en petición ${method.toUpperCase()} a ${endpoint}:`, error);
            throw error;
        }
    };

    // =============== AUTH ===============
    auth = {
        login: async (credentials: Record<string, any>):
            //Promise<{ token: string; exito: boolean; pagina_inicial: string }> => {
            Promise<{ code: number; message: boolean | string; data: object }> => {
            const response = await this.request('post', ENDPOINTS.AUTH.LOGIN, credentials);
            console.log("response", response);
            if (response.data.ok) {
                //AuthService.setToken(response.token);
                AuthService.setToken(response.data.usuario.usuario_id);
            } // Simula la estructura de la respuesta 
            return {
                //token: response.token,
                code: response.code, // o false según la lógica de tu aplicación 
                message: response.message, // o cualquier otra página inicial 
                data: response.data.usuario
            };
        },
        logout: async () => {
            try {
                await this.request('post', ENDPOINTS.AUTH.LOGOUT);
            } finally {
                AuthService.removeToken();
            }
        },

        refresh: async () => {
            return this.request('post', ENDPOINTS.AUTH.REFRESH);
        },

        getPermisos: async () => {
            return this.request('get', ENDPOINTS.AUTH.PERMISOS);
        }
    };
    // =============== PERSONAL ===============
    personal = {
        getAll: async () => {
            return this.request('post', ENDPOINTS.PERSONAL.LIST);
        },
        getAllByCategoria: async (id_categoria: any) => {
            return this.request('get', ENDPOINTS.PERSONAL.LISTBYCATEGORIA(id_categoria));
        },
        getById: async (id: any) => {
            return this.request('get', ENDPOINTS.PERSONAL.DETAIL(id));
        },
        create: async (personalData: any) => {
            return this.request('post', ENDPOINTS.PERSONAL.CREATE, personalData);
        },
        update: async (personalData: any, id: any) => {
            return this.request('put', ENDPOINTS.PERSONAL.UPDATE(id), personalData);
        },
        update2: async (personalData: any, id: any) => {
            return this.request('post', ENDPOINTS.PERSONAL.UPDATE2, personalData);
        },
        delete: async (id: any) => {
            return this.request('delete', ENDPOINTS.PERSONAL.DELETE(id));
        }
    };

}

export const apiManager = new ApiManager();
