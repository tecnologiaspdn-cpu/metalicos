export const API_CONFIG = {
    BASE_URL: 'https://api.polimetalicos.com.pe/', 
    HEADERS: {
        'Content-Type': 'application/json',
    },
    AUTH: {
        TOKEN_KEY: 'jwt_token',
        REFRESH_TOKEN_KEY: 'refresh_token'
    },
    AUTH_PREFIX: 'Bearer',
    AUTH_HEADER: 'Authorization'

};

/**
 * Base pública (sin autenticación) del validador de firmas, usada para armar
 * el link que se codifica en el QR de la última hoja de cada PDF firmado:
 * `${VALIDADOR_FIRMAS_BASE_URL}/<codigo_documento>`.
 * TODO(CONFIRMAR): ajustar si el dominio real de producción es otro.
 */
export const VALIDADOR_FIRMAS_BASE_URL = 'https://intranet.polimetalicos.com.pe/validador-firmas';
