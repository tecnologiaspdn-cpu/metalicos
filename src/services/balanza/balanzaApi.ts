// Cliente del módulo Balanza (Comercialización), contra la colección Postman
// "PDN Balanza - Produccion". Respuestas { code, message, data }; usa el
// `token_seguimiento` como Bearer. Los pesajes y estaciones usan concurrencia
// optimista (`version`) y las escrituras llevan `id_solicitud` (UUID) idempotente.
import { apiManager } from '../api/ApiManager';
import { API_CONFIG } from '../config/apiConfig';
import { ENDPOINTS } from '../config/endpoints';
import { AuthService } from '../auth/AuthService';
import { RespuestaApi, asegurarOk as asegurarOkBase, nuevoIdSolicitud } from '../ti/tiApi';

export { nuevoIdSolicitud };

/** Como `asegurarOk` de TI, pero si el backend manda detalle (campos inválidos) lo agrega al mensaje. */
export const asegurarOk = <T = any>(resp: RespuestaApi<T>, mensajeDefecto: string): RespuestaApi<T> => {
    try {
        return asegurarOkBase(resp, mensajeDefecto);
    } catch (e) {
        const d: any = resp?.data;
        const detalle = d && typeof d === 'object' ? JSON.stringify(d).slice(0, 300) : typeof d === 'string' ? d : '';
        throw new Error(detalle && detalle !== '{}' && detalle !== '[]' ? `${(e as Error).message} (${detalle})` : (e as Error).message);
    }
};

export type TipoCatalogo = 'VEHICULO' | 'REMOLQUE' | 'CONDUCTOR' | 'MATERIAL' | 'PROCEDENCIA';

export const empresaActual = (): number | string => {
    try {
        return JSON.parse(localStorage.getItem('usuarioCookie') || '{}')?.empresa_id ?? 1;
    } catch {
        return 1;
    }
};

const qs = (params: Record<string, any>) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
    });
    const s = q.toString();
    return s ? `?${s}` : '';
};

const base = () => ENDPOINTS.BALANZA.BASE(empresaActual());
const get = (url: string) => apiManager.requestTI('get', url) as Promise<RespuestaApi>;
const send = (m: 'post' | 'put', url: string, body?: any) => apiManager.requestTI(m, url, body) as Promise<RespuestaApi>;

export interface CuerpoCaptura {
    id_lectura: string;
    id_estacion: number | string;
    version_estacion: number | string;
    peso_kg: number;
    unidad: 'kg';
    estable: boolean;
    leido_en: string;
    sesion: number;
    origen: 'TRADE';
}

export interface CuerpoEstacion {
    codigo: string;
    nombre: string;
    sede: string;
    activa: boolean;
    prueba: boolean;
    extension_id: string;
    sesion: number;
    capacidad_kg: number;
    version?: number | string;
}

export const balanzaApi = {
    operaciones: () => get(`${base()}/operaciones`),
    /** Transportistas: empresas del maestro de RRHH (`id_transportista`). */
    transportistas: () => apiManager.maestro.listaEmpresas({}) as Promise<RespuestaApi>,

    estaciones: {
        listar: () => get(`${base()}/estaciones`),
        crear: (b: CuerpoEstacion) => send('post', `${base()}/estaciones`, b),
        /** Actualizar invalida la validación anterior: hay que volver a validar. */
        actualizar: (id: number | string, b: CuerpoEstacion) => send('put', `${base()}/estaciones/${id}`, b),
        validar: (id: number | string, id_captura: string, version: number | string) =>
            send('post', `${base()}/estaciones/${id}/validacion`, { id_captura, version }),
    },

    catalogo: {
        listar: (tipo: TipoCatalogo) => get(`${base()}/catalogos/${tipo}`),
        /** Vehículo: { codigo: placa, nombre, activo }. Conductor externo: { codigo: documento, nombre, licencia, activo }. */
        crear: (tipo: TipoCatalogo, b: { codigo: string; nombre: string; licencia?: string; activo: boolean }) =>
            send('post', `${base()}/catalogos/${tipo}`, b),
        /**
         * PUT con todos los campos que deben conservarse y la `version` actual (concurrencia optimista).
         * Conductor interno: enviar `id_personal` y sin `nombre`; `id_personal: null` lo convierte en externo.
         */
        actualizar: (
            tipo: TipoCatalogo,
            id: number | string,
            b: { codigo: string; nombre?: string; id_personal?: number | string | null; licencia?: string | null; activo: boolean; version: number | string },
        ) => send('put', `${base()}/catalogos/${tipo}/${id}`, b),
    },

    /** Registra una lectura de TRADE tal como la capturó el frontend; devuelve `id_captura`. */
    capturar: (b: CuerpoCaptura) => send('post', `${base()}/capturas`, b),

    pesajes: {
        listar: (f: { estado?: string; pagina?: number; tamano?: number } = {}) => get(`${base()}/pesajes${qs(f)}`),
        detalle: (id: number | string) => get(`${base()}/pesajes/${id}`),
        crear: (b: {
            id_solicitud: string;
            id_captura: string;
            operacion: string;
            tipo_primera: string;
            fecha_operativa: string;
            id_vehiculo: number | string;
            id_conductor: number | string;
            id_transportista: number | string;
            observaciones?: string;
        }) => send('post', `${base()}/pesajes`, b),
        segundaPesada: (id: number | string, b: { id_solicitud: string; version: number | string; id_captura: string }) =>
            send('post', `${base()}/pesajes/${id}/segunda-pesada`, b),
        finalizar: (id: number | string, b: { id_solicitud: string; version: number | string }) =>
            send('post', `${base()}/pesajes/${id}/finalizar`, b),
        anular: (id: number | string, b: { id_solicitud: string; version: number | string; motivo: string }) =>
            send('post', `${base()}/pesajes/${id}/anular`, b),
    },

    /** Ticket en PDF: se descarga con Authorization y se abre en otra pestaña. */
    async abrirTicketPdf(idPesaje: number | string) {
        const token = AuthService.getTokenSeguimiento();
        if (!token) throw new Error('No hay token de seguimiento; vuelve a iniciar sesión.');
        const root = API_CONFIG.BASE_URL.replace(/\/$/, '');
        const resp = await fetch(`${root}/${base()}/pesajes/${idPesaje}/ticket/pdf`, { headers: { Authorization: `Bearer ${token}` } });
        if (!resp.ok) throw new Error('No se pudo obtener el ticket.');
        const url = URL.createObjectURL(await resp.blob());
        if (!window.open(url, '_blank')) throw new Error('El navegador bloqueó la ventana emergente.');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
    },
};
