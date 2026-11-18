// Cliente del módulo Comedor, contra la colección Postman
// "PDN - Comedor - Produccion". Todas las respuestas son { code, message, data }.
// Los catálogos usan concurrencia optimista: cada update/estado envía `version`.
import { apiManager } from '../api/ApiManager';
import { ENDPOINTS } from '../config/endpoints';

export type EstadoFiltro = 'todos' | 0 | 1;

export interface RespuestaApi<T = any> {
    code?: number;
    message?: string;
    data: T;
}

const E = ENDPOINTS.COMEDOR;

const qs = (params: Record<string, any>) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
    });
    const s = q.toString();
    return s ? `?${s}` : '';
};

/** Lanza Error con el mensaje del backend si la respuesta no es 2xx. */
export const asegurarOk = <T = any>(resp: RespuestaApi<T>, mensajeDefecto: string): RespuestaApi<T> => {
    const code = resp?.code;
    if (code !== undefined && (code < 200 || code >= 300)) {
        throw new Error(resp?.message || mensajeDefecto);
    }
    return resp;
};

/** Catálogo con CRUD estándar + activar/desactivar. */
const crearCatalogo = (base: string) => ({
    listar: (estado: EstadoFiltro = 'todos') =>
        apiManager.request('get', `${base}${qs({ estado })}`) as Promise<RespuestaApi<any[]>>,
    crear: (data: any) => apiManager.request('post', base, data) as Promise<RespuestaApi>,
    actualizar: (id: number, data: any) => apiManager.request('put', `${base}/${id}`, data) as Promise<RespuestaApi>,
    cambiarEstado: (id: number, data: { estado: 0 | 1; version: number; usuario: string }) =>
        apiManager.request('patch', `${base}/${id}/estado`, data) as Promise<RespuestaApi>,
});

export type CatalogoApi = ReturnType<typeof crearCatalogo>;

export interface FiltrosReporte {
    fecha_inicio: string;
    fecha_fin: string;
    id_punto_atencion?: number | string;
    id_empresa_comensal?: number | string;
    tipo_comensal?: string;
    estado?: string | number;
    pagina?: number;
    tamano?: number;
}

