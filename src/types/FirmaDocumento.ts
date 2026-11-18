// Tipos para el módulo de Firma de Documentos.
// El backend real está en src/services/firmaDocumentos/firmaDocumentosApi.ts
// (endpoints `firmas/solicitudes/*`).

export type ModoFirma = 'Solo Yo' | 'Otros & Yo' | 'Solo otros' | 'Modo Audit Trail';

/**
 * Tipo de solicitud elegido en la pantalla "Nuevo Documento":
 * - 'unica'     → Firma única: solo el usuario actual firma con su rúbrica.
 * - 'varios'    → Se envía a una o más personas para que firmen.
 * - 'auditoria' → Con trazabilidad / registro de auditoría (aún no disponible).
 */
export type TipoSolicitudFirma = 'unica' | 'varios' | 'auditoria';

/**
 * Códigos confirmados del backend (`estado` de la solicitud):
 * 0=Borrador, 1=Enviado, 2=En proceso, 3=Terminado, 4=Rechazado, 5=Anulado.
 *
 * - 'Borrador'  → guardado en BD pero NO enviado (el destinatario no lo recibe).
 *                 Se puede editar o enviar más tarde.
 * - 'Pendiente' → enviado (1); ningún destinatario firmó todavía.
 * - 'EnProceso' → enviado (2); al menos un destinatario ya firmó, faltan otros.
 * - 'Firmado'   → todos los destinatarios firmaron (3).
 * - 'Rechazado' → algún destinatario rechazó la solicitud (4).
 * - 'Anulado'   → el remitente anuló el documento después de enviarlo (5).
 */
export type EstadoFirmaDocumento = 'Borrador' | 'Pendiente' | 'EnProceso' | 'Firmado' | 'Rechazado' | 'Anulado';

export type TipoFirma = 'imagen' | 'texto';

/** Catálogo de `GET /firmas/tipos-documento` (solo TIPO_DOC=FIRMAS, ESTADO=1). */
export interface TipoDocumentoFirma {
    id: number;
    nombre: string;
}

/** Identifica a la persona que crea el documento o a quien debe firmarlo. */
export interface ActorFirma {
    /** 'me' cuando es el usuario logueado en esta sesión, o el id del Personal elegido. */
    id: number | 'me';
    nombres: string;
    esUsuarioActual: boolean;
    /** Puesto / cargo (para el buscador y la lista de destinatarios). */
    cargo?: string;
    area?: string;
}

/** Persona que debe firmar un documento, con su turno dentro del flujo. */
export interface DestinatarioFirma {
    id: number | 'me';
    nombres: string;
    cargo?: string;
    area?: string;
    /** Turno de firma (1 = firma primero). En "firma única" siempre es 1. */
    orden: number;
    estado: 'Pendiente' | 'Firmado' | 'Rechazado';
    fechaFirma?: string; // ISO
    /** Motivo indicado por ESTE firmante al rechazar (solo si estado === 'Rechazado'). */
    motivoRechazo?: string;
}

/** Posición donde se colocó (o debe colocarse) la firma dentro del PDF. */
export interface PosicionFirma {
    pagina: number; // 1-based
    /** Porcentajes (0-100) relativos al tamaño de la página, origen arriba-izquierda. */
    xPct: number;
    yPct: number;
    wPct: number;
    hPct: number;
}

export interface DocumentoFirma {
    id: number;
    /** GUID que el backend asigna a la solicitud (`id_documento`). Se muestra como "ID DOCUMENTO" y se usa para firmar / cambiar de borrador a enviado. */
    codigoDocumento?: string;
    /** Código corto de 30 hex (`codigo_documento`), generado al crear la solicitud. Es el que se usa en el QR/link del validador público de firmas (NO el `id_documento`). */
    codigoCorto?: string;
    /** Id + versión del archivo PDF vigente en backend (última versión disponible). Se envían tal cual al firmar. */
    idArchivoBase?: number | string;
    versionBase?: number;
    /** Si el usuario actual puede firmar esta solicitud ahora mismo (según `/firmas/solicitudes/recibidos`). */
    puedeFirmar?: boolean;
    /** Motivo por el que no puede firmar todavía (no es su turno, ya firmó, etc.). */
    motivoBloqueo?: string;
    asunto: string;
    comentario?: string;
    modo: ModoFirma;
    nombreArchivo: string;
    creador: ActorFirma;
    firmante: ActorFirma;
    estado: EstadoFirmaDocumento;
    fechaCreacion: string; // ISO
    /** Fecha límite para firmar. */
    fechaVencimiento?: string; // ISO
    fechaFirma?: string; // ISO
    /** Motivo cuando el destinatario rechaza / anula la solicitud. */
    motivoRechazo?: string;

    /** Hash SHA-256 (hex) del PDF original, calculado al momento de subirlo. */
    hashOriginal: string;
    /** Hash SHA-256 (hex) del PDF ya firmado. Permite detectar alteraciones posteriores. */
    hashFirmado?: string;
    /** Código corto de verificación embebido en el PDF firmado. */
    codigoVerificacion?: string;

    posicionFirma?: PosicionFirma;
    tipoFirma?: TipoFirma;

    /** Tipo de solicitud con el que se creó ('unica' | 'varios'). */
    tipoSolicitud?: TipoSolicitudFirma;
    /** Lista ordenada de quienes deben firmar. */
    destinatarios?: DestinatarioFirma[];

    /** Id + nombre del catálogo `firmas/tipos-documento` (p. ej. "REQUERIMIENTOS", "ACTAS DE ENTREGA"). */
    tipoDocumento?: number;
    tipoDocumentoNombre?: string;
    /** true = los firmantes deben firmar en el orden indicado; false = cualquiera puede firmar sin esperar turno. */
    firmaSecuencial?: boolean;

    /** Object URLs listos para abrir/descargar (creados con URL.createObjectURL). */
    pdfOriginalUrl: string;
    pdfFirmadoUrl?: string;
}

/** Tamaño máximo permitido para el PDF del documento (50 MB). */
export const DOCUMENTO_PDF_MAX_BYTES = 50 * 1024 * 1024;

/**
 * Payload de la pantalla "Nuevo Documento" (firma única o varios).
 * `enviar = false` guarda un borrador; `enviar = true` inicia el proceso de firma.
 */
export interface CrearDocumentoFirmaPayload {
    tipoSolicitud: 'unica' | 'varios';
    asunto: string;
    comentario?: string;
    archivo: File;
    /** En "firma única" tendrá exactamente 1 elemento. El orden del arreglo es el orden de firma. */
    destinatarios: Array<Pick<ActorFirma, 'id' | 'nombres' | 'cargo' | 'area'>>;
    enviar: boolean;
    /** Id del catálogo `firmas/tipos-documento`. */
    tipoDocumento: number;
    /** Solo relevante en "varios": true = deben firmar en el orden de la lista; false = cualquiera puede firmar sin esperar turno. En "unica" siempre se envía `true`. */
    firmaSecuencial: boolean;
}
