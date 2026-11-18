// Tipos para el módulo "Mi Firma" (Configuración de Rúbrica).
// El backend real está en src/services/miFirma/miFirmaApi.ts
// (endpoints `firmas/rubrica/*`).

export type EstadoRubrica = 'Activo' | 'Desactivado';

export interface Rubrica {
    id: number;
    usuarioId: number;
    usuarioNombres: string;
    /** URL pública (o data URL en el mock) de la imagen de la rúbrica. */
    imagenUrl: string;
    nombreArchivo: string;
    estado: EstadoRubrica;
    /** ISO. Última vez que se guardó/actualizó la rúbrica. */
    fechaActualizacion: string;
}

/** Datos que envía el formulario al guardar. */
export interface GuardarRubricaPayload {
    /**
     * Nueva imagen a subir. Si es `null` se conserva la imagen actual y solo
     * se actualiza el estado (útil para activar/desactivar sin recargar el archivo).
     */
    imagen: File | null;
    estado: EstadoRubrica;
}

/** MIME types aceptados para la imagen de la rúbrica. */
export const RUBRICA_MIME_PERMITIDOS = ['image/png', 'image/jpeg'];
export const RUBRICA_ACCEPT = 'image/png,image/jpeg,.png,.jpg,.jpeg';
export const RUBRICA_TAMANO_MAXIMO_MB = 2;
export const RUBRICA_TAMANO_MAXIMO_BYTES = RUBRICA_TAMANO_MAXIMO_MB * 1024 * 1024;

/** Valida un archivo antes de subirlo. Devuelve un mensaje de error o `null`. */
export const validarArchivoRubrica = (file: File): string | null => {
    const tipoOk =
        RUBRICA_MIME_PERMITIDOS.includes(file.type) ||
        /\.(png|jpe?g)$/i.test(file.name);
    if (!tipoOk) return 'Formato no permitido. Usa PNG, JPG o JPEG.';
    if (file.size > RUBRICA_TAMANO_MAXIMO_BYTES) {
        return `La imagen supera el tamaño máximo de ${RUBRICA_TAMANO_MAXIMO_MB} MB.`;
    }
    return null;
};
