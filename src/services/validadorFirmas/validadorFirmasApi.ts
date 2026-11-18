// Cliente del validador público de firmas (landing page sin autenticación,
// enlazada desde el QR de la primera hoja de cada PDF firmado).
//
// GET {{base_url}}api/firmas/validar/<codigo_documento> -> PDF (binario), sin auth.
// Ej.: https://api.polimetalicos.com.pe/api/firmas/validar/9A698BA2E0612D886E2F00ABE63AF0
import { API_CONFIG } from '../config/apiConfig';

const urlValidar = (codigo: string) => `${API_CONFIG.BASE_URL}api/firmas/validar/${encodeURIComponent(codigo)}`;

export const validadorFirmasApi = {
    /** Devuelve el PDF (blob) del documento identificado por su código corto. Sin autenticación. */
    async obtenerPdf(codigo: string): Promise<Blob> {
        const resp = await fetch(urlValidar(codigo));
        if (!resp.ok) throw new Error('No se encontró un documento con ese código.');
        const blob = await resp.blob();
        if (!blob || blob.size === 0) throw new Error('No se encontró un documento con ese código.');
        return blob;
    },
};
