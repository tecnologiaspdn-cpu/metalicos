import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiManager } from '../services/api/ApiManager';
import { firmaDocumentosApi } from '../services/firmaDocumentos/firmaDocumentosApi';
import { Personal } from '../types/Personal';
import {
    ActorFirma,
    CrearDocumentoFirmaPayload,
    DocumentoFirma,
    PosicionFirma,
    TipoDocumentoFirma,
    TipoFirma,
} from '../types/FirmaDocumento';

export interface UsuarioSesion {
    usuario_id: number;
    /** Id de la persona (tabla `personal`) que identifican los endpoints `/firmas/*`. */
    idPersonal: number;
    nombres: string;
    /** Versión corta del nombre (p. ej. "Edward P. Rodrigo C."), usada SOLO para el texto que se estampa junto a la firma en el PDF (evita que un nombre largo se vea gigante o se corte en el sello). */
    nombreResumido: string;
    username: string;
    empresa_id: number;
}

/** Lee el usuario logueado guardado por AuthService al hacer login. */
export const getUsuarioSesion = (): UsuarioSesion => {
    const raw = localStorage.getItem('usuarioCookie');
    const parsed = raw ? JSON.parse(raw) : {};

    // TODO(CONFIRMAR CON BACKEND): las rutas /firmas/* identifican a la
    // persona con `id_personal` (id de la tabla `personal`), que es distinto
    // de `usuario_id` (cuenta de login). Hoy no existe ningún campo así en la
    // respuesta de login que consume este frontend, así que probamos algunos
    // nombres candidatos y, si no aparece ninguno, caemos a `usuario_id` como
    // resguardo temporal (probablemente incorrecto) para no romper la app.
    const idPersonalCrudo = parsed.id_personal ?? parsed.personal_id ?? parsed.idPersonal;
    if (idPersonalCrudo === undefined) {
        console.warn(
            '[useFirmaDocumentos] No se encontró id_personal en la sesión (usuarioCookie). ' +
                'Usando usuario_id como resguardo temporal; confirmar con backend el campo correcto ' +
                'para que /firmas/* reciba el id_personal real.'
        );
    }

    return {
        usuario_id: Number(parsed.usuario_id) || 0,
        idPersonal: Number(idPersonalCrudo ?? parsed.usuario_id) || 0,
        nombres: parsed.nombres_completos || parsed.username || 'Usuario',
        nombreResumido: parsed.nombre_resumido || parsed.nombres_completos || parsed.username || 'Usuario',
        username: parsed.username || '',
        empresa_id: Number(parsed.empresa_id) || 0,
    };
};

