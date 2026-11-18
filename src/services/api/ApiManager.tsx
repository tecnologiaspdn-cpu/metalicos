import { API_CONFIG } from '../config/apiConfig';
import { ENDPOINTS } from '../config/endpoints';
import { HttpClient } from '../http/HttpClient';
import { AuthService } from '../auth/AuthService';

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'postFormData' | 'postBlob';
class ApiManager {
    private httpClient: HttpClient;
    constructor() {
        this.httpClient = new HttpClient(API_CONFIG.BASE_URL, API_CONFIG.HEADERS);
    }
    // Método genérico para hacer peticiones
    request = async (method: HttpMethod, endpoint: string, data: any = null, options: Record<string, any> = {}) => {
        try {
            return await this.httpClient[method](endpoint, data, options);
        } catch (error) {
            console.error(`Error en petición ${method.toUpperCase()} a ${endpoint}:`, error);
            throw error;
        }
    };

    /**
     * Peticiones del módulo TI/Activos: la colección Postman usa el
     * `token_seguimiento` como Bearer en todas las rutas `/activos/*`.
     */
    requestTI = async (method: 'get' | 'post' | 'put' | 'patch', endpoint: string, data: any = null) => {
        const token = AuthService.getTokenSeguimiento();
        if (!token) throw new Error('No hay token de seguimiento; vuelve a iniciar sesión.');
        const headers = { Authorization: `Bearer ${token}` };
        return method === 'get'
            ? this.httpClient.get(endpoint, { headers })
            : this.httpClient[method](endpoint, data ?? {}, { headers });
    };

