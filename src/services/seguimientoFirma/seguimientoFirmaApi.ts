// Cliente real del módulo "Seguimiento Firma", contra `GET /firmas/seguimiento`
// (colección Postman "PDN - Seguimiento Firma - Produccion").
//
// Diferencias clave frente al resto de `firmas/*`:
//   - Usa un token aparte (`token_seguimiento`, capturado en el login — ver
//     `ApiManager.auth.login` / `AuthService.getTokenSeguimiento`), no el
//     token de sesión normal.
//   - No pagina ni filtra en el servidor: siempre trae todos los documentos
//     que el usuario puede auditar (permiso `firmas.SEGUIMIENTO_ACCESO`).
//   - El test de Postman solo confirma la PRESENCIA de estas columnas, no
//     valores de ejemplo, así que `asunto` (mostrado en el mockup que nos
//     pasaron) es una MEJOR SUPOSICIÓN vía `pick()`; si el backend no lo
//     manda, simplemente se muestra vacío.
import { apiManager } from '../api/ApiManager';
import { SeguimientoDocumento } from '../../types/SeguimientoFirma';

const pick = (obj: any, keys: string[]): any => {
    if (!obj) return undefined;
    for (const k of keys) {
        if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
    }
    return undefined;
};

const mapReceptor = (raw: any): string => {
    if (typeof raw === 'string') return raw;
    return pick(raw, ['nombre', 'nombres', 'nombre_completo', 'nombres_completos']) || 'Destinatario';
};

const mapSeguimiento = (raw: any): SeguimientoDocumento => ({
    idDocumento: pick(raw, ['id_documento', 'idDocumento']) || '',
    codigoDocumento: pick(raw, ['codigo_documento', 'codigoDocumento']) || '',
    asunto: pick(raw, ['asunto', 'titulo', 'nombre_documento']),
    fechaCreacion: pick(raw, ['fecha_creacion', 'fechaCreacion']) || new Date().toISOString(),
    emisor: pick(raw, ['emisor']) || 'Desconocido',
    idArea: pick(raw, ['id_area', 'idArea']),
    area: pick(raw, ['area']) || 'Sin área',
    estado: String(pick(raw, ['estado']) ?? ''),
    estadoNombre: pick(raw, ['estado_nombre', 'estadoNombre']) || '',
    receptores: Array.isArray(raw?.receptores) ? raw.receptores.map(mapReceptor) : [],
    idArchivo: pick(raw, ['id_archivo', 'idArchivo']),
    versionArchivo: Number(pick(raw, ['version_archivo', 'versionArchivo'])) || 0,
    urlUltimoDocumento: pick(raw, ['url_ultimo_documento', 'urlUltimoDocumento']) || '',
});

export const seguimientoFirmaApi = {
    /** Trae TODOS los documentos que el usuario logueado puede auditar (sin paginar). */
    async listar(): Promise<SeguimientoDocumento[]> {
        const resp = await apiManager.firmas.seguimiento.listar();
        if (resp?.code === 403) {
            throw new Error('No tienes permiso para acceder al seguimiento de firmas.');
        }
        const filas = Array.isArray(resp?.data) ? resp.data : Array.isArray(resp) ? resp : [];
        return filas.map(mapSeguimiento);
    },
};
