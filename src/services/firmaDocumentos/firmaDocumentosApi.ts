// Cliente real del módulo "Firma de Documentos", contra los endpoints
// confirmados en las colecciones Postman:
//   - "PDN - Solicitudes de firma"
//   - "PDN - Firmas publicadas - Producción"
// (ver también src/services/miFirma/miFirmaApi.ts para la rúbrica).
//
// ⚠️ Los ejemplos de Postman no traían respuestas guardadas, así que los
// nombres exactos de los campos de /recibidos y /generados son una MEJOR
// SUPUESICIÓN basada en las convenciones que ya usa este backend en otros
// módulos (`url_documento`, `estado_aprobacion`, `nombres_completos`, etc.).
// `pick()` prueba varias variantes de nombre por campo para tolerar
// diferencias menores; si un dato no aparece donde se espera, ajustar SOLO
// las listas de candidatos de `mapDocumentoBase` / `mapFirmante` / abajo.
import { apiManager } from '../api/ApiManager';
import {
    ActorFirma,
    CrearDocumentoFirmaPayload,
    DestinatarioFirma,
    DocumentoFirma,
    EstadoFirmaDocumento,
    PosicionFirma,
    TipoDocumentoFirma,
    TipoFirma,
    TipoSolicitudFirma,
} from '../../types/FirmaDocumento';
import { calcularHashSha256, generarCodigoDocumentoHex30, incrustarFirmaEnPdf } from '../../utils/firmaDocumentosPdf';
import { generarQrPngBytes } from '../../utils/qrCode';
import { VALIDADOR_FIRMAS_BASE_URL } from '../config/apiConfig';

const pick = (obj: any, keys: string[]): any => {
    if (!obj) return undefined;
    for (const k of keys) {
        if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
    }
    return undefined;
};

/**
 * `pdfOriginalUrl`/`pdfFirmadoUrl` (`url_documento`) son links de SharePoint:
 * el navegador no puede abrirlos/descargarlos directo (requieren la sesión de
 * SharePoint), así que hay que pedirle al backend que los descargue por
 * nosotros vía `POST api/sharepoint/visualizar-pdf` (body: `{ url }`). El
 * backend devuelve el PDF como binario crudo (no JSON), de ahí `postBlob`.
 */
export const descargarPdfBlob = async (url: string): Promise<Blob> => {
    const { blob } = await apiManager.sharepoint.visualizarPdf({ url });
    if (!blob || blob.size === 0) throw new Error('No se pudo descargar el documento.');
    return blob;
};

export const descargarPdfBytes = async (url: string): Promise<Uint8Array> => {
    const blob = await descargarPdfBlob(url);
    return new Uint8Array(await blob.arrayBuffer());
};

/** Igual que `descargarPdfBytes`, pero listo como Object URL para `<object>`/descarga/impresión. */
export const descargarPdfComoBlobUrl = async (url: string): Promise<string> => {
    const blob = await descargarPdfBlob(url);
    return URL.createObjectURL(blob);
};

/**
 * Códigos de `estado` confirmados por el backend:
 * 0=Borrador, 1=Enviado, 2=En proceso, 3=Terminado, 4=Rechazado, 5=Anulado.
 * El backend YA distingue "Enviado" de "En proceso" en el propio documento
 * (no hace falta re-derivarlo contando destinatarios firmados en el
 * frontend, que además llegaba desactualizado).
 */
const ESTADO_DOC_MAP: Record<string, EstadoFirmaDocumento> = {
    '0': 'Borrador',
    BORRADOR: 'Borrador',
    '1': 'Pendiente',
    ENVIADO: 'Pendiente',
    PENDIENTE: 'Pendiente',
    '2': 'EnProceso',
    'EN PROCESO': 'EnProceso',
    EN_PROCESO: 'EnProceso',
    '3': 'Firmado',
    TERMINADO: 'Firmado',
    FIRMADO: 'Firmado',
    FINALIZADO: 'Firmado',
    COMPLETADO: 'Firmado',
    '4': 'Rechazado',
    RECHAZADO: 'Rechazado',
    '5': 'Anulado',
    ANULADO: 'Anulado',
};
const mapEstadoDocumento = (raw: any): EstadoFirmaDocumento =>
    ESTADO_DOC_MAP[String(raw ?? '').trim().toUpperCase()] ?? 'Pendiente';

