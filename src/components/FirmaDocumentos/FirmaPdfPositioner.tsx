import React, { useEffect, useRef, useState } from "react";
import { PosicionFirma, TipoFirma } from "../../types/FirmaDocumento";
import { obtenerTamanoPagina } from "../../utils/firmaDocumentosPdf";

const ANCHO_DEFECTO_PCT = 24;
const ALTO_DEFECTO_PCT = 7;

type FirmaPreview = {
    tipoFirma: TipoFirma;
    imagenUrl?: string | null;
    nombre: string;
};

type Props = {
    pdfUrl: string;
    pdfBytes?: ArrayBuffer | null;
    posicion: PosicionFirma | null;
    onChange: (pos: PosicionFirma) => void;
    firmaPreview: FirmaPreview;
    /** Cuando es true, solo se muestra el PDF (sin poder colocar/mover la firma). */
    readOnly?: boolean;
};

/** Vista previa de un PDF (primera página) que permite marcar, con doble
 * click, la posición donde se colocará la firma, y luego arrastrarla para
 * ajustarla. Las coordenadas se guardan en porcentaje (0-100) para no
 * depender del tamaño en pantalla. */
const FirmaPdfPositioner: React.FC<Props> = ({ pdfUrl, pdfBytes, posicion, onChange, firmaPreview, readOnly }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [aspectRatio, setAspectRatio] = useState<number>(612 / 792); // carta por defecto
    const dragState = useRef<{ dragging: boolean; offsetXPct: number; offsetYPct: number }>({
        dragging: false,
        offsetXPct: 0,
        offsetYPct: 0,
    });

    useEffect(() => {
        let ignore = false;
        if (!pdfBytes) return;
        obtenerTamanoPagina(pdfBytes, 1)
            .then(({ width, height }) => {
                if (!ignore && width && height) setAspectRatio(width / height);
            })
            .catch(() => {
                /* si falla, se mantiene el aspect ratio por defecto */
            });
        return () => {
            ignore = true;
        };
    }, [pdfBytes]);

    const colocarEn = (clientX: number, clientY: number) => {
        const el = containerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const xPct = ((clientX - rect.left) / rect.width) * 100;
        const yPct = ((clientY - rect.top) / rect.height) * 100;
        const w = ANCHO_DEFECTO_PCT;
        const h = ALTO_DEFECTO_PCT;
        const nueva: PosicionFirma = {
            pagina: 1,
            xPct: clamp(xPct - w / 2, 0, 100 - w),
            yPct: clamp(yPct - h / 2, 0, 100 - h),
            wPct: w,
            hPct: h,
        };
        onChange(nueva);
    };

    const handleDoubleClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
        if (readOnly) return;
        colocarEn(e.clientX, e.clientY);
    };

    const handleStampPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
        if (readOnly || !posicion) return;
        e.stopPropagation();
        const el = containerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const pointerXPct = ((e.clientX - rect.left) / rect.width) * 100;
        const pointerYPct = ((e.clientY - rect.top) / rect.height) * 100;
        dragState.current = {
            dragging: true,
            offsetXPct: pointerXPct - posicion.xPct,
            offsetYPct: pointerYPct - posicion.yPct,
        };
        (e.target as Element).setPointerCapture(e.pointerId);
    };

    const handleStampPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
        if (!dragState.current.dragging || !posicion) return;
        const el = containerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const pointerXPct = ((e.clientX - rect.left) / rect.width) * 100;
        const pointerYPct = ((e.clientY - rect.top) / rect.height) * 100;
        const xPct = clamp(pointerXPct - dragState.current.offsetXPct, 0, 100 - posicion.wPct);
        const yPct = clamp(pointerYPct - dragState.current.offsetYPct, 0, 100 - posicion.hPct);
        onChange({ ...posicion, xPct, yPct });
    };

    const handleStampPointerUp: React.PointerEventHandler<HTMLDivElement> = () => {
        dragState.current.dragging = false;
    };

    return (
        <div className="flex flex-col gap-2">
            {!readOnly && (
                <p className="text-xs font-medium text-blue-600">
                    {/* * Haz doble click sobre el documento para colocar la firma en la posición deseada. Luego puedes
                    arrastrarla para ajustarla. */}
                    Doble clicck para recolocar la firma
                </p>
            )}
            <div
                className="relative w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-100 select-none"
                style={{ aspectRatio: String(aspectRatio) }}
            >
                <object
                    data={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                    type="application/pdf"
                    className="absolute inset-0 h-full w-full pointer-events-none"
                >
                    <div className="flex h-full items-center justify-center p-4 text-center text-sm text-gray-500">
                        Tu navegador no puede previsualizar el PDF aquí. Puedes abrirlo con el botón de descarga.
                    </div>
                </object>
                <div
                    ref={containerRef}
                    className={`absolute inset-0 ${readOnly ? "" : "cursor-crosshair"}`}
                    onDoubleClick={handleDoubleClick}
                >
                    {posicion && (
                        <div
                            onPointerDown={handleStampPointerDown}
                            onPointerMove={handleStampPointerMove}
                            onPointerUp={handleStampPointerUp}
                            className={`absolute flex items-center justify-center rounded border-2 border-blue-600 bg-blue-50/80 shadow-sm ${
                                readOnly ? "" : "cursor-move"
                            }`}
                            style={{
                                left: `${posicion.xPct}%`,
                                top: `${posicion.yPct}%`,
                                width: `${posicion.wPct}%`,
                                height: `${posicion.hPct}%`,
                            }}
                            title={readOnly ? undefined : "Arrastra para reposicionar"}
                        >
                            {firmaPreview.tipoFirma === "imagen" && firmaPreview.imagenUrl ? (
                                <img
                                    src={firmaPreview.imagenUrl}
                                    alt="Firma"
                                    className="h-full w-full object-contain"
                                    draggable={false}
                                />
                            ) : (
                                <span
                                    className="truncate px-1 text-blue-800"
                                    style={{ fontFamily: "cursive", fontSize: "clamp(10px, 2vw, 16px)" }}
                                >
                                    {firmaPreview.nombre}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));

export default FirmaPdfPositioner;
