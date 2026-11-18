// Utilidades de "firma" de PDF para el módulo FirmaDocumentos.
// Usa pdf-lib (100% cliente) para:
//   1) Calcular un hash SHA-256 del archivo (para detectar alteraciones).
//   2) Incrustar la imagen/texto de la firma dentro del PDF original y
//      generar el PDF firmado, sin depender todavía del backend real.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { PosicionFirma, TipoFirma } from '../types/FirmaDocumento';

/** Calcula el hash SHA-256 (hex) de un archivo/blob/bytes. Sirve como huella
 * digital del documento: si el PDF cambia un solo byte, el hash cambia. */
export const calcularHashSha256 = async (bytes: ArrayBuffer | Uint8Array): Promise<string> => {
    const buffer = bytes instanceof Uint8Array ? (bytes.buffer as ArrayBuffer) : bytes;
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
};

/**
 * Genera el `codigo_documento` que exige `POST /firmas/solicitudes/crear`:
 * 30 caracteres hexadecimales, generados en el cliente. Se usa para evitar
 * duplicar una misma solicitud si el usuario reintenta el envío; no debe
 * regenerarse en cada reintento de la misma solicitud.
 */
export const generarCodigoDocumentoHex30 = (): string => {
    const random = crypto.getRandomValues(new Uint8Array(15)); // 15 bytes = 30 hex chars
    return Array.from(random).map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
};

/**
 * Devuelve el ancho/alto (en puntos PDF) de una página del documento.
 *
 * Usa el CropBox (no `page.getSize()`, que es el MediaBox) porque los
 * visores de PDF (incluido el `<object>` del navegador) renderizan según el
 * CropBox. Si un PDF trae un CropBox distinto del MediaBox (común en
 * documentos escaneados/generados con márgenes de impresión), calcular los
 * porcentajes de clic contra el MediaBox desalinea la firma respecto a lo
 * que el usuario ve en pantalla.
 */
export const obtenerTamanoPagina = async (pdfBytes: ArrayBuffer | Uint8Array, pagina: number = 1) => {
    const doc = await PDFDocument.load(pdfBytes);
    const page = doc.getPage(Math.min(Math.max(pagina - 1, 0), doc.getPageCount() - 1));
    const { width, height } = page.getCropBox();
    return { width, height, totalPaginas: doc.getPageCount() };
};

/**
 * Igual que `obtenerTamanoPagina`, pero para TODAS las páginas de una sola
 * vez. Se usa para poder cambiar de página en el visor sin volver a cargar
 * el PDF de forma asíncrona cada vez (evita una condición de carrera: si el
 * usuario cambia de página y coloca su firma antes de que esa recarga
 * termine, el recuadro se dibuja con el tamaño de página equivocado).
 */
export const obtenerTamanosDeTodasLasPaginas = async (pdfBytes: ArrayBuffer | Uint8Array) => {
    const doc = await PDFDocument.load(pdfBytes);
    return doc.getPages().map((page) => {
        const { width, height } = page.getCropBox();
        return { width, height };
    });
};

export interface IncrustarFirmaOpts {
    pdfBytes: ArrayBuffer | Uint8Array;
    posicion: PosicionFirma;
    tipoFirma: TipoFirma;
    /** Requerido si tipoFirma === 'imagen' (PNG o JPG). */
    imagenFirmaBytes?: ArrayBuffer | null;
    nombreFirmante: string;
    /** Cargo/puesto del firmante, mostrado debajo del nombre (como en una firma manuscrita con sello). */
    cargoFirmante?: string;
    fechaFirmaISO: string;
    /** Código corto del documento (`codigo_documento`); se muestra en el pie de TODAS las páginas. */
    codigoDocumento: string;
    /**
     * PNG del QR con el link del validador público, se incrusta solo en la
     * ÚLTIMA página (esquina inferior derecha). Si no se pasa, no se dibuja QR.
     */
    qrPngBytes?: Uint8Array | null;
}

export interface IncrustarFirmaResultado {
    bytes: Uint8Array;
    hashFirmado: string;
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));

/** `DD/MM/YYYY HH:mm:ss`, fijo (no depende del locale del navegador). */
const formatearFechaHora = (iso: string): string => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