// Confirmado con datos reales: el backend reutiliza el MISMO enum de
// `estado` del documento (0=Borrador,1=Enviado,2=EnProceso,3=Terminado,
// 4=Rechazado,5=Anulado) también para el `estado` de cada destinatario, no
// un enum aparte. Ejemplos vistos: '0' = pendiente de firmar, '3' = firmó,
// '4' = rechazó (con `estado_firmante_nombre: "RECHAZADO"` confirmándolo).
const ESTADO_FIRMANTE_MAP: Record<string, DestinatarioFirma['estado']> = {
    '0': 'Pendiente',
    BORRADOR: 'Pendiente',
    ENVIADO: 'Pendiente',
    PENDIENTE: 'Pendiente',
    ESPERA: 'Pendiente',
    '3': 'Firmado',
    TERMINADO: 'Firmado',
    FIRMADO: 'Firmado',
    '4': 'Rechazado',
    RECHAZADO: 'Rechazado',
};
const mapEstadoFirmante = (raw: any): DestinatarioFirma['estado'] =>
    ESTADO_FIRMANTE_MAP[String(raw ?? '').trim().toUpperCase()] ?? 'Pendiente';

/** TODO(CONFIRMAR): códigos reales de `tipo_firma` (aquí: 1=única, 2=varios, 3=auditoría). */
const TIPO_FIRMA_MAP: Record<string, TipoSolicitudFirma> = {
    '1': 'unica',
    UNICA: 'unica',
    UNICO: 'unica',
    '2': 'varios',
    VARIOS: 'varios',
    '3': 'auditoria',
    AUDITORIA: 'auditoria',
};
const mapTipoFirma = (raw: any): TipoSolicitudFirma => TIPO_FIRMA_MAP[String(raw ?? '').trim().toUpperCase()] ?? 'unica';
const tipoFirmaACodigo = (t: TipoSolicitudFirma): string => (t === 'varios' ? '2' : t === 'auditoria' ? '3' : '1');

const modoDeTipo = (t: TipoSolicitudFirma) => (t === 'varios' ? ('Solo otros' as const) : t === 'auditoria' ? ('Modo Audit Trail' as const) : ('Solo Yo' as const));

const mapFirmante = (raw: any, idx: number): DestinatarioFirma => ({
    id: Number(pick(raw, ['id_personal', 'idPersonal', 'id'])) || idx + 1,
    nombres: pick(raw, ['nombres_completos', 'nombre_completo', 'nombres', 'nombre']) || `Firmante ${idx + 1}`,
    cargo: pick(raw, ['puesto_nombre', 'cargo', 'puesto']),
    area: pick(raw, ['area_nombre', 'area']),
    orden: Number(pick(raw, ['orden', 'turno', 'orden_firma'])) || idx + 1,
    estado: mapEstadoFirmante(pick(raw, ['estado_firmante', 'estado'])),
    fechaFirma: pick(raw, ['fecha_firma', 'fechaFirma']),
    // Nombres explícitos (no genéricos como `comentario`/`motivo`) para no
    // confundirlo con el comentario general de la solicitud, que en la fila
    // plana de `recibidos` vive en el MISMO objeto `raw`.
    motivoRechazo: pick(raw, ['motivo_rechazo', 'comentario_rechazo']),
});

/** Extrae el arreglo de filas de una respuesta paginada, tolerando varias formas de envoltorio. */
const extraerFilas = (resp: any): any[] => {
    const data = resp?.data ?? resp;
    if (Array.isArray(data)) return data;
    return data?.documentos ?? data?.items ?? data?.registros ?? data?.resultados ?? data?.data ?? [];
};

