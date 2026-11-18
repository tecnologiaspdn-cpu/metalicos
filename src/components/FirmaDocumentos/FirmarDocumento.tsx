import React, { useEffect, useMemo, useRef, useState } from "react";
import notify from "devextreme/ui/notify";
import moment from "moment";
import { useNavigate } from "react-router-dom";
import { DocumentoFirma, PosicionFirma, TipoFirma } from "../../types/FirmaDocumento";
import { obtenerTamanosDeTodasLasPaginas } from "../../utils/firmaDocumentosPdf";
import { descargarPdfBytes } from "../../services/firmaDocumentos/firmaDocumentosApi";
import { useMiFirma } from "../../hooks/useMiFirma";

type Props = {
    doc: DocumentoFirma;
    onVolver: () => void;
    onFirmar: (
        doc: DocumentoFirma,
        opts: { tipoFirma: TipoFirma; imagenFirma?: File | null; posicion: PosicionFirma; cargoFirmante?: string }
    ) => Promise<any>;
    /** Si se pasa, muestra el botón "Rechazar firma" (motivo obligatorio). */
    onRechazar?: (doc: DocumentoFirma, motivo: string) => Promise<any>;
};

const ZOOMS = [50, 75, 100, 125, 150, 200];
const TAMANO_MIN = 12;
const TAMANO_MAX = 40;
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));

const dataUrlToFile = async (dataUrl: string, name = "rubrica.png"): Promise<File> => {
    const blob = await (await fetch(dataUrl)).blob();
    return new File([blob], name, { type: blob.type || "image/png" });
};

const InfoItem: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
        <p className="truncate text-sm text-gray-700">{children}</p>
    </div>
);

const ToolbarBtn: React.FC<{ icon: string; title: string; onClick: () => void; disabled?: boolean }> = ({
    icon,
    title,
    onClick,
    disabled,
}) => (
    <button
        type="button"
        title={title}
        onClick={onClick}
        disabled={disabled}
        className="flex h-8 w-8 items-center justify-center rounded text-gray-200 hover:bg-white/10 disabled:opacity-30"
    >
        <i className={`dx-icon-${icon}`} />
    </button>
);

/**
 * Pantalla "Firmar documento": visor del PDF con miniaturas, zoom y rotación, y
 * un panel lateral donde el usuario coloca (clic + arrastrar) su rúbrica y firma.
 * Es una vista normal (no un modal); se abre desde "Documentos Recibidos" /
 * "Documentos Creados".
 */