export const comedorApi = {
    tipoServicios: crearCatalogo(E.TIPO_SERVICIOS),
    puntos: crearCatalogo(E.PUNTOS),
    horarios: crearCatalogo(E.HORARIOS),
    tarifas: crearCatalogo(E.TARIFAS),
    invitados: crearCatalogo(E.INVITADOS),

    identificar: (body: { dni?: string; qr?: string }) =>
        apiManager.request('post', E.IDENTIFICAR, body) as Promise<RespuestaApi>,

    /**
     * Registra un consumo. `id_solicitud` (UUID) hace idempotente la operación:
     * reutilizarlo al reintentar la MISMA operación, generar uno nuevo para otra.
     */
    registrarConsumo: (body: {
        id_punto_atencion: number;
        id_solicitud: string;
        equipo: string;
        usuario: string;
        dni?: string;
        qr?: string;
        id_invitado?: number;
    }) => apiManager.request('post', E.CONSUMOS, body) as Promise<RespuestaApi>,

    reimprimir: (idConsumo: number, body: { id_solicitud: string; equipo: string; motivo: string; usuario: string }) =>
        apiManager.request('post', E.REIMPRIMIR(idConsumo), body) as Promise<RespuestaApi>,

    cambiarEstadoImpresion: (
        idImpresion: number,
        body: { version: number; estado: 'ENVIADO' | 'CONFIRMADO' | 'ERROR'; usuario: string; mensaje_error?: string }
    ) => apiManager.request('patch', E.ESTADO_IMPRESION(idImpresion), body) as Promise<RespuestaApi>,

    reporteConsumos: (filtros: FiltrosReporte) =>
        apiManager.request('get', `${E.REPORTE_CONSUMOS}${qs(filtros)}`) as Promise<RespuestaApi>,

    extras: {
        listar: (filtros: FiltrosExtras) => apiManager.request('get', `${E.EXTRAS}${qs(filtros)}`) as Promise<RespuestaApi>,
        obtener: (id: number) => apiManager.request('get', E.EXTRA(id)) as Promise<RespuestaApi>,
        crear: (body: CuerpoExtra) => apiManager.request('post', E.EXTRAS, body) as Promise<RespuestaApi>,
        actualizar: (id: number, body: CuerpoExtra & { version: number }) =>
            apiManager.request('put', E.EXTRA(id), body) as Promise<RespuestaApi>,
        atender: (id: number, body: { version: number; usuario: string }) =>
            apiManager.request('patch', E.EXTRA_ATENDER(id), body) as Promise<RespuestaApi>,
        anular: (id: number, body: { version: number; usuario: string; motivo: string }) =>
            apiManager.request('patch', E.EXTRA_ANULAR(id), body) as Promise<RespuestaApi>,
    },

    dietas: {
        personalPorDni: (dni: string) => apiManager.request('get', `${E.DIETAS_PERSONAL}${qs({ dni })}`) as Promise<RespuestaApi>,
        listar: (filtros: FiltrosDietas) => apiManager.request('get', `${E.DIETAS}${qs(filtros)}`) as Promise<RespuestaApi>,
        obtener: (id: number) => apiManager.request('get', E.DIETA(id)) as Promise<RespuestaApi>,
        crear: (body: CuerpoDieta) => apiManager.request('post', E.DIETAS, body) as Promise<RespuestaApi>,
        actualizar: (id: number, body: CuerpoDieta & { version: number }) =>
            apiManager.request('put', E.DIETA(id), body) as Promise<RespuestaApi>,
        cambiarEstado: (id: number, body: { estado: 0 | 1; version: number; usuario: string }) =>
            apiManager.request('patch', E.DIETA_ESTADO(id), body) as Promise<RespuestaApi>,
    },

    valorizacion: (filtros: FiltrosExtras) =>
        apiManager.request('get', `${E.REPORTE_VALORIZACION}${qs(filtros)}`) as Promise<RespuestaApi>,

    valorizacionMensual: (filtros: FiltrosValorizacionMensual) =>
        apiManager.request('get', `${E.REPORTE_VALORIZACION_MENSUAL}${qs(filtros)}`) as Promise<RespuestaApi>,
};

export interface FiltrosValorizacionMensual {
    anio: number | string;
    mes: number | string;
    id_empresa?: number | string;
    id_punto_atencion?: number | string;
    moneda?: string;
    /** Paginación del `detalle.registros` (el resto del reporte siempre es el mes completo). */
    pagina?: number;
    tamano?: number;
}

export interface FiltrosExtras {
    fecha_inicio: string;
    fecha_fin: string;
    id_punto_atencion?: number | string;
    id_empresa_cargo?: number | string;
    estado?: string;
    busqueda?: string;
    pagina?: number;
    tamano?: number;
}

export type SituacionDieta = 'TODOS' | 'VIGENTE' | 'VENCIDA' | 'PROGRAMADA' | 'INACTIVA';

export interface FiltrosDietas {
    situacion?: SituacionDieta;
    id_personal?: number | string;
    id_punto_atencion?: number | string;
    busqueda?: string;
    pagina?: number;
    tamano?: number;
}

export interface CuerpoDieta {
    id_personal: number;
    id_punto_atencion: number;
    vigente_desde: string;
    vigente_hasta: string | null;
    moneda: string;
    observacion: string | null;
    usuario: string;
    detalle: { id_tipo_servicio: number; precio_especial: number }[];
}

export interface CuerpoExtra {
    id_solicitud: string;
    fecha_atencion: string;
    id_punto_atencion: number;
    id_empresa_cargo: number;
    solicitante: string;
    motivo: string;
    observaciones?: string | null;
    moneda: string;
    usuario: string;
    detalle: { concepto: string; cantidad: number; precio_unitario: number }[];
}

/** Genera el UUID de idempotencia (con fallback para contextos sin crypto.randomUUID). */
export const nuevoIdSolicitud = (): string =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
              const r = (Math.random() * 16) | 0;
              return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
          });
