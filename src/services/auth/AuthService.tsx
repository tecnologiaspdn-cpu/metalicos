import { API_CONFIG } from "../config/apiConfig";

export class AuthService {
    private static isHandlingAuthError = false;
    static getToken() {
        return localStorage.getItem(API_CONFIG.AUTH.TOKEN_KEY);
    }

    static setToken(token: string) {
        localStorage.setItem(API_CONFIG.AUTH.TOKEN_KEY, token);
    }
    
    static removeToken() {
        localStorage.removeItem(API_CONFIG.AUTH.TOKEN_KEY);
    }

    static isAuthenticated() {
        return !!this.getToken();
    }

    static handleAuthError() {
        if (this.isHandlingAuthError) return;

        // Marcamos que estamos manejando un error
        this.isHandlingAuthError = true;
        this.removeToken();
        alert("Sesion expirada, reinicie sesión")
        //window.location.href = '/login';
        window.location.href = process.env.VITE_BASENAME ? process.env.VITE_BASENAME + "/login" : '/login'
        return;
    }
}