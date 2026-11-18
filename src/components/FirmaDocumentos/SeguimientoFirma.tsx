import React, { useEffect, useMemo, useState } from "react";
import { Popup } from "devextreme-react/popup";
import Button from "devextreme-react/button";
import notify from "devextreme/ui/notify";
import moment from "moment";
import { ESTADO_SEGUIMIENTO_META, EstadoSeguimientoVista, SeguimientoDocumento } from "../../types/SeguimientoFirma";
import { DestinatarioFirma, DocumentoFirma, EstadoFirmaDocumento } from "../../types/FirmaDocumento";
import { descargarPdfComoBlobUrl, firmaDocumentosApi } from "../../services/firmaDocumentos/firmaDocumentosApi";
import SeguimientoDocumentoModal from "./SeguimientoDocumentoModal";

type Props = {
    documentos: SeguimientoDocumento[];
    loading: boolean;
    error: string | null;
    onRefrescar: () => void;
};

const PAGE_SIZES = [10, 15, 25] as const;

const claseEstado = (nombre: string): string => {
    const k = nombre.trim().toUpperCase() as EstadoSeguimientoVista;
    return ESTADO_SEGUIMIENTO_META[k]?.clase || "bg-gray-50 text-gray-600 ring-1 ring-gray-200";
};

/** "Versión N · Original/Final/Última firma", igual que en el mockup, según el estado. */
const etiquetaVersion = (d: SeguimientoDocumento): string => {
    const est = d.estadoNombre.trim().toUpperCase();
    const detalle = est === "BORRADOR" ? "Original" : est === "TERMINADO" || est === "ANULADO" || est === "RECHAZADO" ? "Final" : "Última firma";
    return `Versión ${d.versionArchivo} · ${detalle}`;
};

const ESTADO_TEXTO_A_TIPO: Record<string, EstadoFirmaDocumento> = {
    BORRADOR: "Borrador",
    ENVIADO: "Pendiente",
    "EN PROCESO": "EnProceso",
    TERMINADO: "Firmado",
    FINALIZADO: "Firmado",
    RECHAZADO: "Rechazado",
    ANULADO: "Anulado",
};

/**
 * Adapta una fila de `GET /firmas/seguimiento` (que solo trae nombres de
 * receptores, sin su estado/orden/fecha individual) al `DocumentoFirma` que
 * espera `SeguimientoDocumentoModal`. Se usa solo como RESPALDO cuando falla
 * la consulta del detalle real (`obtenerSeguimientoDocumento`, endpoint
 * `firmas/solicitudes/{id}/seguimiento`); en ese caso todos los destinatarios
 * sintetizados aquí comparten el estado general del documento (no se puede
 * saber, por ejemplo, cuál de varios ya firmó y cuál no), así que el modal se
 * abre en modo resumen (`soloResumen`).
 */
const aDocumentoFirma = (d: SeguimientoDocumento): DocumentoFirma => {
    const estado = ESTADO_TEXTO_A_TIPO[d.estadoNombre.trim().toUpperCase()] ?? "Pendiente";
    const estadoFirmante: DestinatarioFirma["estado"] = estado === "Rechazado" ? "Rechazado" : estado === "Firmado" ? "Firmado" : "Pendiente";
    const destinatarios: DestinatarioFirma[] = d.receptores.map((nombre, i) => ({
        id: i + 1,
        nombres: nombre,
        orden: i + 1,
        estado: estadoFirmante,
    }));
    return {
        id: Number(d.idArchivo) || 0,
        codigoDocumento: d.idDocumento,
        codigoCorto: d.codigoDocumento,
        asunto: d.asunto || d.codigoDocumento,
        modo: "Otros & Yo",
        nombreArchivo: "",
        creador: { id: 0, nombres: d.emisor, esUsuarioActual: false },
        firmante: { id: 0, nombres: d.emisor, esUsuarioActual: false },
        estado,
        fechaCreacion: d.fechaCreacion,
        hashOriginal: "",
        destinatarios,
        idArchivoBase: d.idArchivo,
        versionBase: d.versionArchivo,
        pdfOriginalUrl: d.urlUltimoDocumento,
        pdfFirmadoUrl: estado === "Firmado" ? d.urlUltimoDocumento : undefined,
    };
};

/**
 * "Seguimiento Firma": módulo de auditoría para fiscalizadores. Muestra TODOS
 * los documentos que el usuario está autorizado a ver (backend sin paginar,
 * `GET /firmas/seguimiento`), con filtros por columna y paginación en el
 * frontend.
 */
