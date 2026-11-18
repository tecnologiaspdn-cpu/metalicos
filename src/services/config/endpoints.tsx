export const ENDPOINTS = {
    AUTH: {
        LOGIN: 'auth/login',
        REFRESH: 'auth/refresh',
        LOGOUT: 'auth/logout',
        PERMISOS: 'permisos/getPermisos',
        CREDENCIALES: 'personal/trabajadores/imprimir-fotocheck',
        FOTO: 'personal/trabajadores/descargar-foto',
    },
    USUARIOS: {
        LIST: '/users/getUsers',
        LISTBYTIPO: (id: any) => `/users/getUsersByTipo/${id}`,
        LISTBYTIPOANDSUCURSAL: (id: any) => `/users/getUsersByTipoAndSucursal/${id}`,
        COMPLETELIST: '/users/getUsersComplete',
        DETAIL: (id: any) => `/users/getUsuariosById/${id}`,
        CREATE: '/users/createUser',
        UPDATE: (id: any) => `/users/updateUser/${id}`,
        UPDATE2: `/users/updateUser/`,
        DELETE: (id: any) => `/users/deleteUser/${id}`,
    },
    PERSONAL: {
        LIST: 'personal/trabajadores',
        LISTBYESTADO: 'personal/trabajadores/por-estado',
        REACTIVAR: 'personal/trabajadores/reactivar',
        LISTDOCUMENTOS: 'documentacion-personal/list-documentos',
        GENERARCREDENCIAL: 'documentacion-personal/generar-credencial',
        ENVIARCREDENCIAL: 'enviar-correo/credencial',
        EXISTECREDENCIAL: 'personal/trabajadores/consultar-credencial-activo',
        RESETCREDENCIAL: 'documentacion-personal/resetear-credencial',
        INSERTDOCUMENTO: 'documentacion-personal/insertar',
        INSERTDOCUMENTOMODAL: 'documentacion-personal/insertar-modal',
        UPDATEDOCUMENTO: 'documentacion-personal/actualizar',
        DOWNLOADDOCUMENTO: 'documentacion-personal/descargar-documento',
        HISTORIALDOCUMENTO: 'documentacion-personal/list-documentos-historial',
        LISTBYCATEGORIA: (id_categoria: any) => `personal/getPersonalByIdCategoria/${id_categoria}`,
        DETAIL: (id: any) => `personal/getPersonalById/${id}`,
        CREATE: 'personal/trabajadores/insertar',
        UPDATE: (id: any) => `personal/updateFamilia/${id}`,
        UPDATE2: `personal/trabajadores/actualizar`,
        DELETE: `personal/trabajadores/cese-personal`,
        INFOBYQR: `movimiento-personal/personal-qr`,
        APROBADOCUMENTO: `documentacion-personal/aprobar-documento`,
        REPORTES: 'documentacion-personal/reporte-doc-personal',
        LISTAESTADO: 'documentacion-personal/list-personal-documento',
        ELIMINARDEHISTORIAL: `documentacion-personal/eliminar-documento`,
    },
    // ── Firmas (Mi Firma / rúbrica + Solicitudes de firma) ───────────────
    // Rutas confirmadas contra las colecciones Postman "PDN - Solicitudes de
    // firma" y "PDN - Firmas publicadas - Producción" (2026-09-24).
    FIRMAS: {
        // Catálogo del desplegable "Tipo de documento" en "Nuevo Documento"
        // (solo TIPO_DOC=FIRMAS, ESTADO=1 del lado del backend).
        TIPOS_DOCUMENTO: 'firmas/tipos-documento',
        RUBRICA: {
            INSERTAR: 'firmas/rubrica/insertar', // postFormData: { id_personal, file }
            ACTUALIZAR: 'firmas/rubrica/actualizar', // postFormData: { id_personal, file }
            ACTIVAR: (id_personal: any) => `firmas/rubrica/activar?id_personal=${id_personal}`,
            DESACTIVAR: (id_personal: any) => `firmas/rubrica/desactivar?id_personal=${id_personal}`,
            CONSULTAR: (id_personal: any) => `firmas/rubrica/consultar?id_personal=${id_personal}`,
        },
        SOLICITUDES: {
            CREAR: 'firmas/solicitudes/crear', // postFormData: { file, datos(json) }
            FIRMAR: 'firmas/solicitudes/firmar', // postFormData: { file, datos(json) }
            CAMBIOBORRADORENVIADO: 'firmas/solicitudes/cambio-borrador-enviado', // post json
            RECIBIDOS: (params: { id_personal: any; pagina?: number; tamano?: number; puede_firmar?: boolean }) => {
                const qs = new URLSearchParams();
                qs.set('id_personal', String(params.id_personal));
                qs.set('pagina', String(params.pagina ?? 1));
                qs.set('tamano', String(params.tamano ?? 10));
                if (params.puede_firmar !== undefined) qs.set('puede_firmar', String(params.puede_firmar));
                return `firmas/solicitudes/recibidos?${qs.toString()}`;
            },
            GENERADOS: (params: {
                id_personal_creador: any;
                pagina?: number;
                tamano?: number;
                estado?: string;
                tipo_firma?: string;
                buscar?: string;
            }) => {
                const qs = new URLSearchParams();
                qs.set('id_personal_creador', String(params.id_personal_creador));
                qs.set('pagina', String(params.pagina ?? 1));
                qs.set('tamano', String(params.tamano ?? 10));
                if (params.estado) qs.set('estado', params.estado);
                if (params.tipo_firma) qs.set('tipo_firma', params.tipo_firma);
                if (params.buscar) qs.set('buscar', params.buscar);
                return `firmas/solicitudes/generados?${qs.toString()}`;
            },
            // Requiere el `token_seguimiento` (no el token de sesión normal),
            // ver colección Postman "PDN - Rechazar o anular documento".
            RECHAZAR_ANULAR: (idDocumento: any) => `firmas/solicitudes/${idDocumento}/rechazar-anular`,
            // Detalle completo de UN documento (firmantes con su estado/orden
            // individual). A diferencia de `firmas/seguimiento` (que solo trae
            // nombres de receptores), este sí puede consultarlo un fiscalizador
            // autorizado, no solo el creador/participante. Requiere
            // `token_seguimiento`. Ver colección "PDN - Modalidad y tipo de
            // documento - produccion".
            SEGUIMIENTO_DOCUMENTO: (idDocumento: any) => `firmas/solicitudes/${idDocumento}/seguimiento`,
        },
        // API separada (colección "PDN - Seguimiento Firma"), sin paginación:
        // requiere el `token_seguimiento` (no el token de sesión normal) y el
        // permiso `firmas.SEGUIMIENTO_ACCESO` del lado del backend.
        SEGUIMIENTO: 'firmas/seguimiento',
    },
    SHAREPOINT: {
        VISUALIZAR_PDF: 'api/sharepoint/visualizar-pdf', // post json: { url }
    },
    COMUNERO: {
        LIST: 'comunidad/comuneros',
        DETAIL: (id: any) => `personal/getComunerosById/${id}`,
        CREATE: 'comunidad/insertar-comunero',
        UPDATE: (_id: any) => `comunidad/comunero/actualizar`,
        UPDATE2: `comunidad/comunero/actualizar`,
        //DELETE: `comunidad/comunero/cese-comuneros`,
        DELETE: (id: any) => `comunidad/comunero/${id}`,
        UPDATEFOTO: `comunidad/comunero/actualizar-foto`,
        LISTDOCUMENTOS: 'comunidad/list-documentos-comunero',
        INSERTDOCUMENTO: 'comunidad/insertar-documento-comunero',
        APROBARDOCUMENTO: 'comunidad/aprobar-documento-comunero',
        DESCARGARDOCUMENTO: 'comunidad/descargar-documento-comunero',
        IMPRIMIRFOTOCHECK: 'comunidad/imprimir-fotocheck-comunero',
        PARENTESCOS: 'comunidad/parentescos',
        FAMILIARES: (comuneroId: any) => `comunidad/comunero/${comuneroId}/familiares`,
        FAMILIAR: (comuneroId: any, familiarId: any) => `comunidad/comunero/${comuneroId}/familiares/${familiarId}`,
    },
    // ── Comedor (colección Postman "PDN - Comedor - Produccion") ─────────
    // Catálogos con borrado lógico: PATCH `{base}/{id}/estado` con { estado: 0|1, version, usuario }.
    // ── Laboratorio Químico (colección Postman "PDN Laboratorio Quimico - produccion"; Bearer token_seguimiento) ──
    LABQUIMICO: {
        TIPOS_MUESTRA: 'labquimico/catalogos/tipos-muestra',
        TIPOS_ANALISIS: 'labquimico/catalogos/tipos-analisis',
        SOLICITUDES: 'labquimico/solicitudes',
        SOLICITUD: (id: any) => `labquimico/solicitudes/${id}`,
        SOLICITUD_PDF: (id: any) => `labquimico/solicitudes/${id}/pdf`,
        ENVIAR_FIRMA: (id: any) => `labquimico/solicitudes/${id}/enviar-firma`,
        ENVIAR_DIRECTO: (id: any) => `labquimico/solicitudes/${id}/enviar-directo`,
        ANULAR: (id: any) => `labquimico/solicitudes/${id}/anular`,
        RECEPCION: (id: any) => `labquimico/solicitudes/${id}/recepcion`,
        RECEPCION_PDF: (id: any) => `labquimico/solicitudes/${id}/recepcion/pdf`,
    },
    COMEDOR: {
        TIPO_SERVICIOS: 'comedor/tipo-servicios',
        PUNTOS: 'comedor/puntos',
        HORARIOS: 'comedor/horarios',
        TARIFAS: 'comedor/tarifas',
        INVITADOS: 'comedor/invitados',
        IDENTIFICAR: 'comedor/comensales/identificar',
        CONSUMOS: 'comedor/consumos',
        REIMPRIMIR: (idConsumo: any) => `comedor/consumos/${idConsumo}/reimprimir`,
        ESTADO_IMPRESION: (idImpresion: any) => `comedor/impresiones/${idImpresion}/estado`,
        REPORTE_CONSUMOS: 'comedor/reportes/consumos',
        EXTRAS: 'comedor/extras',
        EXTRA: (id: any) => `comedor/extras/${id}`,
        EXTRA_ATENDER: (id: any) => `comedor/extras/${id}/atender`,
        EXTRA_ANULAR: (id: any) => `comedor/extras/${id}/anular`,
        REPORTE_VALORIZACION: 'comedor/reportes/valorizacion',
        REPORTE_VALORIZACION_MENSUAL: 'comedor/reportes/valorizacion-mensual',
        DIETAS: 'comedor/dietas',
        DIETAS_PERSONAL: 'comedor/dietas/personal',
        DIETA: (id: any) => `comedor/dietas/${id}`,
        DIETA_ESTADO: (id: any) => `comedor/dietas/${id}/estado`,
    },
    // ── TI / Activos (colección Postman "PDN - Activos TI - produccion") ──
    ACTIVOS: {
        BASE: 'activos',
        TIPOS: 'activos/tipos',
        ESTADO: (id: any) => `activos/${id}/estado`,
        HISTORIAL: (id: any) => `activos/${id}/historial`,
        PERSONAL: 'activos/personal',
        PERSONAL_EQUIPOS: (idPersonal: any) => `activos/personal/${idPersonal}/equipos`,
        TRANSFERENCIAS: 'activos/transferencias',
        TRANSFERENCIA: (id: any) => `activos/transferencias/${id}`,
        ENVIAR_CODIGO: (id: any) => `activos/transferencias/${id}/enviar-codigo`,
        CONFIRMAR: (id: any) => `activos/transferencias/${id}/confirmar`,
        CANCELAR: (id: any) => `activos/transferencias/${id}/cancelar`,
        ACTA_IMPRIMIR: (idActa: any) => `activos/actas/${idActa}/imprimir`,
    },
    BALANZA: {
        BASE: (emp: any) => `comercializacion/balanza/empresas/${emp}`,
    },
    MOVIMIENTOS: {
        CREATE: 'movimiento-personal/insertar',
        LIST: 'movimiento-personal/list',
        DETAIL: `movimiento-personal/list-detalles`,
        UPDATEAPROBACIONDETALLE: `movimiento-personal/aprob-det`,
        UPDATEESTADOMOVIMIENTO: `movimiento-personal/estado-cab`,
        ADDDETALLE: `movimiento-personal/insertar-det`,
        DELETEDETALLE: `movimiento-personal/eliminar-det`,
    },
    OPERACIONES: {
        LIST: 'operaciones/listar-operacion-web',
        TIPOS: 'operaciones/listar-tipo-operacion',
    },
    MAESTRO: {
        LISTAEMPRESAS: 'maestro/list-empresa',
        LISTAAREAS: 'maestro/list-area',
        LISTASUBAREAS: 'maestro/list-subarea',
        LISTAPUESTOS: 'maestro/list-puesto',
        LISTATIPOSSALIDAS: 'maestro/list-tipo-salida',
        LISTATIPOSENTRADAS: 'maestro/list-tipo-entrada',
        LISTATIPOMOVIMIENTOS: 'maestro/list-tipo-mov',
        LISTATIPODOCUMENTOS: 'maestro/list-tipo-doc',
        LISTATIPOPERSONAL: 'general/list-tabla-general',
        LISTAMOTIVOCESE: 'general/list-tabla-general',
        LISTATIPOCONTRATO: 'general/list-tabla-general',
        LISTAGUARDIA: 'general/list-tabla-general',
        LISTAESTADOCIVIL: 'general/list-tabla-general',
        LISTASISTEMATRABAJO: 'general/list-tabla-general',
        LISTAREGIMENPENSIONARIO: 'general/list-tabla-general',
        LISTATIPOEXAMENES: 'general/list-tabla-general',
        LISTACOMUNIDADES: 'comunidad/comunidades',
        LISTACASERIOS: 'comunidad/caserios',
    }

};