export const useFirmaDocumentos = () => {
    const usuarioSesion = useMemo(() => getUsuarioSesion(), []);

    const [personal, setPersonal] = useState<Personal[]>([]);
    const [documentosCreados, setDocumentosCreados] = useState<DocumentoFirma[]>([]);
    const [documentosRecibidos, setDocumentosRecibidos] = useState<DocumentoFirma[]>([]);
    const [tiposDocumento, setTiposDocumento] = useState<TipoDocumentoFirma[]>([]);
    const [loadingPersonal, setLoadingPersonal] = useState(false);
    const [loadingCreados, setLoadingCreados] = useState(false);
    const [loadingRecibidos, setLoadingRecibidos] = useState(false);
    const [loadingTiposDocumento, setLoadingTiposDocumento] = useState(false);

    // Personal de la misma empresa del usuario logueado (endpoint real ya
    // existente, usado para elegir a "quién debe firmar").
    const fetchPersonal = useCallback(async () => {
        setLoadingPersonal(true);
        try {
            const resp = await apiManager.personal.getAll({ id_empresa: usuarioSesion.empresa_id });
            setPersonal(resp?.data || resp || []);
        } catch (e) {
            console.error('No se pudo obtener el personal de la empresa.', e);
            setPersonal([]);
        } finally {
            setLoadingPersonal(false);
        }
    }, [usuarioSesion.empresa_id]);

    const fetchCreados = useCallback(async () => {
        setLoadingCreados(true);
        try {
            const data = await firmaDocumentosApi.listarGenerados({
                idPersonalCreador: usuarioSesion.idPersonal,
                nombreCreador: usuarioSesion.nombres,
            });
            setDocumentosCreados(data);
        } catch (e) {
            console.error('No se pudieron obtener los documentos generados.', e);
            setDocumentosCreados([]);
        } finally {
            setLoadingCreados(false);
        }
    }, [usuarioSesion.idPersonal, usuarioSesion.nombres]);

    const fetchRecibidos = useCallback(async () => {
        setLoadingRecibidos(true);
        try {
            const data = await firmaDocumentosApi.listarRecibidos({
                idPersonal: usuarioSesion.idPersonal,
                nombrePropio: usuarioSesion.nombres,
            });
            setDocumentosRecibidos(data);
        } catch (e) {
            console.error('No se pudieron obtener los documentos recibidos.', e);
            setDocumentosRecibidos([]);
        } finally {
            setLoadingRecibidos(false);
        }
    }, [usuarioSesion.idPersonal, usuarioSesion.nombres]);

    // Catálogo "Tipo de documento" (desplegable en "Nuevo Documento").
    const fetchTiposDocumento = useCallback(async () => {
        setLoadingTiposDocumento(true);
        try {
            const data = await firmaDocumentosApi.listarTiposDocumento();
            setTiposDocumento(data);
        } catch (e) {
            console.error('No se pudo obtener el catálogo de tipos de documento.', e);
            setTiposDocumento([]);
        } finally {
            setLoadingTiposDocumento(false);
        }
    }, []);

    useEffect(() => {
        fetchPersonal();
        fetchCreados();
        fetchRecibidos();
        fetchTiposDocumento();
    }, [fetchPersonal, fetchCreados, fetchRecibidos, fetchTiposDocumento]);

    /** Opciones para el selector de firmante: "Yo mismo" + personal de la empresa. */
    const opcionesFirmante: ActorFirma[] = useMemo(() => {
        const yo: ActorFirma = { id: 'me', nombres: `${usuarioSesion.nombres} (Yo)`, esUsuarioActual: true };
        const otros: ActorFirma[] = (personal || [])
            .filter((p) => p.id != null)
            .map((p) => ({
                id: Number(p.id),
                nombres: `${p.nombres ?? ''} ${p.ape_pat ?? ''} ${p.ape_mat ?? ''}`.trim() || `Personal #${p.id}`,
                esUsuarioActual: false,
                cargo: p.puesto_nombre || undefined,
                area: p.area_nombre || undefined,
            }));
        return [yo, ...otros];
    }, [personal, usuarioSesion.nombres]);

    const crearDocumento = useCallback(
        async (payload: CrearDocumentoFirmaPayload) => {
            await firmaDocumentosApi.crearSolicitud(payload, usuarioSesion.idPersonal, usuarioSesion.idPersonal);
            await Promise.all([fetchCreados(), fetchRecibidos()]);
        },
        [fetchCreados, fetchRecibidos, usuarioSesion.idPersonal]
    );

    /** Envía una solicitud que estaba en Borrador (backend: cambio-borrador-enviado). */
    const enviarBorrador = useCallback(
        async (doc: DocumentoFirma) => {
            if (!doc.codigoDocumento) throw new Error('El documento no tiene un ID válido para enviar.');
            await firmaDocumentosApi.cambioBorradorEnviado(doc.codigoDocumento, usuarioSesion.idPersonal);
            await fetchCreados();
        },
        [fetchCreados, usuarioSesion.idPersonal]
    );

    const firmarDocumento = useCallback(
        async (
            doc: DocumentoFirma,
            opts: { tipoFirma: TipoFirma; imagenFirma?: File | null; posicion: PosicionFirma; cargoFirmante?: string }
        ) => {
            // `nombreResumido` (no `nombres`): es el nombre corto que se estampa
            // junto a la firma en el PDF; el nombre completo se reserva para el
            // resto de la UI (listados, encabezados, etc.).
            const resultado = await firmaDocumentosApi.firmarSolicitud(doc, usuarioSesion.idPersonal, usuarioSesion.nombreResumido, opts);
            await Promise.all([fetchCreados(), fetchRecibidos()]);
            return resultado;
        },
        [fetchCreados, fetchRecibidos, usuarioSesion.idPersonal, usuarioSesion.nombres]
    );

    /**
     * Rechaza una solicitud (usado por el firmante en turno desde "Documentos
     * Recibidos" / "Firmar documento"). El motivo es obligatorio: es lo que se
     * le muestra al creador (y al resto de firmantes) como razón del rechazo.
     */
    const rechazarDocumento = useCallback(
        async (doc: DocumentoFirma, motivo: string) => {
            if (!motivo?.trim()) throw new Error('Debes indicar el motivo del rechazo.');
            await firmaDocumentosApi.rechazarSolicitud(doc, 'RECHAZAR', motivo.trim());
            await Promise.all([fetchCreados(), fetchRecibidos()]);
        },
        [fetchCreados, fetchRecibidos]
    );

    /**
     * Anula una solicitud (solo el creador, desde "Documentos Creados"). El
     * comentario también es obligatorio: queda como registro de por qué se
     * anuló el proceso de firma.
     */
    const anularDocumento = useCallback(
        async (doc: DocumentoFirma, motivo: string) => {
            if (!motivo?.trim()) throw new Error('Debes indicar el motivo de la anulación.');
            await firmaDocumentosApi.rechazarSolicitud(doc, 'ANULAR', motivo.trim());
            await Promise.all([fetchCreados(), fetchRecibidos()]);
        },
        [fetchCreados, fetchRecibidos]
    );

    return {
        usuarioSesion,
        opcionesFirmante,
        loadingPersonal,
        documentosCreados,
        documentosRecibidos,
        loadingCreados,
        loadingRecibidos,
        tiposDocumento,
        loadingTiposDocumento,
        fetchCreados,
        fetchRecibidos,
        crearDocumento,
        enviarBorrador,
        firmarDocumento,
        rechazarDocumento,
        anularDocumento,
    };
};
