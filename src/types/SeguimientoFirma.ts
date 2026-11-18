// Tipos para el módulo "Seguimiento Firma" (auditoría de todos los
// documentos, sin importar quién los creó). Backend real:
// src/services/seguimientoFirma/seguimientoFirmaApi.ts
// (endpoint `GET /firmas/seguimiento`, colección Postman
// "PDN - Seguimiento Firma - Produccion").
//
// A diferencia de "Documentos Creados"/"Recibidos", esta API no pagina ni
// filtra en el servidor: siempre devuelve todos los documentos que el
// usuario logueado está autorizado a auditar (requiere el permiso
// `firmas.SEGUIMIENTO_ACCESO`), y el filtrado/paginación se hace en el
// frontend.

export interface SeguimientoDocumento {
    idDocumento: string;
    codigoDocumento: string;
    /** Puede no venir del backend (no está confirmado en la colección Postman); si falta, se deja vacío. */
    asunto?: string;
    fechaCreacion: string; // ISO
    emisor: string;
    idArea?: number | string;
    area: string;
    /** Código crudo de estado (ver `ESTADO_SEGUIMIENTO_META` para el estado ya normalizado a mostrar). */
    estado: string;
    estadoNombre: string;
    receptores: string[];
    idArchivo: number | string;
    versionArchivo: number;
    urlUltimoDocumento: string;
}

export type EstadoSeguimientoVista = 'BORRADOR' | 'ENVIADO' | 'EN PROCESO' | 'TERMINADO' | 'RECHAZADO' | 'ANULADO';

export const ESTADO_SEGUIMIENTO_META: Record<EstadoSeguimientoVista, { clase: string; desc: string }> = {
    BORRADOR: {
        clase: 'bg-blue-50 text-blue-600 ring-1 ring-blue-200',
        desc: 'El documento está en borrador y no ha sido enviado.',
    },
    ENVIADO: {
        clase: 'bg-amber-50 text-amber-600 ring-1 ring-amber-200',
        desc: 'El documento fue enviado y está pendiente de inicio.',
    },
    'EN PROCESO': {
        clase: 'bg-purple-50 text-purple-600 ring-1 ring-purple-200',
        desc: 'El documento está siendo firmado por los destinatarios.',
    },
    TERMINADO: {
        clase: 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200',
        desc: 'Todos los destinatarios han firmado el documento.',
    },
    RECHAZADO: {
        clase: 'bg-rose-50 text-rose-600 ring-1 ring-rose-200',
        desc: 'El documento fue rechazado por uno de los firmantes.',
    },
    ANULADO: {
        clase: 'bg-orange-50 text-orange-500 ring-1 ring-orange-200',
        desc: 'El documento fue anulado por el remitente.',
    },
};