const FirmarDocumento: React.FC<Props> = ({ doc, onVolver, onFirmar, onRechazar }) => {
    const navigate = useNavigate();
    const { rubrica, usuarioSesion, cargo } = useMiFirma();

    const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | Uint8Array | null>(null);
    // El PDF vive en SharePoint (no accesible directo desde el navegador); una
    // vez descargado vía el proxy del backend, lo servimos como blob URL.
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    // Ancho/alto (en puntos) de CADA página, cargados de una sola vez. Antes
    // se recalculaba el de la página actual de forma asíncrona cada vez que
    // el usuario cambiaba de página, lo que dejaba una ventana (condición de
    // carrera) donde, si colocaba/arrastraba la firma justo después de
    // cambiar de página pero antes de que esa carga terminara, el recuadro
    // se posicionaba con el tamaño de la página anterior.
    const [paginasTam, setPaginasTam] = useState<Array<{ width: number; height: number }>>([]);
    const [numPaginas, setNumPaginas] = useState(1);
    const [pagina, setPagina] = useState(1);
    const [zoom, setZoom] = useState(100);
    const [rotacion, setRotacion] = useState(0);

    const [tamano, setTamano] = useState(24); // wPct de la rúbrica
    const [rubricaAspect, setRubricaAspect] = useState(3.5);
    const [colocacion, setColocacion] = useState<PosicionFirma | null>(null);
    const [firmando, setFirmando] = useState(false);

    const [mostrarRechazo, setMostrarRechazo] = useState(false);
    const [motivo, setMotivo] = useState("");
    const [rechazandoBusy, setRechazandoBusy] = useState(false);

    const visorRef = useRef<HTMLDivElement>(null);
    const dragState = useRef({ dragging: false, offX: 0, offY: 0 });

    // Nombre resumido (no el completo): es el mismo texto que se termina
    // estampando en el PDF al firmar (ver useFirmaDocumentos.firmarDocumento),
    // así que la vista previa debe coincidir con el resultado final.
    const nombreRubrica = usuarioSesion.nombreResumido;
    const rubricaActiva = !rubrica || rubrica.estado === "Activo";
    // `puedeFirmar` viene de /firmas/solicitudes/recibidos (turno, vencimiento, etc.).
    // Si el backend no lo informa (p. ej. al abrir desde "Documentos Creados"), se permite intentar.
    const bloqueado = doc.puedeFirmar === false;

    useEffect(() => {
        let ignore = false;
        let urlCreado: string | null = null;
        setPdfBytes(null);
        setPdfUrl(null);
        setColocacion(null);
        setPagina(1);
        setZoom(100);
        setRotacion(0);
        setPaginasTam([]);
        (async () => {
            try {
                const bytes = await descargarPdfBytes(doc.pdfOriginalUrl);
                if (ignore) return;
                setPdfBytes(bytes);
                urlCreado = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
                setPdfUrl(urlCreado);
                const tamanos = await obtenerTamanosDeTodasLasPaginas(bytes);
                if (ignore) return;
                setPaginasTam(tamanos);
                setNumPaginas(tamanos.length || 1);
            } catch {
                if (!ignore) notify("No se pudo cargar el documento.", "error", 3500);
            }
        })();
        return () => {
            ignore = true;
            if (urlCreado) URL.revokeObjectURL(urlCreado);
        };
    }, [doc]);

    // Ancho/alto de la página actual: ya están precargados (ver arriba), así
    // que cambiar de página no dispara ninguna carga asíncrona ni deja
    // ventanas donde el recuadro de colocación use el tamaño equivocado.
    const tamPaginaActual = paginasTam[pagina - 1];
    const ratio = tamPaginaActual && tamPaginaActual.width && tamPaginaActual.height ? tamPaginaActual.width / tamPaginaActual.height : 612 / 792;

    useEffect(() => {
        if (!rubrica?.imagenUrl) {
            setRubricaAspect(3.5);
            return;
        }
        const img = new Image();
        img.onload = () => setRubricaAspect(img.naturalWidth / img.naturalHeight || 3.5);
        img.src = rubrica.imagenUrl;
    }, [rubrica?.imagenUrl]);

    // La rúbrica ocupa esta fracción vertical del recuadro; el resto queda para
    // nombre/cargo/fecha debajo (debe coincidir con firmaDocumentosPdf.ts).
    const FRAC_IMAGEN_RUBRICA = 0.68;
    // Tope real del alto del sello: con rúbricas de aspecto angosto/cuadrado
    // (p. ej. un garabato de prueba) la fórmula podía disparar hPct a 50-60%
    // de la página; al colocarlo cerca del borde inferior, el clamp de
    // `colocarEn`/`onStampMove` (que nunca deja que el sello se salga de la
    // página) empujaba el sello hacia arriba SIEMPRE al mismo tope, así que
    // dos firmantes distintos terminaban "encimados" en el mismo lugar en vez
    // de en donde cada uno hizo clic. Limitar el alto a un máximo razonable
    // evita ese choque.
    const hFromW = (w: number) => clamp((w * ratio) / Math.max(rubricaAspect, 1) / FRAC_IMAGEN_RUBRICA, 2, 25);

    useEffect(() => {
        setColocacion((c) => (c ? { ...c, wPct: tamano, hPct: hFromW(tamano) } : c));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tamano, ratio, rubricaAspect]);

    const puedeColocar = rotacion === 0;

    const pctDesdeEvento = (clientX: number, clientY: number) => {
        const el = visorRef.current;
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { xPct: ((clientX - r.left) / r.width) * 100, yPct: ((clientY - r.top) / r.height) * 100 };
    };

    const colocarEn = (clientX: number, clientY: number) => {
        if (!puedeColocar) return;
        const p = pctDesdeEvento(clientX, clientY);
        if (!p) return;
        const w = tamano;
        const h = hFromW(w);
        setColocacion({
            pagina,
            xPct: clamp(p.xPct - w / 2, 0, 100 - w),
            yPct: clamp(p.yPct - h / 2, 0, 100 - h),
            wPct: w,
            hPct: h,
        });
    };

    const onStampDown: React.PointerEventHandler = (e) => {
        if (!colocacion) return;
        e.stopPropagation();
        const p = pctDesdeEvento(e.clientX, e.clientY);
        if (!p) return;
        dragState.current = { dragging: true, offX: p.xPct - colocacion.xPct, offY: p.yPct - colocacion.yPct };
        (e.target as Element).setPointerCapture(e.pointerId);
    };
    const onStampMove: React.PointerEventHandler = (e) => {
        if (!dragState.current.dragging || !colocacion) return;
        const p = pctDesdeEvento(e.clientX, e.clientY);
        if (!p) return;
        setColocacion({
            ...colocacion,
            xPct: clamp(p.xPct - dragState.current.offX, 0, 100 - colocacion.wPct),
            yPct: clamp(p.yPct - dragState.current.offY, 0, 100 - colocacion.hPct),
        });
    };
    const onStampUp: React.PointerEventHandler = () => {
        dragState.current.dragging = false;
    };

    const descargar = () => {
        if (!pdfUrl) return;
        const a = document.createElement("a");
        a.href = pdfUrl;
        a.download = doc.nombreArchivo || `${doc.asunto}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    };

    const firmar = async () => {
        if (!colocacion) {
            notify("Haz clic sobre el documento para colocar tu rúbrica.", "warning", 3000);
            return;
        }
        setFirmando(true);
        try {
            let imagenFirma: File | null = null;
            let tipoFirma: TipoFirma = "texto";
            if (rubrica?.imagenUrl) {
                imagenFirma = await dataUrlToFile(rubrica.imagenUrl);
                tipoFirma = "imagen";
            }
            const resultado = await onFirmar(doc, { tipoFirma, imagenFirma, posicion: colocacion, cargoFirmante: cargo });
            if (resultado?.qrGenerado === false) {
                notify(
                    "Documento firmado, pero no se pudo generar el código QR de validación. Vuelve a intentarlo si lo necesitas.",
                    "warning",
                    5000
                );
            } else {
                notify("Documento firmado correctamente.", "success", 3000);
            }
            onVolver();
        } catch (e: any) {
            notify(e?.message || "No se pudo firmar el documento.", "error", 3500);
        } finally {
            setFirmando(false);
        }
    };

    const confirmarRechazo = async () => {
        if (!onRechazar) return;
        if (!motivo.trim()) {
            notify("Debes indicar el motivo del rechazo.", "warning", 3000);
            return;
        }
        setRechazandoBusy(true);
        try {
            await onRechazar(doc, motivo.trim());
            notify("Solicitud de firma rechazada.", "success", 3000);
            onVolver();
        } catch (e: any) {
            notify(e?.message || "No se pudo rechazar el documento.", "error", 3500);
        } finally {
            setRechazandoBusy(false);
        }
    };

    const idDoc = (doc.codigoDocumento || String(doc.id)).toUpperCase();

    const pageWrapStyle = useMemo<React.CSSProperties>(
        () => ({
            width: `${zoom}%`,
            aspectRatio: String(ratio),
            transform: rotacion ? `rotate(${rotacion}deg)` : undefined,
        }),
        [zoom, ratio, rotacion]
    );

    return (
        <div className="flex flex-col gap-4">
            <button
                type="button"
                onClick={onVolver}
                className="flex w-fit items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
                <i className="dx-icon-chevronleft" /> Volver
            </button>

            <div>
                <h2 className="text-xl font-semibold text-gray-800">Firmar documento</h2>
                <p className="text-sm text-gray-500">Coloca tu rúbrica en el lugar del documento que desees.</p>
            </div>

            {/* Barra de información */}
            <div className="grid grid-cols-2 gap-4 rounded-xl border bg-white px-5 py-3 shadow-sm sm:grid-cols-4">
                <InfoItem label="Asunto">{doc.asunto}</InfoItem>
                <InfoItem label="Enviado por">{doc.creador.nombres}</InfoItem>
                <InfoItem label="Fecha de envío">{moment(doc.fechaCreacion).format("DD/MM/YYYY hh:mm a")}</InfoItem>
                <InfoItem label="ID Documento">{doc.codigoDocumento || doc.id}</InfoItem>
            </div>

            {/* Cuerpo */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr,320px]">
                {/* Visor */}
                <div className="flex h-[72vh] flex-col overflow-hidden rounded-xl border bg-white shadow-sm">
                    <div className="flex flex-wrap items-center gap-1 bg-slate-800 px-3 py-1.5 text-sm text-gray-200">
                        <i className="dx-icon-file mr-1" />
                        <span className="mr-2 max-w-[160px] truncate">{doc.nombreArchivo}</span>
                        <span className="mx-1 h-4 w-px bg-white/20" />
                        <ToolbarBtn
                            icon="chevronprev"
                            title="Página anterior"
                            onClick={() => setPagina((p) => Math.max(1, p - 1))}
                            disabled={pagina <= 1}
                        />
                        <span className="px-1 text-xs">
                            {pagina} / {numPaginas}
                        </span>
                        <ToolbarBtn
                            icon="chevronnext"
                            title="Página siguiente"
                            onClick={() => setPagina((p) => Math.min(numPaginas, p + 1))}
                            disabled={pagina >= numPaginas}
                        />
                        <span className="mx-1 h-4 w-px bg-white/20" />
                        <ToolbarBtn icon="minus" title="Alejar" onClick={() => setZoom((z) => Math.max(ZOOMS[0], z - 25))} />
                        <span className="px-1 text-xs">{zoom}%</span>
                        <ToolbarBtn
                            icon="plus"
                            title="Acercar"
                            onClick={() => setZoom((z) => Math.min(ZOOMS[ZOOMS.length - 1], z + 25))}
                        />
                        <span className="mx-1 h-4 w-px bg-white/20" />
                        <ToolbarBtn icon="refresh" title="Rotar" onClick={() => setRotacion((r) => (r + 90) % 360)} />
                        <span className="ml-auto" />
                        <ToolbarBtn icon="download" title="Descargar" onClick={descargar} disabled={!pdfUrl} />
                        <ToolbarBtn
                            icon="print"
                            title="Imprimir"
                            onClick={() => pdfUrl && window.open(pdfUrl, "_blank")}
                            disabled={!pdfUrl}
                        />
                    </div>

                    <div className="flex min-h-0 flex-1">
                        {/* Miniaturas */}
                        <div className="hidden w-24 shrink-0 overflow-y-auto border-r bg-gray-50 p-2 sm:block">
                            {Array.from({ length: numPaginas }, (_, i) => i + 1).map((n) => (
                                <button
                                    key={n}
                                    type="button"
                                    onClick={() => setPagina(n)}
                                    className={`mb-2 flex w-full flex-col items-center rounded border p-1 text-[10px] transition ${
                                        n === pagina
                                            ? "border-blue-500 ring-2 ring-blue-200"
                                            : "border-gray-200 hover:border-gray-300"
                                    }`}
                                >
                                    <span
                                        className="flex w-full items-center justify-center rounded bg-white text-gray-300"
                                        style={{ aspectRatio: String(ratio) }}
                                    >
                                        <i className="dx-icon-file text-lg" />
                                    </span>
                                    <span className="mt-1 text-gray-500">{n}</span>
                                </button>
                            ))}
                        </div>

                        {/* Página */}
                        <div className="relative min-h-0 flex-1 overflow-auto bg-gray-200 p-4">
                            {!pdfBytes || !pdfUrl ? (
                                <div className="flex h-full items-center justify-center text-sm text-gray-500">
                                    Cargando documento…
                                </div>
                            ) : (
                                <div className="mx-auto" style={pageWrapStyle}>
                                    <div className="relative h-full w-full select-none shadow-lg">
                                        <object
                                            key={`${doc.id}-${pagina}`}
                                            data={`${pdfUrl}#page=${pagina}&toolbar=0&navpanes=0&scrollbar=0&view=Fit`}
                                            type="application/pdf"
                                            className="pointer-events-none absolute inset-0 h-full w-full bg-white"
                                        >
                                            <div className="flex h-full items-center justify-center p-4 text-center text-xs text-gray-500">
                                                Tu navegador no puede previsualizar el PDF. Usa el botón de descarga.
                                            </div>
                                        </object>

                                        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-md border border-gray-300 bg-white/90 px-3 py-1 text-[10px] font-semibold tracking-wide text-gray-600">
                                            ID DOCUMENTO: {idDoc}
                                        </div>

                                        <div
                                            ref={visorRef}
                                            onClick={(e) => colocarEn(e.clientX, e.clientY)}
                                            className={`absolute inset-0 ${puedeColocar ? "cursor-crosshair" : ""}`}
                                        >
                                            {colocacion && colocacion.pagina === pagina && (
                                                <div
                                                    onPointerDown={onStampDown}
                                                    onPointerMove={onStampMove}
                                                    onPointerUp={onStampUp}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="absolute flex cursor-move flex-col items-center overflow-hidden rounded border-2 border-blue-500 bg-blue-50/70 px-1"
                                                    style={{
                                                        left: `${colocacion.xPct}%`,
                                                        top: `${colocacion.yPct}%`,
                                                        width: `${colocacion.wPct}%`,
                                                        height: `${colocacion.hPct}%`,
                                                    }}
                                                >
                                                    <div
                                                        className="flex w-full items-center justify-center"
                                                        style={{ height: `${FRAC_IMAGEN_RUBRICA * 100}%` }}
                                                    >
                                                        {rubrica?.imagenUrl ? (
                                                            <img
                                                                src={rubrica.imagenUrl}
                                                                alt="Rúbrica"
                                                                draggable={false}
                                                                className="h-4/5 w-4/5 object-contain"
                                                            />
                                                        ) : (
                                                            <span
                                                                className="truncate px-1 text-blue-800"
                                                                style={{ fontFamily: "cursive" }}
                                                            >
                                                                {nombreRubrica}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="w-[84%] shrink-0 border-t border-gray-500" />
                                                    <div className="flex w-full flex-1 flex-col items-center justify-start overflow-hidden leading-none text-gray-700">
                                                        <span className="max-w-full truncate text-[9px] font-semibold leading-none">
                                                            {nombreRubrica}
                                                        </span>
                                                        {cargo && (
                                                            <span className="max-w-full truncate text-[8px] leading-none">{cargo}</span>
                                                        )}
                                                        <span className="max-w-full truncate text-[7px] leading-none text-gray-500">
                                                            {moment().format("DD/MM/YYYY HH:mm:ss")}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="border-t px-3 py-1.5 text-center text-xs text-gray-400">
                        Página {pagina} de {numPaginas}
                        {!puedeColocar && " · Restablece la rotación para colocar la rúbrica"}
                    </div>
                </div>

                {/* Panel rúbrica */}
                <div className="flex flex-col gap-4">
                    <div>
                        <h3 className="mb-2 text-sm font-semibold text-gray-700">Tu rúbrica</h3>
                        <div className="flex flex-col items-center gap-1 rounded-xl border-2 border-dashed border-gray-200 bg-white p-4">
                            {rubrica?.imagenUrl ? (
                                <img src={rubrica.imagenUrl} alt="Rúbrica" className="max-h-24 w-full object-contain" />
                            ) : (
                                <span className="py-4 text-xs text-gray-400">Aún no has configurado tu rúbrica.</span>
                            )}
                            <p className="mt-1 text-sm font-semibold text-gray-700">{nombreRubrica}</p>
                            <p className="text-[11px] uppercase text-gray-400">
                                {rubrica ? `Rúbrica ${rubrica.estado.toLowerCase()}` : "Firma electrónica"}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate("/miFirma")}
                            className="mt-2 flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                        >
                            <i className="dx-icon-edit" /> Cambiar rúbrica
                        </button>
                    </div>

                    <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
                        <i className="dx-icon-info mt-0.5" />
                        <span>Haz clic y arrastra tu rúbrica al lugar donde deseas colocarla en el documento.</span>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Tamaño de rúbrica</label>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setTamano((t) => clamp(t - 2, TAMANO_MIN, TAMANO_MAX))}
                                className="flex h-7 w-7 items-center justify-center rounded border text-gray-500 hover:bg-gray-50"
                            >
                                <i className="dx-icon-minus" />
                            </button>
                            <input
                                type="range"
                                min={TAMANO_MIN}
                                max={TAMANO_MAX}
                                value={tamano}
                                onChange={(e) => setTamano(Number(e.target.value))}
                                className="flex-1 accent-blue-600"
                            />
                            <button
                                type="button"
                                onClick={() => setTamano((t) => clamp(t + 2, TAMANO_MIN, TAMANO_MAX))}
                                className="flex h-7 w-7 items-center justify-center rounded border text-gray-500 hover:bg-gray-50"
                            >
                                <i className="dx-icon-plus" />
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Vista</label>
                        <select
                            value={zoom}
                            onChange={(e) => setZoom(Number(e.target.value))}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none"
                        >
                            {ZOOMS.map((z) => (
                                <option key={z} value={z}>
                                    {z}%
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Acciones</label>
                        <button
                            type="button"
                            onClick={() => setColocacion(null)}
                            disabled={!colocacion}
                            className="flex w-full items-center justify-center gap-1 rounded-md border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                        >
                            <i className="dx-icon-trash" /> Limpiar rúbrica
                        </button>
                    </div>

                    <div className="mt-2 flex flex-col gap-2">
                        <button
                            type="button"
                            onClick={firmar}
                            disabled={firmando || !rubricaActiva || bloqueado}
                            className="flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                            <i className="dx-icon-check" />
                            {firmando ? "Firmando…" : "Firmar documento"}
                        </button>
                        {onRechazar && !mostrarRechazo && (
                            <button
                                type="button"
                                onClick={() => setMostrarRechazo(true)}
                                disabled={firmando}
                                className="flex items-center justify-center gap-2 rounded-md border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                                <i className="dx-icon-close" /> Rechazar firma
                            </button>
                        )}
                        {!rubricaActiva && (
                            <p className="text-center text-[11px] text-amber-600">
                                Tu rúbrica está desactivada. Actívala en "Cambiar rúbrica" para poder firmar.
                            </p>
                        )}
                        {bloqueado && (
                            <p className="text-center text-[11px] text-amber-600">
                                {doc.motivoBloqueo || "Todavía no puedes firmar este documento."}
                            </p>
                        )}
                    </div>

                    {onRechazar && mostrarRechazo && (
                        <div className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                            <p className="text-xs text-red-700">
                                Vas a rechazar esta solicitud de firma. El creador será notificado y el documento no
                                podrá firmarse.
                            </p>
                            <label className="text-xs font-semibold text-red-700">
                                Motivo del rechazo <span className="font-normal">(obligatorio)</span>
                            </label>
                            <textarea
                                value={motivo}
                                onChange={(e) => setMotivo(e.target.value)}
                                rows={3}
                                placeholder="Explica por qué rechazas este documento…"
                                className="w-full rounded-md border border-red-200 px-3 py-2 text-sm focus:outline-none"
                            />
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setMostrarRechazo(false)}
                                    disabled={rechazandoBusy}
                                    className="rounded-md border px-3 py-1.5 text-sm text-gray-600 hover:bg-white"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={confirmarRechazo}
                                    disabled={rechazandoBusy || !motivo.trim()}
                                    className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                                >
                                    {rechazandoBusy ? "Rechazando…" : "Confirmar rechazo"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Nota */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-2 text-xs text-amber-700">
                <i className="dx-icon-info mr-1" />
                Asegúrate de revisar el documento completo antes de firmarlo. Una vez firmado, no podrás modificar el
                documento.
            </div>
        </div>
    );
};

export default FirmarDocumento;