/** Dibuja la firma (imagen o texto) sobre el PDF original y agrega un pie de
 * verificación. Devuelve los bytes del nuevo PDF y su hash. */
export const incrustarFirmaEnPdf = async (opts: IncrustarFirmaOpts): Promise<IncrustarFirmaResultado> => {
    const { pdfBytes, posicion, tipoFirma, imagenFirmaBytes, nombreFirmante, cargoFirmante, fechaFirmaISO, codigoDocumento, qrPngBytes } = opts;
    const doc = await PDFDocument.load(pdfBytes);
    const pageIndex = Math.min(Math.max(posicion.pagina - 1, 0), doc.getPageCount() - 1);
    const page = doc.getPage(pageIndex);
    // CropBox, no MediaBox: es lo que el navegador (y `obtenerTamanoPagina`)
    // usa como "página visible", que es sobre lo que el usuario hizo clic al
    // colocar la firma. Si difieren (PDF con márgenes de recorte), dibujar
    // sobre el MediaBox corría la firma verticalmente respecto a lo clickeado.
    const caja = page.getCropBox();
    const pageW = caja.width;
    const pageH = caja.height;

    // Las coordenadas llegan en % con origen arriba-izquierda (como el DOM);
    // pdf-lib usa origen abajo-izquierda, por lo que hay que invertir Y. Se
    // suma el origen del CropBox (caja.x/caja.y) porque `drawImage`/`drawText`
    // ubican todo en el espacio absoluto de la página, no relativo al CropBox.
    const boxW = (posicion.wPct / 100) * pageW;
    const boxH = (posicion.hPct / 100) * pageH;
    const boxX = caja.x + (posicion.xPct / 100) * pageW;
    const boxYTop = (posicion.yPct / 100) * pageH;
    const boxY = caja.y + pageH - boxYTop - boxH;
    const boxTop = boxY + boxH;

    const fuenteBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const fuenteRegular = await doc.embedFont(StandardFonts.Helvetica);

    const centrarX = (texto: string, font: typeof fuenteRegular, size: number) => {
        const w = font.widthOfTextAtSize(texto, size);
        return w <= boxW ? boxX + (boxW - w) / 2 : boxX + 2;
    };

    /** Dibuja, apiladas y centradas (pegadas a `yTop`, sin hueco previo), las líneas indicadas. */
    const dibujarBloqueTexto = (
        lineas: Array<{ texto?: string; font: typeof fuenteRegular; color: ReturnType<typeof rgb>; peso: number }>,
        yTop: number,
        altoDisponible: number
    ) => {
        const activas = lineas.filter((l): l is typeof l & { texto: string } => !!l.texto);
        if (activas.length === 0 || altoDisponible <= 0) return;
        const pesoTotal = activas.reduce((acc, l) => acc + l.peso, 0);
        let y = yTop;
        activas.forEach((linea) => {
            const altoLinea = (altoDisponible * linea.peso) / pesoTotal;
            const size = clamp(altoLinea * 0.68, 4, 8.5);
            // Baja solo lo necesario para el baseline (ascent del texto), pegando el renglón a `y`.
            y -= size * 0.82;
            page.drawText(linea.texto, { x: centrarX(linea.texto, linea.font, size), y, size, font: linea.font, color: linea.color });
            y -= altoLinea - size * 0.82;
        });
    };

    if (tipoFirma === 'imagen' && imagenFirmaBytes) {
        let img;
        try {
            img = await doc.embedPng(imagenFirmaBytes);
        } catch {
            img = await doc.embedJpg(imagenFirmaBytes);
        }
        // La imagen ocupa la parte superior del recuadro (más chica que su slot,
        // centrada); debajo va una línea pegada al nombre / cargo / fecha.
        const fracImagen = 0.68;
        const imgEscala = 0.8;
        const slotH = boxH * fracImagen;
        const imgW = boxW * imgEscala;
        const imgH = slotH * imgEscala;
        page.drawImage(img, { x: boxX + (boxW - imgW) / 2, y: boxTop - slotH + (slotH - imgH) / 2, width: imgW, height: imgH });

        const margenLinea = Math.max(1, boxH * 0.008);
        const lineaY = boxTop - slotH - margenLinea;
        page.drawLine({
            start: { x: boxX + boxW * 0.08, y: lineaY },
            end: { x: boxX + boxW * 0.92, y: lineaY },
            thickness: Math.max(0.5, boxH * 0.006),
            color: rgb(0.25, 0.25, 0.25),
        });

        dibujarBloqueTexto(
            [
                { texto: nombreFirmante, font: fuenteBold, color: rgb(0.1, 0.1, 0.1), peso: 1.15 },
                { texto: cargoFirmante, font: fuenteRegular, color: rgb(0.3, 0.3, 0.3), peso: 1 },
                { texto: formatearFechaHora(fechaFirmaISO), font: fuenteRegular, color: rgb(0.45, 0.45, 0.45), peso: 0.85 },
            ],
            lineaY - margenLinea,
            lineaY - margenLinea - boxY
        );
    } else {
        const cursiva = await doc.embedFont(StandardFonts.HelveticaOblique);
        page.drawRectangle({
            x: boxX,
            y: boxY,
            width: boxW,
            height: boxH,
            borderColor: rgb(0.15, 0.39, 0.92),
            borderWidth: 1,
            color: rgb(0.93, 0.96, 1),
            opacity: 0.6,
        });
        // "Firma" manuscrita simulada con el nombre en cursiva, ocupando la
        // parte superior del recuadro; cargo/fecha debajo, igual que en modo imagen.
        const altoNombre = boxH * 0.42;
        const nombreSize = clamp(altoNombre * 0.62, 7, 13);
        page.drawText(nombreFirmante, {
            x: centrarX(nombreFirmante, cursiva, nombreSize),
            y: boxTop - altoNombre * 0.72,
            size: nombreSize,
            font: cursiva,
            color: rgb(0.1, 0.2, 0.5),
        });
        dibujarBloqueTexto(
            [
                { texto: cargoFirmante, font: fuenteRegular, color: rgb(0.3, 0.3, 0.3), peso: 1 },
                { texto: formatearFechaHora(fechaFirmaISO), font: fuenteRegular, color: rgb(0.45, 0.45, 0.45), peso: 0.85 },
            ],
            boxTop - altoNombre,
            boxH - altoNombre
        );
    }

    // Pie de página, genérico (sin nombres de firmantes) en TODAS las hojas.
    // Como el texto es siempre el mismo para un documento dado, redibujarlo
    // en cada firma sucesiva ("Firma varios") no genera superposición: cae
    // exactamente sobre el mismo texto ya existente.
    const helv = await doc.embedFont(StandardFonts.Helvetica);
    const leyenda = `Firmado electrónicamente · Documento: ${codigoDocumento}`;
    doc.getPages().forEach((p) => {
        const cajaPagina = p.getCropBox();
        const anchoLeyenda = helv.widthOfTextAtSize(leyenda, 8);
        p.drawText(leyenda, {
            x: cajaPagina.x + (cajaPagina.width - anchoLeyenda) / 2,
            y: cajaPagina.y + 14,
            size: 8,
            font: helv,
            color: rgb(0.45, 0.45, 0.45),
        });
    });

    // QR con el link del validador público, solo en la ÚLTIMA hoja, esquina
    // inferior derecha (en un documento de varias páginas no tiene sentido
    // repetirlo en cada una, y la última es donde suele quedar el cierre/
    // las firmas finales).
    if (qrPngBytes && qrPngBytes.length) {
        const qrImg = await doc.embedPng(qrPngBytes);
        const ultima = doc.getPage(doc.getPageCount() - 1);
        const cajaUltima = ultima.getCropBox();
        const qrTam = Math.max(48, Math.min(cajaUltima.width, cajaUltima.height) * 0.12);
        const margenQr = 18;
        ultima.drawImage(qrImg, {
            x: cajaUltima.x + cajaUltima.width - qrTam - margenQr,
            y: cajaUltima.y + margenQr + 10, // un poco por encima del pie de página
            width: qrTam,
            height: qrTam,
        });
    }

    const bytes = await doc.save();
    const hashFirmado = await calcularHashSha256(bytes);
    return { bytes, hashFirmado };
};
