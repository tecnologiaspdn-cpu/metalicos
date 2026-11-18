// Cliente real del módulo "Mi Firma" (rúbrica), contra
// `firmas/rubrica/{insertar,actualizar,activar,desactivar,consultar}`
// (colección Postman "PDN - Firmas publicadas - Producción").
//
// Respuesta real de `consultar`:
// { code, message, data: { id_rubrica, id_personal, archivo_rubrica, estado, fecha_registro, fecha_modificacion } }
import { apiManager } from '../api/ApiManager';
import { EstadoRubrica, GuardarRubricaPayload, Rubrica } from '../../types/MiFirma';

export interface UsuarioRubrica {
    id: number;
    nombres: string;
}

const pick = (obj: any, keys: string[]): any => {
    if (!obj) return undefined;
    for (const k of keys) {
        if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
    }
    return undefined;
};

const inferirMimeType = (url: string): string => {
    const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
    return ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
};

/**
 * `archivo_rubrica` es un link de SharePoint, no una URL de imagen directa;
 * hay que descargarla como base64 vía `personal/trabajadores/descargar-foto`
 * (mismo endpoint que usan Credenciales/Comuneros/OperacionesPlanta) para
 * poder mostrarla en un <img>.
 */
const descargarImagenBase64 = async (url: string): Promise<string | null> => {
    try {
        const resp = await apiManager.auth.getFoto({ fotoUrl: url });
        const base64 = resp?.value?.foto_base64;
        if (!base64) return null;
        return `data:${inferirMimeType(url)};base64,${base64}`;
    } catch (e) {
        console.error('No se pudo descargar la imagen de la rúbrica.', e);
        return null;
    }
};

const mapRubrica = (raw: any, usuario: UsuarioRubrica): Rubrica | null => {
    const imagenUrl = pick(raw, ['archivo_rubrica', 'url_rubrica', 'url_imagen', 'imagen_url', 'url']);
    if (!raw || !imagenUrl) return null;

    const estadoRaw = pick(raw, ['estado']);
    const estado: EstadoRubrica =
        typeof estadoRaw === 'boolean'
            ? (estadoRaw ? 'Activo' : 'Desactivado')
            : ['1', 'ACTIVO', 'ACTIVA', 'TRUE'].includes(String(estadoRaw ?? '').trim().toUpperCase())
                ? 'Activo'
                : 'Desactivado';

    let nombreArchivo = pick(raw, ['nombre_archivo', 'archivo']);
    if (!nombreArchivo) {
        try {
            nombreArchivo = decodeURIComponent(imagenUrl.split('/').pop() || '');
        } catch {
            nombreArchivo = imagenUrl.split('/').pop();
        }
    }

    return {
        id: Number(pick(raw, ['id_rubrica', 'id'])) || usuario.id,
        usuarioId: usuario.id,
        usuarioNombres: usuario.nombres,
        imagenUrl,
        nombreArchivo: nombreArchivo || 'rubrica.png',
        estado,
        fechaActualizacion: pick(raw, ['fecha_modificacion', 'fecha_registro', 'fecha_actualizacion', 'updated_at']) || new Date().toISOString(),
    };
};

export const miFirmaApi = {
    /** Devuelve la rúbrica guardada del usuario, o `null` si aún no configuró ninguna. */
    async obtenerRubrica(usuario: UsuarioRubrica): Promise<Rubrica | null> {
        const resp = await apiManager.firmas.rubrica.consultar(usuario.id);
        if (resp?.code && resp.code !== 200) return null;
        const rubrica = mapRubrica(resp?.data, usuario);
        if (!rubrica) return null;

        const imagenBase64 = await descargarImagenBase64(rubrica.imagenUrl);
        return { ...rubrica, imagenUrl: imagenBase64 ?? rubrica.imagenUrl };
    },

    /**
     * Crea o actualiza la rúbrica del usuario. Si viene una imagen nueva, se
     * sube con `insertar` (primera vez) o `actualizar` (ya existía). El estado
     * (Activo/Desactivado) se aplica siempre con su propio endpoint.
     */
    async guardarRubrica(usuario: UsuarioRubrica, payload: GuardarRubricaPayload, existeRubrica: boolean): Promise<Rubrica> {
        if (payload.imagen) {
            const fd = new FormData();
            fd.append('id_personal', String(usuario.id));
            fd.append('file', payload.imagen, payload.imagen.name);
            const resp = existeRubrica
                ? await apiManager.firmas.rubrica.actualizar(fd)
                : await apiManager.firmas.rubrica.insertar(fd);
            if (resp?.code && resp.code !== 200 && resp.code !== 201) {
                throw new Error(resp?.message || 'No se pudo guardar la imagen de la rúbrica.');
            }
        } else if (!existeRubrica) {
            throw new Error('Debes seleccionar una imagen para tu rúbrica.');
        }

        const respEstado =
            payload.estado === 'Activo'
                ? await apiManager.firmas.rubrica.activar(usuario.id)
                : await apiManager.firmas.rubrica.desactivar(usuario.id);
        if (respEstado?.code && respEstado.code !== 200) {
            throw new Error(respEstado?.message || 'No se pudo actualizar el estado de la rúbrica.');
        }

        const actualizada = await miFirmaApi.obtenerRubrica(usuario);
        if (!actualizada) throw new Error('No se pudo confirmar el guardado de la rúbrica.');
        return actualizada;
    },
};
