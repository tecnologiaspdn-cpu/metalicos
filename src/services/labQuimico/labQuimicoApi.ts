// Cliente del módulo Laboratorio Químico (Solicitudes de análisis y Recepción de muestras),
// contra la colección Postman "PDN Laboratorio Quimico - produccion".
// Todas las rutas /labquimico/* usan el `token_seguimiento` como Bearer y responden { code, message, data };
// las solicitudes usan concurrencia optimista (`version`) y las operaciones de escritura una `clave` (UUID)
// para ser idempotentes: reutilizarla al reintentar la MISMA operación.
import { apiManager } from '../api/ApiManager';
import { API_CONFIG } from '../config/apiConfig';
import { ENDPOINTS } from '../config/endpoints';
import { AuthService } from '../auth/AuthService';

export interface RespuestaApi<T = any> {
    code?: number;
    message?: string;
    data: T;
}

const E = ENDPOINTS.LABQUIMICO;

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

/** GET que devuelve un PDF binario (no JSON). */
const getPdf = async (url: string): Promise<Blob> => {
    const token = AuthService.getTokenSeguimiento();
    if (!token) throw new Error('No hay token de seguimiento; vuelve a iniciar sesión.');
    const resp = await fetch(`${API_CONFIG.BASE_URL}${url}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) throw new Error(`No se pudo obtener el PDF (HTTP ${resp.status}).`);
    const blob = await resp.blob();
    if (!blob || blob.size === 0) throw new Error('El PDF está vacío.');
    return blob;
};

/** Lanza Error con el mensaje del backend si la respuesta no es 2xx. */
export const asegurarOk = <T = any>(resp: RespuestaApi<T>, mensajeDefecto: string): RespuestaApi<T> => {
    const code = resp?.code;
    if (code !== undefined && (code < 200 || code >= 300)) {
        throw new Error(resp?.message || mensajeDefecto);
    }
    return resp;
};

export interface FiltrosSolicitudes {
    pagina?: number;
    tamano?: number;
    solo_mias?: boolean;
    /** Confirmado en Postman: PENDIENTE (bandeja de recepción). */
    recepcion?: string;
    /** Confirmado en Postman: FIRMADA. */
    estado?: string;
    // TODO(CONFIRMAR CON BACKEND): la colección solo muestra paginación, solo_mias, recepcion y estado;
    // los nombres de los filtros de búsqueda/empresa/fechas son una suposición.
    busqueda?: string;
    id_empresa?: number | string;
    fecha_inicio?: string;
    fecha_fin?: string;
}

export interface CuerpoSolicitud {
    clave: string;
    id_empresa: number;
    fecha: string;
    guardia: string;
    id_tipo_muestra: number;
    indicaciones: string;
    sacos: number;
    firma_secuencial: boolean;
    /** false = envío directo al laboratorio, sin Firma Electrónica. */
    requiere_firma: boolean;
    muestras: { codigo: string; cantidad: number; analisis_ids: number[]; observaciones: string | null }[];
    responsables: { id_personal: number; rol: string }[];
    // TODO(CONFIRMAR CON BACKEND): campo para el detalle de "Otros" (Especificar…).
    detalle_tipo_muestra?: string | null;
}

export interface CuerpoRecepcion {
    clave: string;
    version: number;
    sacos: number;
    resultado: string;
    observaciones: string | null;
    muestras: { id_muestra: number; cantidad: number; condicion: string; observacion: string | null }[];
}

export const labQuimicoApi = {
    tiposMuestra: () => get(E.TIPOS_MUESTRA),
    tiposAnalisis: () => get(E.TIPOS_ANALISIS),

    listar: (filtros: FiltrosSolicitudes) => get(`${E.SOLICITUDES}${qs(filtros)}`),
    obtener: (id: number) => get(E.SOLICITUD(id)),
    crear: (body: CuerpoSolicitud) => send('post', E.SOLICITUDES, body),
    actualizar: (id: number, body: CuerpoSolicitud & { version: number }) => send('put', E.SOLICITUD(id), body),
    enviarFirma: (id: number, version: number) => send('post', E.ENVIAR_FIRMA(id), { version }),
    /** Solicitud con `requiere_firma: false`: pasa directo a ENVIADA, pendiente de recepción. */
    enviarDirecto: (id: number, version: number) => send('post', E.ENVIAR_DIRECTO(id), { version }),
    anular: (id: number, body: { version: number; motivo: string }) => send('post', E.ANULAR(id), body),

    recepcionar: (id: number, body: CuerpoRecepcion) => send('post', E.RECEPCION(id), body),

    pdfSolicitud: (id: number) => getPdf(E.SOLICITUD_PDF(id)),
    pdfRecepcion: (id: number) => getPdf(E.RECEPCION_PDF(id)),
};

/** Extrae el arreglo de filas de una respuesta de listado (plana o paginada) y su total. */
export const extraerListado = (data: any): { filas: any[]; total: number } => {
    if (Array.isArray(data)) return { filas: data, total: data.length };
    const candidata =
        data?.solicitudes ?? data?.items ?? data?.registros ?? data?.resultados ?? data?.rows ??
        Object.values(data ?? {}).find((v) => Array.isArray(v));
    const filas: any[] = Array.isArray(candidata) ? candidata : [];
    const total = Number(data?.total ?? data?.total_registros ?? filas.length);
    return { filas, total };
};

/** Abre un PDF (blob) en una pestaña nueva. */
export const abrirPdf = (blob: Blob) => {
    const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
};
