// Cliente del módulo TI (Activos, Personal y Equipos, Transferencias, Recepción),
// contra la colección Postman "PDN - Activos TI - produccion".
// Todas las respuestas son { code, message, data } y usan el `token_seguimiento`.
// Los activos y transferencias usan concurrencia optimista (`version`).
import { apiManager } from '../api/ApiManager';
import { API_CONFIG } from '../config/apiConfig';
import { ENDPOINTS } from '../config/endpoints';
import { AuthService } from '../auth/AuthService';

export interface RespuestaApi<T = any> {
    code?: number;
    message?: string;
    data: T;
}

const E = ENDPOINTS.ACTIVOS;

const qs = (params: Record<string, any>) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
    });
    const s = q.toString();
    return s ? `?${s}` : '';
};

const get = (url: string) => apiManager.requestTI('get', url) as Promise<RespuestaApi>;
const send = (m: 'post' | 'put' | 'patch', url: string, body?: any) => apiManager.requestTI(m, url, body) as Promise<RespuestaApi>;

/** Lanza Error con el mensaje del backend si la respuesta no es 2xx. */
export const asegurarOk = <T = any>(resp: RespuestaApi<T>, mensajeDefecto: string): RespuestaApi<T> => {
    const code = resp?.code;
    if (code !== undefined && (code < 200 || code >= 300)) {
        throw new Error(resp?.message || mensajeDefecto);
    }
    return resp;
};

export const tiApi = {
    tipos: () => get(E.TIPOS),

    activos: {
        listar: (f: { estado?: string | number; busqueda?: string; tipo?: number | string; condicion?: string; operativo?: string; personal?: number | string } = {}) =>
            get(`${E.BASE}${qs(f)}`),
        crear: (data: any) => send('post', E.BASE, data),
        actualizar: (id: number, data: any) => send('put', `${E.BASE}/${id}`, data),
        cambiarEstado: (id: number, estado: 0 | 1, version: number) => send('patch', E.ESTADO(id), { estado, version }),
        historial: (id: number, f: { evento?: string; desde?: string; hasta?: string } = {}) => get(`${E.HISTORIAL(id)}${qs(f)}`),
    },

    personal: {
        listar: (f: { busqueda?: string; area?: number | string; equipo?: string } = {}) => get(`${E.PERSONAL}${qs(f)}`),
        equipos: (idPersonal: number | string) => get(E.PERSONAL_EQUIPOS(idPersonal)),
    },

    transferencias: {
        listar: (f: { estado?: string; busqueda?: string; desde?: string; hasta?: string } = {}) => get(`${E.TRANSFERENCIAS}${qs(f)}`),
        detalle: (id: number | string) => get(E.TRANSFERENCIA(id)),
        /** `id_solicitud` (UUID) hace idempotente la creación: conservarlo al reintentar. */
        crear: (body: {
            id_solicitud: string;
            id_personal_origen: number;
            id_personal_destino: number;
            correo_receptor: string;
            motivo: string;
            activos: { id_activo: number; version: number }[];
        }) => send('post', E.TRANSFERENCIAS, body),
        enviarCodigo: (id: number | string) => send('post', E.ENVIAR_CODIGO(id)),
        confirmar: (id: number | string, codigo: string) => send('post', E.CONFIRMAR(id), { codigo }),
        cancelar: (id: number | string, version: number, motivo: string) => send('post', E.CANCELAR(id), { version, motivo }),
    },

    /** Acta imprimible: HTML A4 (no PDF). Se descarga con Authorization y se abre en otra ventana. */
    async abrirActa(idActa: number | string) {
        const token = AuthService.getTokenSeguimiento();
        if (!token) throw new Error('No hay token de seguimiento; vuelve a iniciar sesión.');
        const base = API_CONFIG.BASE_URL.replace(/\/$/, '');
        const resp = await fetch(`${base}/${E.ACTA_IMPRIMIR(idActa)}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!resp.ok) throw new Error('No se pudo obtener el acta.');
        const html = await resp.text();
        const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
        const w = window.open(url, '_blank');
        if (!w) throw new Error('El navegador bloqueó la ventana emergente.');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
    },
};

export const nuevoIdSolicitud = (): string =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
              const r = (Math.random() * 16) | 0;
              return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
          });