const SeguimientoFirma: React.FC<Props> = ({ documentos, loading, error, onRefrescar }) => {
    const [fId, setFId] = useState("");
    const [fEmisor, setFEmisor] = useState("");
    const [fReceptor, setFReceptor] = useState("");
    const [fArea, setFArea] = useState("todas");
    const [fEstado, setFEstado] = useState("todos");
    const [search, setSearch] = useState("");
    const [pageSize, setPageSize] = useState<number | "todos">(10);
    const [page, setPage] = useState(1);
    const [viendo, setViendo] = useState<SeguimientoDocumento | null>(null);
    const [viendoUrl, setViendoUrl] = useState<string | null>(null);
    const [seguimiento, setSeguimiento] = useState<DocumentoFirma | null>(null);
    // true solo cuando no se pudo obtener el detalle real y se cayó al resumen sintetizado.
    const [seguimientoResumen, setSeguimientoResumen] = useState(false);
    const [cargandoSeguimientoId, setCargandoSeguimientoId] = useState<string | null>(null);

    const abrirSeguimiento = async (d: SeguimientoDocumento) => {
        setCargandoSeguimientoId(d.idDocumento);
        try {
            const doc = await firmaDocumentosApi.obtenerSeguimientoDocumento(d.idDocumento);
            setSeguimiento(doc);
            setSeguimientoResumen(false);
        } catch (e) {
            console.error("No se pudo obtener el detalle del documento; se muestra el resumen.", e);
            setSeguimiento(aDocumentoFirma(d));
            setSeguimientoResumen(true);
        } finally {
            setCargandoSeguimientoId(null);
        }
    };

    const areas = useMemo(() => Array.from(new Set(documentos.map((d) => d.area).filter(Boolean))).sort(), [documentos]);
    const estados = useMemo(
        () => Array.from(new Set(documentos.map((d) => d.estadoNombre).filter(Boolean))).sort(),
        [documentos]
    );

    const limpiarFiltros = () => {
        setFId("");
        setFEmisor("");
        setFReceptor("");
        setFArea("todas");
        setFEstado("todos");
        setSearch("");
    };

    const filtrados = useMemo(() => {
        const qId = fId.trim().toLowerCase();
        const qEmisor = fEmisor.trim().toLowerCase();
        const qReceptor = fReceptor.trim().toLowerCase();
        const qBusqueda = search.trim().toLowerCase();
        return documentos.filter((d) => {
            if (qId && !`${d.idDocumento} ${d.codigoDocumento}`.toLowerCase().includes(qId)) return false;
            if (qEmisor && !d.emisor.toLowerCase().includes(qEmisor)) return false;
            if (qReceptor && !d.receptores.some((r) => r.toLowerCase().includes(qReceptor))) return false;
            if (fArea !== "todas" && d.area !== fArea) return false;
            if (fEstado !== "todos" && d.estadoNombre !== fEstado) return false;
            if (qBusqueda) {
                const hay = [d.asunto, d.codigoDocumento, d.emisor, d.area, ...d.receptores]
                    .filter(Boolean)
                    .some((s) => String(s).toLowerCase().includes(qBusqueda));
                if (!hay) return false;
            }
            return true;
        });
    }, [documentos, fId, fEmisor, fReceptor, fArea, fEstado, search]);

    useEffect(() => {
        setPage(1);
    }, [fId, fEmisor, fReceptor, fArea, fEstado, search, pageSize]);

    const tamanoPagina = pageSize === "todos" ? Math.max(filtrados.length, 1) : pageSize;
    const totalPaginas = Math.max(1, Math.ceil(filtrados.length / tamanoPagina));
    const pageActual = Math.min(page, totalPaginas);
    const visibles = filtrados.slice((pageActual - 1) * tamanoPagina, pageActual * tamanoPagina);

    useEffect(() => {
        if (!viendo) {
            setViendoUrl(null);
            return;
        }
        let ignore = false;
        let urlCreado: string | null = null;
        setViendoUrl(null);
        (async () => {
            try {
                urlCreado = await descargarPdfComoBlobUrl(viendo.urlUltimoDocumento);
                if (ignore) {
                    URL.revokeObjectURL(urlCreado);
                    return;
                }
                setViendoUrl(urlCreado);
            } catch {
                if (!ignore) notify("No se pudo cargar el documento.", "error", 3500);
            }
        })();
        return () => {
            ignore = true;
            if (urlCreado) URL.revokeObjectURL(urlCreado);
        };
    }, [viendo]);

    return (
        <div className="flex flex-col gap-4">
            <div>
                <h2 className="text-xl font-semibold text-gray-800">Seguimiento Firma</h2>
                <p className="text-sm text-gray-500">Consulta el estado y la última versión de los documentos.</p>
            </div>

            {/* Filtros por columna */}
            <div className="grid grid-cols-1 gap-3 rounded-2xl border bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
                <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">ID / Código</label>
                    <div className="relative">
                        <i className="dx-icon-search pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={fId}
                            onChange={(e) => setFId(e.target.value)}
                            placeholder="Buscar ID o código..."
                            className="w-full rounded-md border border-gray-300 py-2 pl-8 pr-3 text-sm focus:border-gray-400 focus:outline-none"
                        />
                    </div>
                </div>
                <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Emisor</label>
                    <div className="relative">
                        <i className="dx-icon-search pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={fEmisor}
                            onChange={(e) => setFEmisor(e.target.value)}
                            placeholder="Buscar emisor..."
                            className="w-full rounded-md border border-gray-300 py-2 pl-8 pr-3 text-sm focus:border-gray-400 focus:outline-none"
                        />
                    </div>
                </div>
                <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Receptor</label>
                    <div className="relative">
                        <i className="dx-icon-search pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={fReceptor}
                            onChange={(e) => setFReceptor(e.target.value)}
                            placeholder="Buscar receptor..."
                            className="w-full rounded-md border border-gray-300 py-2 pl-8 pr-3 text-sm focus:border-gray-400 focus:outline-none"
                        />
                    </div>
                </div>
                <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Área</label>
                    <select
                        value={fArea}
                        onChange={(e) => setFArea(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none"
                    >
                        <option value="todas">Todas las áreas</option>
                        {areas.map((a) => (
                            <option key={a} value={a}>
                                {a}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Estado</label>
                    <select
                        value={fEstado}
                        onChange={(e) => setFEstado(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none"
                    >
                        <option value="todos">Todos los estados</option>
                        {estados.map((e) => (
                            <option key={e} value={e}>
                                {e}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="lg:col-span-5">
                    <button
                        type="button"
                        onClick={limpiarFiltros}
                        className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                    >
                        <i className="dx-icon-refresh" /> Limpiar filtros
                    </button>
                </div>
            </div>

            {/* Mostrar N + búsqueda libre */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                    Mostrar
                    <select
                        value={pageSize}
                        onChange={(e) => setPageSize(e.target.value === "todos" ? "todos" : Number(e.target.value))}
                        className="rounded border border-gray-300 px-2 py-1 focus:outline-none"
                    >
                        {PAGE_SIZES.map((n) => (
                            <option key={n} value={n}>
                                {n}
                            </option>
                        ))}
                        <option value="todos">Todos</option>
                    </select>
                    documentos
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <i className="dx-icon-search pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar en la tabla..."
                            className="w-56 rounded-md border border-gray-300 py-2 pl-8 pr-3 text-sm focus:border-gray-400 focus:outline-none"
                        />
                    </div>
                    <Button icon="refresh" stylingMode="outlined" onClick={onRefrescar} disabled={loading} hint="Recargar" />
                </div>
            </div>

            {error && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
            )}

            {/* Tabla */}
            <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
                <table className="w-full min-w-[1200px] text-sm">
                    <thead>
                        <tr className="border-b bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                            <th className="whitespace-nowrap px-3 py-3">ID / Código</th>
                            <th className="px-3 py-3">Asunto</th>
                            <th className="px-3 py-3">Fecha de creación</th>
                            <th className="px-3 py-3">Emisor</th>
                            <th className="px-3 py-3">Área</th>
                            <th className="px-3 py-3">Receptores</th>
                            <th className="px-3 py-3">Estado</th>
                            <th className="px-3 py-3">Último documento</th>
                            <th className="px-3 py-3 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr>
                                <td colSpan={9} className="px-3 py-10 text-center text-gray-400">
                                    Cargando documentos…
                                </td>
                            </tr>
                        )}
                        {!loading && visibles.length === 0 && (
                            <tr>
                                <td colSpan={9} className="px-3 py-10 text-center text-gray-400">
                                    No hay documentos que coincidan.
                                </td>
                            </tr>
                        )}
                        {!loading &&
                            visibles.map((d) => (
                                <tr key={d.idDocumento} className="border-b last:border-0 transition hover:bg-gray-50">
                                    <td className="whitespace-nowrap px-3 py-3 align-top">
                                        <p className="font-semibold text-gray-800">{d.codigoDocumento || d.idDocumento}</p>
                                        <p className="font-mono text-[11px] text-gray-400">
                                            ID: {d.idDocumento}
                                        </p>
                                    </td>
                                    <td className="max-w-[220px] px-3 py-3 align-top text-gray-700">
                                        {d.asunto || <span className="text-gray-400">—</span>}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-3 align-top text-gray-700">
                                        {moment(d.fechaCreacion).format("DD/MM/YYYY")}
                                        <span className="block text-xs text-gray-400">{moment(d.fechaCreacion).format("hh:mm a")}</span>
                                    </td>
                                    <td className="px-3 py-3 align-top text-gray-700">{d.emisor}</td>
                                    <td className="px-3 py-3 align-top text-gray-700">{d.area}</td>
                                    <td className="max-w-[200px] px-3 py-3 align-top text-gray-700">
                                        {d.receptores.length ? (
                                            d.receptores.map((r, i) => <span key={i} className="block">{r}</span>)
                                        ) : (
                                            <span className="text-gray-400">—</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-3 align-top">
                                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${claseEstado(d.estadoNombre)}`}>
                                            {d.estadoNombre || "—"}
                                        </span>
                                    </td>
                                    <td className="px-3 py-3 align-top">
                                        <button
                                            type="button"
                                            onClick={() => setViendo(d)}
                                            disabled={!d.urlUltimoDocumento}
                                            className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline disabled:cursor-not-allowed disabled:text-gray-300 disabled:no-underline"
                                        >
                                            <i className="dx-icon-eyeopen" /> Ver PDF
                                        </button>
                                        <p className="text-xs text-gray-400">{etiquetaVersion(d)}</p>
                                    </td>
                                    <td className="px-3 py-3 align-top">
                                        <div className="flex justify-center">
                                            <button
                                                type="button"
                                                title="Seguimiento"
                                                onClick={() => abrirSeguimiento(d)}
                                                disabled={cargandoSeguimientoId === d.idDocumento}
                                                className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-500 transition hover:bg-gray-50 disabled:cursor-wait disabled:opacity-50"
                                            >
                                                <i className={cargandoSeguimientoId === d.idDocumento ? "dx-icon-refresh" : "dx-icon-eyeopen"} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>

            {/* Paginación */}
            <div className="flex flex-col items-center justify-between gap-3 text-sm text-gray-500 sm:flex-row">
                <span>
                    {filtrados.length === 0
                        ? "Mostrando 0 documentos"
                        : `Mostrando ${(pageActual - 1) * tamanoPagina + 1} a ${Math.min(
                              pageActual * tamanoPagina,
                              filtrados.length
                          )} de ${filtrados.length} documentos`}
                </span>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={pageActual <= 1}
                        className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40"
                    >
                        Anterior
                    </button>
                    {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((n) => (
                        <button
                            key={n}
                            type="button"
                            onClick={() => setPage(n)}
                            className={`rounded border px-3 py-1 ${
                                n === pageActual ? "border-blue-500 bg-blue-500 text-white" : "border-gray-300 hover:bg-gray-50"
                            }`}
                        >
                            {n}
                        </button>
                    ))}
                    <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(totalPaginas, p + 1))}
                        disabled={pageActual >= totalPaginas}
                        className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40"
                    >
                        Siguiente
                    </button>
                </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
                <i className="dx-icon-info mt-0.5" />
                <span>Ver PDF abre siempre la última versión disponible del documento.</span>
            </div>

            {/* Ver PDF */}
            <Popup visible={!!viendo} onHiding={() => setViendo(null)} showTitle={false} dragEnabled={false} width="92vw" maxWidth={1000} height="90vh">
                {viendo ? (
                    <div className="flex h-full flex-col">
                        <div className="flex items-center justify-between border-b px-4 py-2">
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-gray-800">{viendo.asunto || viendo.codigoDocumento}</p>
                                <p className="text-xs text-gray-400">
                                    {viendo.estadoNombre} · {etiquetaVersion(viendo)}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    icon="export"
                                    stylingMode="outlined"
                                    hint="Abrir en pestaña"
                                    disabled={!viendoUrl}
                                    onClick={() => viendoUrl && window.open(viendoUrl, "_blank")}
                                />
                                <Button icon="close" stylingMode="text" onClick={() => setViendo(null)} />
                            </div>
                        </div>
                        <div className="min-h-0 flex-1 bg-gray-200">
                            {!viendoUrl ? (
                                <div className="flex h-full items-center justify-center text-sm text-gray-500">Cargando documento…</div>
                            ) : (
                                <object data={`${viendoUrl}#toolbar=1&navpanes=0&view=FitH`} type="application/pdf" className="h-full w-full">
                                    <div className="flex h-full items-center justify-center p-6 text-center text-xs text-gray-500">
                                        Tu navegador no puede previsualizar el PDF aquí.
                                    </div>
                                </object>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="p-6 text-sm text-gray-400">Cargando…</div>
                )}
            </Popup>

            <SeguimientoDocumentoModal
                doc={seguimiento}
                onClose={() => setSeguimiento(null)}
                soloResumen={seguimientoResumen}
            />
        </div>
    );
};

export default SeguimientoFirma;
