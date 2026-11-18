// Generación de códigos QR 100% cliente para incrustar en el PDF firmado.
// Usa `qrcode` (API headless, sin DOM ni React) en vez de `qrcode.react`
// montado en un nodo desmontado: ese enfoque dependía de esperar un par de
// `requestAnimationFrame` para que React pintara el <canvas> antes de leerlo,
// lo cual podía fallar silenciosamente (solo quedaba un `console.error`) si
// esos frames no llegaban a tiempo, dejando el PDF firmado sin QR sin avisar.
import QRCode from 'qrcode';

const dataUrlABytes = (dataUrl: string): Uint8Array => {
    const base64 = dataUrl.split(',')[1] || '';
    const binario = atob(base64);
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
    return bytes;
};

/** Genera un QR (PNG, cuadrado, fondo blanco) a partir de un texto/URL. */
export const generarQrPngBytes = async (texto: string, size = 300): Promise<Uint8Array> => {
    const dataUrl = await QRCode.toDataURL(texto, {
        width: size,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#FFFFFF' },
    });
    return dataUrlABytes(dataUrl);
};