const mapDocumentoBase = (raw: any): Omit<DocumentoFirma, 'creador' | 'firmante'> => {
    const tipoSolicitud = mapTipoFirma(pick(raw, ['tipo_firma']));
    // `generados` trae un arreglo `destinatarios`/`firmantes` anidado (la lista
    // completa de firmantes). `recibidos` en cambio devuelve una fila PLANA
    // por (documento, firmante = yo): sin arreglo, con `id_firmante` /
    // `estado_firmante` / `orden_firma` sueltos al nivel de la fila. En ese
    // caso la fila ES el firmante, así que se envuelve en un arreglo de 1.
    let firmantesRaw: any[] = pick(raw, ['firmantes', 'destinatarios']) || [];
    if (!firmantesRaw.length && (raw?.estado_firmante !== undefined || raw?.id_firmante !== undefined)) {
        firmantesRaw = [raw];
    }
    const destinatarios = firmantesRaw.map(mapFirmante);
    // `generados` usa `estado`; `recibidos` usa `estado_documento`.
    const estado = mapEstadoDocumento(pick(raw, ['estado_documento', 'estado']));
    const urlDocumento = pick(raw, ['url_documento', 'url_archivo', 'url']) || '';

    return {
        // No hay un `id` numérico de solicitud en la respuesta real; `id_archivo`
        // es numérico y único por documento, así que sirve de key/selección estable.
        id: Number(pick(raw, ['id_archivo', 'id', 'id_solicitud'])) || 0,
        codigoDocumento: pick(raw, ['id_documento', 'idDocumento', 'guid']),
        codigoCorto: pick(raw, ['codigo_documento', 'codigoDocumento']),
        asunto: pick(raw, ['asunto']) || '',
        comentario: pick(raw, ['comentario']),
        modo: modoDeTipo(tipoSolicitud),
        tipoSolicitud,
        nombreArchivo: pick(raw, ['nombre_archivo', 'nombreArchivo', 'archivo_nombre']) || 'documento.pdf',
        estado,
        fechaCreacion: pick(raw, ['fecha_envio', 'fecha_creacion', 'fecha_solicitud']) || new Date().toISOString(),
        fechaVencimiento: pick(raw, ['fecha_vencimiento', 'vencimiento']),
        fechaFirma: pick(raw, ['fecha_firma']),
        motivoRechazo: pick(raw, ['motivo_rechazo', 'comentario_rechazo', 'motivo']),
        hashOriginal: '',
        destinatarios,
        idArchivoBase: pick(raw, ['id_archivo', 'id_archivo_base', 'id_archivo_actual']),
        versionBase: Number(pick(raw, ['version_archivo', 'version', 'version_base', 'version_actual'])) || 0,
        puedeFirmar: typeof raw?.puede_firmar === 'boolean' ? raw.puede_firmar : undefined,
        motivoBloqueo: pick(raw, ['motivo_bloqueo']),
        tipoDocumento: pick(raw, ['tipo_documento']) !== undefined ? Number(pick(raw, ['tipo_documento'])) : undefined,
        tipoDocumentoNombre: pick(raw, ['tipo_documento_nombre']),
        firmaSecuencial: typeof raw?.firma_secuencial === 'boolean' ? raw.firma_secuencial : undefined,
        pdfOriginalUrl: urlDocumento,
        pdfFirmadoUrl: estado === 'Firmado' ? urlDocumento : undefined,
    };
};

/** Fila de `GET /firmas/solicitudes/recibidos`: la vemos desde el punto de vista de quien debe firmar. */
const mapRecibido = (raw: any, idPersonal: number, nombrePropio: string): DocumentoFirma => {
    const base = mapDocumentoBase(raw);
    const creador: ActorFirma = {
        id: Number(pick(raw, ['id_personal_creador'])) || 0,
        nombres: pick(raw, ['remitente', 'nombre_creador', 'creador', 'enviado_por']) || 'Remitente',
        esUsuarioActual: false,
    };
    const firmante: ActorFirma = { id: idPersonal, nombres: nombrePropio, esUsuarioActual: true };
    // La fila plana de `recibidos` no trae el nombre del firmante (solo
    // `id_personal`); como esa fila siempre es "yo", se completa con mi propio nombre.
    const destinatarios = base.destinatarios?.map((d) => (Number(d.id) === idPersonal ? { ...d, nombres: nombrePropio } : d));
    return { ...base, destinatarios, creador, firmante };
};

/** Fila de `GET /firmas/solicitudes/generados`: la vemos desde el punto de vista de quien la creó. */
const mapGenerado = (raw: any, idPersonalCreador: number, nombreCreador: string): DocumentoFirma => {
    const base = mapDocumentoBase(raw);
    const creador: ActorFirma = { id: idPersonalCreador, nombres: nombreCreador, esUsuarioActual: true };
    const primero = base.destinatarios?.[0];
    const firmante: ActorFirma = primero ? { id: primero.id, nombres: primero.nombres, esUsuarioActual: false } : creador;
    return { ...base, creador, firmante };
};

