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

    /**
     * Token corto (dura 3600s) que devuelve el MISMO `/auth/login` para el
     * módulo de auditoría "Seguimiento Firma" (`GET /firmas/seguimiento`).
     * Es distinto del token de sesión normal, así que se guarda aparte.
     */
    static getTokenSeguimiento() {
        return localStorage.getItem('tokenSeguimiento');
    }

    static setTokenSeguimiento(token: string) {
        localStorage.setItem('tokenSeguimiento', token);
    }

    static removeTokenSeguimiento() {
        localStorage.removeItem('tokenSeguimiento');
    }
    static setCookieLS(name: string, value: string) {
        localStorage.setItem(name, value);
    }
    static removeCookieLS(name: string) {
        localStorage.removeItem(name);
    }
    static handleAuthError() {
        console.log("handleAuthError");
        if (this.isHandlingAuthError) return;

        // Marcamos que estamos manejando un error
        this.isHandlingAuthError = true;
        this.removeToken();
        alert("Sesion expirada, reinicie sesión")
        //window.location.href = '/login';
        window.location.href = process.env.VITE_BASENAME ? process.env.VITE_BASENAME + "/login2" : '/login3'
        return;
    }
}