    // =============== AUTH ===============
    auth = {
        login: async (credentials: Record<string, any>):
            //Promise<{ token: string; exito: boolean; pagina_inicial: string }> => {
            Promise<{ code: number; message: boolean | string; data: object }> => {
            const response = await this.request('post', ENDPOINTS.AUTH.LOGIN, credentials);
            //console.log("response", response);
            if (response.data.ok) {
                //AuthService.setToken(response.token);
                AuthService.setToken(response.data.usuario.usuario_id);
                AuthService.setCookieLS("menuSideBar", JSON.stringify(response.data.menu));
                AuthService.setCookieLS("usuarioCookie", JSON.stringify(response.data.usuario));
                // Token aparte para "Seguimiento Firma" (GET /firmas/seguimiento),
                // que viene en esta misma respuesta de login.
                if (response.data.token_seguimiento) {
                    AuthService.setTokenSeguimiento(response.data.token_seguimiento);
                }
            } // Simula la estructura de la respuesta
            return {
                //token: response.token,
                code: response.code, // o false según la lógica de tu aplicación 
                message: response.message, // o cualquier otra página inicial 
                data: response.data.usuario
            };
        },
        logout: async () => {
            try {
                await this.request('post', ENDPOINTS.AUTH.LOGOUT);
            } finally {
                AuthService.removeToken();
                AuthService.removeTokenSeguimiento();
            }
        },

        refresh: async () => {
            return this.request('post', ENDPOINTS.AUTH.REFRESH);
        },

        getPermisos: async () => {
            return this.request('get', ENDPOINTS.AUTH.PERMISOS);
        },
        getCredenciales: async (data: any) => {
            return this.request('post', ENDPOINTS.AUTH.CREDENCIALES, data);
        },
        getFoto: async (data: any) => {
            return this.request('post', ENDPOINTS.AUTH.FOTO, data);
        },
    };
    // =============== PERSONAL ===============
    personal = {
        getAll: async (data: any) => {
            return this.request('post', ENDPOINTS.PERSONAL.LIST, data);
        },
        // Estas dos rutas exigen `Authorization: Bearer <token_seguimiento>` (ver colección Postman)
        getByEstado: async (data: any) => {
            return this.requestTI('post', ENDPOINTS.PERSONAL.LISTBYESTADO, data);
        },
        reactivar: async (data: any) => {
            return this.requestTI('post', ENDPOINTS.PERSONAL.REACTIVAR, data);
        },
        getAllByCategoria: async (id_categoria: any) => {
            return this.request('get', ENDPOINTS.PERSONAL.LISTBYCATEGORIA(id_categoria));
        },
        getById: async (id: any) => {
            return this.request('get', ENDPOINTS.PERSONAL.DETAIL(id));
        },
        create: async (personalData: any) => {
            return this.request('post', ENDPOINTS.PERSONAL.CREATE, personalData);
        },
        update: async (personalData: any, id: any) => {
            return this.request('put', ENDPOINTS.PERSONAL.UPDATE(id), personalData);
        },
        update2: async (personalData: any, _id: any) => {
            return this.request('post', ENDPOINTS.PERSONAL.UPDATE2, personalData);
        },
        delete: async (_id: any, data: any) => {
            return this.request('post', ENDPOINTS.PERSONAL.DELETE, data);
        },
        getInfoByQR: async (data: any) => {
            return this.request('post', ENDPOINTS.PERSONAL.INFOBYQR, data);
        },
        insertarDocumento: async (data: any) => {
            //console.log("d",data);
            return this.request('postFormData', ENDPOINTS.PERSONAL.INSERTDOCUMENTO, data);
        },
        insertarDocumentoModal: async (data: any) => {
            return this.request('postFormData', ENDPOINTS.PERSONAL.INSERTDOCUMENTOMODAL, data);
        },
        historialDocumento: async (data: any) => {
            return this.request('post', ENDPOINTS.PERSONAL.HISTORIALDOCUMENTO, data);
        },
        actualizarDocumento: async (data: any) => {
            return this.request('postFormData', ENDPOINTS.PERSONAL.UPDATEDOCUMENTO, data);
        },
        listarDocumentos: async (data: any) => {
            return this.request('post', ENDPOINTS.PERSONAL.LISTDOCUMENTOS, data);
        },
        generarCredencial: async (data: any) => {
            return this.request('post', ENDPOINTS.PERSONAL.GENERARCREDENCIAL, data);
        },
        enviarCredencialesPorCorreo: async (data: any) => {
            return this.request('post', ENDPOINTS.PERSONAL.ENVIARCREDENCIAL, data);
        },
        existeCredenciales: async (data: any) => {
            return this.request('post', ENDPOINTS.PERSONAL.EXISTECREDENCIAL, data);
        },
        resetearCredenciales: async (data: any) => {
            return this.request('post', ENDPOINTS.PERSONAL.RESETCREDENCIAL, data);
        },
        descargarDocumento: async (data: any) => {
            return this.request('postBlob', ENDPOINTS.PERSONAL.DOWNLOADDOCUMENTO, data);
        },
        aprobarDocumento: async (data: any) => {
            return this.request('post', ENDPOINTS.PERSONAL.APROBADOCUMENTO, data);
        },
        reportes: async (data: any) => {
            return this.request('post', ENDPOINTS.PERSONAL.REPORTES, data);
        },
        listaPersonalDocumento: async (data: any) => {
            return this.request('post', ENDPOINTS.PERSONAL.LISTAESTADO, data);
        },
        eliminarDeHistorial: async (data: any) => {
            return this.request('post', ENDPOINTS.PERSONAL.ELIMINARDEHISTORIAL, data);
        }
    };
    // ── Firmas (Mi Firma / rúbrica + Solicitudes de firma) ───────────────
    firmas = {
        tiposDocumento: async () => {
            return this.request('get', ENDPOINTS.FIRMAS.TIPOS_DOCUMENTO);
        },
        rubrica: {
            insertar: async (formData: FormData) => {
                return this.request('postFormData', ENDPOINTS.FIRMAS.RUBRICA.INSERTAR, formData);
            },
            actualizar: async (formData: FormData) => {
                return this.request('postFormData', ENDPOINTS.FIRMAS.RUBRICA.ACTUALIZAR, formData);
            },
            activar: async (id_personal: any) => {
                return this.request('post', ENDPOINTS.FIRMAS.RUBRICA.ACTIVAR(id_personal));
            },
            desactivar: async (id_personal: any) => {
                return this.request('post', ENDPOINTS.FIRMAS.RUBRICA.DESACTIVAR(id_personal));
            },
            consultar: async (id_personal: any) => {
                return this.request('get', ENDPOINTS.FIRMAS.RUBRICA.CONSULTAR(id_personal));
            },
        },
        solicitudes: {
            crear: async (formData: FormData) => {
                return this.request('postFormData', ENDPOINTS.FIRMAS.SOLICITUDES.CREAR, formData);
            },
            firmar: async (formData: FormData) => {
                return this.request('postFormData', ENDPOINTS.FIRMAS.SOLICITUDES.FIRMAR, formData);
            },
            cambioBorradorEnviado: async (data: { id_documento: string; id_personal_creador: any }) => {
                return this.request('post', ENDPOINTS.FIRMAS.SOLICITUDES.CAMBIOBORRADORENVIADO, data);
            },
            recibidos: async (params: { id_personal: any; pagina?: number; tamano?: number; puede_firmar?: boolean }) => {
                return this.request('get', ENDPOINTS.FIRMAS.SOLICITUDES.RECIBIDOS(params));
            },
            generados: async (params: {
                id_personal_creador: any;
                pagina?: number;
                tamano?: number;
                estado?: string;
                tipo_firma?: string;
                buscar?: string;
            }) => {
                return this.request('get', ENDPOINTS.FIRMAS.SOLICITUDES.GENERADOS(params));
            },
            /**
             * Rechaza (firmante en turno) o anula (creador) una solicitud.
             * Igual que `seguimiento.listar`, requiere el `token_seguimiento`
             * en vez del token de sesión normal, así que llama a
             * `httpClient.post` directo con ese header.
             */
            rechazarAnular: async (idDocumento: string, accion: 'RECHAZAR' | 'ANULAR', comentario?: string) => {
                const token = AuthService.getTokenSeguimiento();
                if (!token) throw new Error('No hay token de seguimiento; vuelve a iniciar sesión.');
                return this.httpClient.post(
                    ENDPOINTS.FIRMAS.SOLICITUDES.RECHAZAR_ANULAR(idDocumento),
                    { accion, comentario: comentario || undefined },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            },
            /** Detalle completo de un documento (firmantes con estado/orden individual). Requiere `token_seguimiento`. */
            seguimientoDocumento: async (idDocumento: string) => {
                const token = AuthService.getTokenSeguimiento();
                if (!token) throw new Error('No hay token de seguimiento; vuelve a iniciar sesión.');
                return this.httpClient.get(ENDPOINTS.FIRMAS.SOLICITUDES.SEGUIMIENTO_DOCUMENTO(idDocumento), {
                    headers: { Authorization: `Bearer ${token}` },
                });
            },
        },
        seguimiento: {
            /**
             * Requiere el `token_seguimiento` (capturado en el login, ver
             * `auth.login`) en vez del token de sesión normal, así que llama a
             * `httpClient.get` directo con ese header en vez de pasar por
             * `this.request(...)` (que siempre usa el token de sesión).
             */
            listar: async () => {
                const token = AuthService.getTokenSeguimiento();
                if (!token) throw new Error('No hay token de seguimiento; vuelve a iniciar sesión.');
                return this.httpClient.get(ENDPOINTS.FIRMAS.SEGUIMIENTO, {
                    headers: { Authorization: `Bearer ${token}` },
                });
            },
        },
    };
    sharepoint = {
        /** Devuelve el PDF como binario crudo (no JSON), así que usa `postBlob`. */
        visualizarPdf: async (data: { url: string }) => {
            return this.request('postBlob', ENDPOINTS.SHAREPOINT.VISUALIZAR_PDF, data);
        },
    };
    movimientos = {
        crearMovimiento: async (data: any) => {
            return this.request('post', ENDPOINTS.MOVIMIENTOS.CREATE, data);
        },
        listarMovimientos: async (data: any) => {
            return this.request('post', ENDPOINTS.MOVIMIENTOS.LIST, data);
        },
        detallesMovimiento: async (data: any) => {
            return this.request('post', ENDPOINTS.MOVIMIENTOS.DETAIL, data);
        },
        actualizarAprobacionDetalle: async (data: any) => {
            return this.request('post', ENDPOINTS.MOVIMIENTOS.UPDATEAPROBACIONDETALLE, data);
        },
        actualizarEstadoMovimiento: async (data: any) => {
            return this.request('post', ENDPOINTS.MOVIMIENTOS.UPDATEESTADOMOVIMIENTO, data);
        },
        agregarDetalle: async (data: any) => {
            return this.request('post', ENDPOINTS.MOVIMIENTOS.ADDDETALLE, data);
        },
        eliminarDetalle: async (data: any) => {
            return this.request('post', ENDPOINTS.MOVIMIENTOS.DELETEDETALLE, data);
        }
    };
    maestro = {
        listaEmpresas: async (_data?: any) => {
            return this.request('post', ENDPOINTS.MAESTRO.LISTAEMPRESAS);
        },
        listaAreas: async (_data?: any) => {
            return this.request('post', ENDPOINTS.MAESTRO.LISTAAREAS);
        },
        listaSubAreas: async (_data?: any) => {
            return this.request('post', ENDPOINTS.MAESTRO.LISTASUBAREAS);
        },
        listaPuestos: async (_data?: any) => {
            return this.request('post', ENDPOINTS.MAESTRO.LISTAPUESTOS);
        },
        listaTiposSalidas: async (_data?: any) => {
            return this.request('post', ENDPOINTS.MAESTRO.LISTATIPOSSALIDAS);
        },
        listaTiposEntradas: async (_data?: any) => {
            return this.request('post', ENDPOINTS.MAESTRO.LISTATIPOSENTRADAS);
        },
        listaTipoMovimientos: async (data: any) => {
            return this.request('post', ENDPOINTS.MAESTRO.LISTATIPOMOVIMIENTOS, data);
        },
        listaTipoDocumentos: async (data: any) => {
            return this.request('post', ENDPOINTS.MAESTRO.LISTATIPODOCUMENTOS, data);
        },
        listaTipoPersonal: async (data: any) => {
            return this.request('post', ENDPOINTS.MAESTRO.LISTATIPOPERSONAL, data);
        },
        listaGuardia: async (data: any) => {
            return this.request('post', ENDPOINTS.MAESTRO.LISTAGUARDIA, data);
        },
        listaEstadoCivil: async (data: any) => {
            return this.request('post', ENDPOINTS.MAESTRO.LISTAESTADOCIVIL, data);
        },
        listaSistemaTrabajo: async (data: any) => {
            return this.request('post', ENDPOINTS.MAESTRO.LISTASISTEMATRABAJO, data);
        },
        listaRegimenPensionario: async (data: any) => {
            return this.request('post', ENDPOINTS.MAESTRO.LISTAREGIMENPENSIONARIO, data);
        },
        listaTipoContrato: async (data: any) => {
            return this.request('post', ENDPOINTS.MAESTRO.LISTATIPOCONTRATO, data);
        },
        listaMotivoCese: async (data: any) => {
            return this.request('post', ENDPOINTS.MAESTRO.LISTAMOTIVOCESE, data);
        },
        listaTipoExamenes: async (data: any) => {
            return this.request('post', ENDPOINTS.MAESTRO.LISTATIPOEXAMENES, data);
        },
        listaComunidades: async (data: any) => {
            return this.request('post', ENDPOINTS.MAESTRO.LISTACOMUNIDADES, data);
        },
        listaCaserios: async (data?: any) => {
            return this.request('post', ENDPOINTS.MAESTRO.LISTACASERIOS, data);
        }
    };
    operaciones = {
        listar: async (data: any) => {
            return this.request('post', ENDPOINTS.OPERACIONES.LIST, data);
        },
        listarTipos: async () => {
            return this.request('post', ENDPOINTS.OPERACIONES.TIPOS);
        },
    };
    comunero = {
        getAll: async (data?: any) => {
            return this.request('post', ENDPOINTS.COMUNERO.LIST, data);
        },
        getById: async (id: any) => {
            return this.request('get', ENDPOINTS.COMUNERO.DETAIL(id));
        },
        create: async (comuneroData: any) => {
            return this.request('post', ENDPOINTS.COMUNERO.CREATE, comuneroData);
        },
        createFormData: async (comuneroData: any) => {
            return this.request('postFormData', ENDPOINTS.COMUNERO.CREATE, comuneroData);
        },
        update: async (comuneroData: any, id: any) => {
            return this.request('put', ENDPOINTS.COMUNERO.UPDATE(id), comuneroData);
        },
        update2: async (comuneroData: any, _id?: any) => {
            return this.request('post', ENDPOINTS.COMUNERO.UPDATE2, comuneroData);
        },
        // delete: async (id: any, data: any) => {
        //     return this.request('post', ENDPOINTS.COMUNERO.DELETE, data);
        // },
        delete: async (id: any, data: any) => {
            return this.request('delete', ENDPOINTS.COMUNERO.DELETE(id), data);
        },
        updateFoto: async (comuneroData: any) => {
            return this.request('postFormData', ENDPOINTS.COMUNERO.UPDATEFOTO, comuneroData);
        },
        listarDocumentos: async (data: any) => {
            return this.request('post', ENDPOINTS.COMUNERO.LISTDOCUMENTOS, data);
        },
        insertarDocumento: async (data: any) => {
            return this.request('postFormData', ENDPOINTS.COMUNERO.INSERTDOCUMENTO, data);
        },
        aprobarDocumento: async (data: any) => {
            return this.request('post', ENDPOINTS.COMUNERO.APROBARDOCUMENTO, data);
        },
        descargarDocumento: async (data: any) => {
            return this.request('postBlob', ENDPOINTS.COMUNERO.DESCARGARDOCUMENTO, data);
        },
        imprimirFotocheck: async (data: any) => {
            return this.request('post', ENDPOINTS.COMUNERO.IMPRIMIRFOTOCHECK, data);
        },
        listarParentescos: async () => {
            return this.request('get', ENDPOINTS.COMUNERO.PARENTESCOS);
        },
        listarFamiliares: async (comuneroId: any) => {
            return this.request('get', ENDPOINTS.COMUNERO.FAMILIARES(comuneroId));
        },
        insertarFamiliar: async (comuneroId: any, data: any) => {
            return this.request('post', ENDPOINTS.COMUNERO.FAMILIARES(comuneroId), data);
        },
        actualizarFamiliar: async (comuneroId: any, familiarId: any, data: any) => {
            return this.request('put', ENDPOINTS.COMUNERO.FAMILIAR(comuneroId, familiarId), data);
        },
        eliminarFamiliar: async (comuneroId: any, familiarId: any, data: any) => {
            return this.request('delete', ENDPOINTS.COMUNERO.FAMILIAR(comuneroId, familiarId), data);
        },
    }

}

export const apiManager = new ApiManager();