export const firmaDocumentosApi = {
    async listarRecibidos(args: {
        idPersonal: number;
        nombrePropio: string;
        pagina?: number;
        tamano?: number;
        puedeFirmar?: boolean;
    }): Promise<DocumentoFirma[]> {
        const resp = await apiManager.firmas.solicitudes.recibidos({
            id_personal: args.idPersonal,
            pagina: args.pagina ?? 1,
            tamano: args.tamano ?? 100,
            puede_firmar: args.puedeFirmar,
        });
        return extraerFilas(resp).map((r) => mapRecibido(r, args.idPersonal, args.nombrePropio));
    },

    async listarGenerados(args: {
        idPersonalCreador: number;
        nombreCreador: string;
        pagina?: number;
        tamano?: number;
        estado?: string;
        tipoFirma?: string;
        buscar?: string;
    }): Promise<DocumentoFirma[]> {
        const resp = await apiManager.firmas.solicitudes.generados({
            id_personal_creador: args.idPersonalCreador,
            pagina: args.pagina ?? 1,
            tamano: args.tamano ?? 100,
            estado: args.estado,
            tipo_firma: args.tipoFirma,
            buscar: args.buscar,
        });
        return extraerFilas(resp).map((r) => mapGenerado(r, args.idPersonalCreador, args.nombreCreador));
    },

    /** Catálogo del desplegable "Tipo de documento" (`GET firmas/tipos-documento`). */
    async listarTiposDocumento(): Promise<TipoDocumentoFirma[]> {
        const resp = await apiManager.firmas.tiposDocumento();
        return extraerFilas(resp).map((t: any) => ({ id: Number(t.id), nombre: String(t.nombre ?? '') }));
    },

    /** Crea una solicitud (borrador o enviada según `payload.enviar`). */
    async crearSolicitud(payload: CrearDocumentoFirmaPayload, idPersonalCreador: number, idPersonalPropio: number): Promise<void> {
        const firmantes = payload.destinatarios.map((d) => (d.id === 'me' ? idPersonalPropio : Number(d.id)));
        const datos = {
            codigo_documento: generarCodigoDocumentoHex30(),
            id_personal_creador: idPersonalCreador,
            tipo_firma: tipoFirmaACodigo(payload.tipoSolicitud),
            tipo_documento: payload.tipoDocumento,
            firma_secuencial: payload.firmaSecuencial,
            asunto: payload.asunto,
            comentario: payload.comentario || '',
            estado: payload.enviar ? '1' : '0',
            firmantes,
        };
        const fd = new FormData();
        fd.append('file', payload.archivo, payload.archivo.name);
        fd.append('datos', new Blob([JSON.stringify(datos)], { type: 'application/json' }));

        const resp = await apiManager.firmas.solicitudes.crear(fd);
        if (resp?.code && resp.code !== 200 && resp.code !== 201) {
            throw new Error(resp?.message || 'No se pudo crear la solicitud de firma.');
        }
    },

    /** Pasa una solicitud de Borrador a Enviado (backend: `cambio-borrador-enviado`). */
    async cambioBorradorEnviado(idDocumento: string, idPersonalCreador: number): Promise<void> {
        const resp = await apiManager.firmas.solicitudes.cambioBorradorEnviado({
            id_documento: idDocumento,
            id_personal_creador: idPersonalCreador,
        });
        if (resp?.code && resp.code !== 200) {
            throw new Error(resp?.message || 'No se pudo enviar el documento.');
        }
    },

    /**
     * Incrusta la firma (imagen o texto) en el PDF vigente y sube la nueva
     * versión ya firmada. El backend requiere `id_archivo_base`/`version_base`
     * de la última versión disponible (vienen del propio `doc`, obtenido de
     * `recibidos`).
     */
    async firmarSolicitud(
        doc: DocumentoFirma,
        idPersonal: number,
        nombreFirmante: string,
        opts: { tipoFirma: TipoFirma; imagenFirma?: File | null; posicion: PosicionFirma; cargoFirmante?: string }
    ): Promise<{ qrGenerado: boolean }> {
        if (!doc.codigoDocumento) throw new Error('El documento no tiene un ID válido para firmar.');
        const codigoDocumento = doc.codigoCorto || doc.codigoDocumento;
        const pdfBytes = await descargarPdfBytes(doc.pdfOriginalUrl);
        const fechaFirmaISO = new Date().toISOString();
        const imagenBytes = opts.imagenFirma ? await opts.imagenFirma.arrayBuffer() : null;
        // QR con el link público de validación (esquina inferior derecha de la
        // última página). Se regenera en cada firma, pero como el link es el
        // mismo para todo el documento, redibujarlo en el mismo lugar es
        // inofensivo (no se "acumula" nada visualmente, y así también queda
        // en la versión final aunque la primera firma no lo haya tenido). Si
        // falla, NO se bloquea la firma (es un elemento accesorio del PDF),
        // pero se informa a la pantalla para que avise al usuario en vez de
        // quedar en silencio (antes solo se registraba en consola).
        let qrPngBytes: Uint8Array | null = null;
        let qrGenerado = true;
        try {
            qrPngBytes = await generarQrPngBytes(`${VALIDADOR_FIRMAS_BASE_URL}/${codigoDocumento}`);
        } catch (e) {
            qrGenerado = false;
            console.error('No se pudo generar el QR de validación.', e);
        }
        const { bytes } = await incrustarFirmaEnPdf({
            pdfBytes,
            posicion: opts.posicion,
            tipoFirma: opts.tipoFirma,
            imagenFirmaBytes: imagenBytes,
            nombreFirmante,
            cargoFirmante: opts.cargoFirmante,
            fechaFirmaISO,
            codigoDocumento,
            qrPngBytes,
        });
        // Descartamos el hash: solo se usaba para el histórico local del mock.
        void (await calcularHashSha256(bytes));

        const archivoFirmado = new File([bytes], doc.nombreArchivo || 'documento-firmado.pdf', { type: 'application/pdf' });
        const datos = {
            id_documento: doc.codigoDocumento,
            id_personal: idPersonal,
            id_archivo_base: doc.idArchivoBase,
            version_base: doc.versionBase,
        };
        const fd = new FormData();
        fd.append('file', archivoFirmado, archivoFirmado.name);
        fd.append('datos', new Blob([JSON.stringify(datos)], { type: 'application/json' }));

        const resp = await apiManager.firmas.solicitudes.firmar(fd);
        if (resp?.code && resp.code !== 200) {
            throw new Error(resp?.message || 'No se pudo firmar el documento.');
        }
        return { qrGenerado };
    },

    /**
     * Rechaza (firmante en turno) o anula (creador) una solicitud enviada.
     * Backend: `POST firmas/solicitudes/{id_documento}/rechazar-anular`.
     */
    async rechazarSolicitud(doc: DocumentoFirma, accion: 'RECHAZAR' | 'ANULAR', comentario?: string): Promise<void> {
        if (!doc.codigoDocumento) throw new Error('El documento no tiene un ID válido para rechazar/anular.');
        const resp = await apiManager.firmas.solicitudes.rechazarAnular(doc.codigoDocumento, accion, comentario);
        if (resp?.code && resp.code !== 200) {
            throw new Error(resp?.message || 'No se pudo rechazar el documento.');
        }
    },

    /**
     * Detalle completo de UN documento (`GET firmas/solicitudes/{id}/seguimiento`),
     * con el estado/orden/fecha individual de cada firmante. A diferencia de
     * `firmas/seguimiento` (que solo trae nombres de receptores), esta sí puede
     * consultarla un fiscalizador autorizado y no solo el creador/participante,
     * así que es la que usa el módulo "Seguimiento Firma" para mostrar el
     * detalle completo al abrir el modal.
     */
    async obtenerSeguimientoDocumento(idDocumento: string): Promise<DocumentoFirma> {
        const resp = await apiManager.firmas.solicitudes.seguimientoDocumento(idDocumento);
        if (resp?.code && resp.code !== 200) {
            throw new Error(resp?.message || 'No se pudo obtener el seguimiento del documento.');
        }
        const raw = resp?.data ?? resp;
        const base = mapDocumentoBase(raw);
        const creador: ActorFirma = {
            id: 0,
            nombres: pick(raw, ['emisor', 'nombre_creador', 'creador']) || 'Creador',
            esUsuarioActual: false,
        };
        const primero = base.destinatarios?.[0];
        const firmante: ActorFirma = primero ? { id: primero.id, nombres: primero.nombres, esUsuarioActual: false } : creador;
        return { ...base, creador, firmante };
    },
};
