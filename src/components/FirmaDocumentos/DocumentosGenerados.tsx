import React, { useEffect, useMemo, useState } from "react";
import { Popup } from "devextreme-react/popup";
import Button from "devextreme-react/button";
import notify from "devextreme/ui/notify";
import moment from "moment";
import { DocumentoFirma } from "../../types/FirmaDocumento";
import { descargarPdfComoBlobUrl } from "../../services/firmaDocumentos/firmaDocumentosApi";
import SeguimientoDocumentoModal from "./SeguimientoDocumentoModal";

type Props = {
    documentos: DocumentoFirma[];
    loading: boolean;
    onRefrescar: () => void;
    /** Envía una solicitud que estaba en Borrador (backend: cambio-borrador-enviado). */
    onEnviarBorrador: (doc: DocumentoFirma) => Promise<any>;
    /** Anula el proceso de firma (solo el creador). Motivo obligatorio. */
    onAnular: (doc: DocumentoFirma, motivo: string) => Promise<any>;
};

type TipoKey = "unica" | "varios" | "auditoria";

const TIPO_META: Record<TipoKey, { sigla: string; clase: string }> = {
    unica: { sigla: "SES", clase: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200" },
    varios: { sigla: "VARIOS", clase: "bg-purple-50 text-purple-600 ring-1 ring-purple-200" },
    auditoria: { sigla: "AUD", clase: "bg-amber-50 text-amber-600 ring-1 ring-amber-200" },
};

const tipoDe = (d: DocumentoFirma): TipoKey =>
    d.tipoSolicitud && d.tipoSolicitud in TIPO_META ? (d.tipoSolicitud as TipoKey) : "unica";

type EstadoVista = "ENVIADO" | "EN PROCESO" | "TERMINADO" | "ANULADO" | "BORRADOR" | "RECHAZADO";

const ESTADO_META: Record<EstadoVista, { clase: string; desc: string }> = {
    ENVIADO: {
        clase: "bg-amber-50 text-amber-600 ring-1 ring-amber-200",
        desc: "El documento fue enviado y está pendiente de inicio.",
    },
    "EN PROCESO": {
        clase: "bg-purple-50 text-purple-600 ring-1 ring-purple-200",
        desc: "El documento está siendo firmado por los destinatarios.",
    },
    TERMINADO: {
        clase: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200",
        desc: "Todos los destinatarios han firmado el documento.",
    },
    ANULADO: {
        clase: "bg-orange-50 text-orange-500 ring-1 ring-orange-200",
        desc: "El documento fue anulado por el remitente.",
    },
    BORRADOR: {
        clase: "bg-blue-50 text-blue-600 ring-1 ring-blue-200",
        desc: "El documento está en borrador y no ha sido enviado.",
    },
    RECHAZADO: {
        clase: "bg-rose-50 text-rose-600 ring-1 ring-rose-200",
        desc: "El documento fue rechazado por uno de los firmantes.",
    },
};

// El backend ya distingue "Enviado" (nadie firmó) de "En proceso" (al menos
// uno ya firmó, faltan otros) en el propio `estado` del documento; antes se
// re-derivaba contando destinatarios con estado "Firmado", pero ese conteo
// llegaba desactualizado y el documento se veía como "ENVIADO" aunque ya
// tuviera una firma.
const estadoVista = (d: DocumentoFirma): EstadoVista => {
    switch (d.estado) {
        case "Borrador":
            return "BORRADOR";
        case "Rechazado":
            return "RECHAZADO";
        case "Anulado":
            return "ANULADO";
        case "Firmado":
            return "TERMINADO";
        case "EnProceso":
            return "EN PROCESO";
        default:
            return "ENVIADO";
    }
};

const PAGE_SIZES = [10, 25, 50];

/**
 * "Documentos generados": listado de documentos que el usuario creó y envió a
 * firma. Tabla con búsqueda, filtro por estado, paginación y vista del PDF
 * (el último archivo generado, ya con las firmas registradas).
 */
const DocumentosGenerados: React.FC<Props> = ({ documentos, loading, onRefrescar, onEnviarBorrador, onAnular }) => {
    const [search, setSearch] = useState("");
    const [estadoFiltro, setEstadoFiltro] = useState<"todos" | EstadoVista>("todos");
    const [mostrarFiltros, setMostrarFiltros] = useState(false);
    const [pageSize, setPageSize] = useState(10);
    const [page, setPage] = useState(1);
    const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
    const [viendo, setViendo] = useState<DocumentoFirma | null>(null);
    // El PDF vive en SharePoint; hay que descargarlo vía el backend antes de
    // poder mostrarlo/descargarlo/abrirlo desde el navegador.
    const [viendoUrl, setViendoUrl] = useState<string | null>(null);
    const [enviandoId, setEnviandoId] = useState<number | null>(null);
    // Modal "Seguimiento del documento" (mismo que en Documentos Recibidos).
    const [seguimiento, setSeguimiento] = useState<DocumentoFirma | null>(null);
    // Modal "Anular documento" (solo el creador; motivo obligatorio).
    const [anulando, setAnulando] = useState<DocumentoFirma | null>(null);
    const [motivoAnular, setMotivoAnular] = useState("");
    const [enviandoAnular, setEnviandoAnular] = useState(false);

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
                urlCreado = await descargarPdfComoBlobUrl(urlActual(viendo));
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viendo]);

    const enviarBorrador = async (d: DocumentoFirma) => {
        setEnviandoId(d.id);
        try {
            await onEnviarBorrador(d);
            notify("Documento enviado correctamente.", "success", 3000);
        } catch (e: any) {
            notify(e?.message || "No se pudo enviar el documento.", "error", 3500);
        } finally {
            setEnviandoId(null);
        }
    };

    // El backend solo admite anular en Borrador, Enviado o En proceso (no si
    // ya está Firmado, Rechazado o ya Anulado).
    const puedeAnularse = (est: EstadoVista) => est === "BORRADOR" || est === "ENVIADO" || est === "EN PROCESO";

    const abrirAnular = (d: DocumentoFirma) => {
        setMotivoAnular("");
        setAnulando(d);
    };

    const confirmarAnular = async () => {
        if (!anulando) return;
        if (!motivoAnular.trim()) {
            notify("Debes indicar el motivo de la anulación.", "warning", 3000);
            return;
        }
        setEnviandoAnular(true);
        try {
            await onAnular(anulando, motivoAnular.trim());
            notify("Documento anulado correctamente.", "success", 3000);
            setAnulando(null);
        } catch (e: any) {
            notify(e?.message || "No se pudo anular el documento.", "error", 3500);
        } finally {
            setEnviandoAnular(false);
        }
    };

    const filtrados = useMemo(() => {
        const q = search.trim().toLowerCase();
        return documentos.filter((d) => {
            if (estadoFiltro !== "todos" && estadoVista(d) !== estadoFiltro) return false;
            if (!q) return true;
            const dests = (d.destinatarios || []).map((x) => x.nombres).join(" ");
            return [d.asunto, d.comentario, d.codigoDocumento, dests]
                .filter(Boolean)
                .some((s) => String(s).toLowerCase().includes(q));
        });
    }, [documentos, search, estadoFiltro]);

    const totalPaginas = Math.max(1, Math.ceil(filtrados.length / pageSize));
    const pageActual = Math.min(page, totalPaginas);
    const visibles = filtrados.slice((pageActual - 1) * pageSize, pageActual * pageSize);

    useEffect(() => {
        setPage(1);
    }, [search, estadoFiltro, pageSize]);

    const toggleSel = (id: number) =>
        setSeleccion((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    const todosVisiblesSel = visibles.length > 0 && visibles.every((d) => seleccion.has(d.id));
    const toggleSelTodos = () =>
        setSeleccion((prev) => {
            const next = new Set(prev);
            if (todosVisiblesSel) visibles.forEach((d) => next.delete(d.id));
            else visibles.forEach((d) => next.add(d.id));
            return next;
        });

    const urlActual = (d: DocumentoFirma) => d.pdfFirmadoUrl || d.pdfOriginalUrl;

    const descargar = async (d: DocumentoFirma) => {
        try {
            const blobUrl = await descargarPdfComoBlobUrl(urlActual(d));
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = d.nombreArchivo || `${d.asunto}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(blobUrl);
        } catch {
            notify("No se pudo descargar el documento.", "error", 3500);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Encabezado */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-gray-800">Documentos generados</h2>
                    <p className="text-sm text-gray-500">Listado de documentos que has creado y enviado para firma.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        text="Filtrar"
                        icon="filter"
                        stylingMode="outlined"
                        type={mostrarFiltros ? "default" : "normal"}
                        onClick={() => setMostrarFiltros((v) => !v)}
                    />
                    <div className="relative">
                        <i className="dx-icon-search pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar documento..."
                            className="w-56 rounded-md border border-gray-300 py-2 pl-8 pr-3 text-sm focus:border-gray-400 focus:outline-none"
                        />
                    </div>
                    <Button icon="refresh" stylingMode="outlined" onClick={onRefrescar} disabled={loading} hint="Recargar" />
                </div>
            </div>

            {mostrarFiltros && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-gray-50 p-3">
                    <span className="text-xs font-medium text-gray-500">Estado:</span>
                    {(["todos", ...(Object.keys(ESTADO_META) as EstadoVista[])] as const).map((k) => (
                        <button
                            key={k}
                            type="button"
                            onClick={() => setEstadoFiltro(k)}
                            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                                estadoFiltro === k
                                    ? "bg-gray-800 text-white"
                                    : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100"
                            }`}
                        >
                            {k === "todos" ? "Todos" : k}
                        </button>
                    ))}
                </div>
            )}

            {/* Mostrar N */}
            <div className="flex items-center gap-2 text-sm text-gray-500">
                Mostrar
                <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="rounded border border-gray-300 px-2 py-1 focus:outline-none"
                >
                    {PAGE_SIZES.map((n) => (
                        <option key={n} value={n}>
                            {n}
                        </option>
                    ))}
                </select>
                documentos
            </div>

            {/* Tabla */}
            <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
                <table className="w-full min-w-[960px] text-sm">
                    <thead>
                        <tr className="border-b bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                            <th className="w-10 px-3 py-3">
                                <input type="checkbox" checked={todosVisiblesSel} onChange={toggleSelTodos} />
                            </th>
                            <th className="px-3 py-3">Tipo firma</th>
                            <th className="px-3 py-3">Asunto</th>
                            <th className="px-3 py-3">Destinatarios</th>
                            <th className="px-3 py-3">Fecha envío</th>
                            <th className="px-3 py-3">Vencimiento</th>
                            <th className="px-3 py-3">ID documento</th>
                            <th className="px-3 py-3">Estado</th>
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
                            visibles.map((d) => {
                                const tipo = TIPO_META[tipoDe(d)];
                                const est = estadoVista(d);
                                const dests = (d.destinatarios || []).map((x) => x.nombres);
                                return (
                                    <tr
                                        key={d.id}
                                        className={`border-b last:border-0 transition ${
                                            seleccion.has(d.id) ? "bg-blue-50" : "hover:bg-gray-50"
                                        }`}
                                    >
                                        <td className="px-3 py-3 align-top">
                                            <input
                                                type="checkbox"
                                                checked={seleccion.has(d.id)}
                                                onChange={() => toggleSel(d.id)}
                                            />
                                        </td>
                                        <td className="px-3 py-3 align-top">
                                            <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold ${tipo.clase}`}>
                                                {tipo.sigla}
                                            </span>
                                        </td>
                                        <td className="max-w-[260px] px-3 py-3 align-top">
                                            <p className="font-medium text-gray-800">{d.asunto}</p>
                                            {d.tipoDocumentoNombre && (
                                                <p className="text-[11px] text-gray-400">{d.tipoDocumentoNombre}</p>
                                            )}
                                            {d.comentario && (
                                                <p className="truncate text-xs text-gray-400">{d.comentario}</p>
                                            )}
                                        </td>
                                        <td className="max-w-[200px] px-3 py-3 align-top text-gray-700">
                                            {dests.length ? dests.join(", ") : <span className="text-gray-400">—</span>}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-3 align-top text-gray-700">
                                            {moment(d.fechaCreacion).format("DD/MM/YYYY")}
                                            <span className="block text-xs text-gray-400">
                                                {moment(d.fechaCreacion).format("hh:mm a")}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-3 align-top">
                                            {d.fechaVencimiento ? (
                                                <>
                                                    <span className="text-red-500">
                                                        {moment(d.fechaVencimiento).format("DD/MM/YYYY")}
                                                    </span>
                                                    <span className="block text-xs text-gray-400">
                                                        {moment(d.fechaVencimiento).format("hh:mm a")}
                                                    </span>
                                                </>
                                            ) : (
                                                <span className="text-gray-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-3 align-top">
                                            <span className="break-all font-mono text-xs text-gray-500">
                                                {d.codigoDocumento || String(d.id)}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3 align-top">
                                            <span
                                                className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${ESTADO_META[est].clase}`}
                                            >
                                                {est}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3 align-top">
                                            <div className="flex justify-center gap-1.5">
                                                <button
                                                    type="button"
                                                    title="Ver documento"
                                                    onClick={() => setViendo(d)}
                                                    className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-500 transition hover:bg-gray-50"
                                                >
                                                    <i className="dx-icon-download" />
                                                </button>
                                                <button
                                                    type="button"
                                                    title="Seguimiento"
                                                    onClick={() => setSeguimiento(d)}
                                                    className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-500 transition hover:bg-gray-50"
                                                >
                                                    <i className="dx-icon-eyeopen" />
                                                </button>
                                                {est === "BORRADOR" && (
                                                    <button
                                                        type="button"
                                                        title="Enviar a firma"
                                                        disabled={enviandoId === d.id}
                                                        onClick={() => enviarBorrador(d)}
                                                        className="flex h-8 w-8 items-center justify-center rounded-md border border-blue-200 text-blue-600 transition hover:bg-blue-50 disabled:opacity-40"
                                                    >
                                                        <i className="dx-icon-email" />
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    title="Anular"
                                                    disabled={!puedeAnularse(est)}
                                                    onClick={() => abrirAnular(d)}
                                                    className="flex h-8 w-8 items-center justify-center rounded-md border border-red-200 text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                                                >
                                                    <i className="dx-icon-close" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                    </tbody>
                </table>
            </div>

            {/* Paginación */}
            <div className="flex flex-col items-center justify-between gap-3 text-sm text-gray-500 sm:flex-row">
                <span>
                    {filtrados.length === 0
                        ? "Mostrando 0 documentos"
                        : `Mostrando ${(pageActual - 1) * pageSize + 1} a ${Math.min(
                              pageActual * pageSize,
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

            {/* Leyenda - Estado */}
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-gray-700">Leyenda - Estado</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {(Object.keys(ESTADO_META) as EstadoVista[]).map((k) => (
                        <div key={k} className="flex items-start gap-3">
                            <span className={`mt-0.5 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${ESTADO_META[k].clase}`}>
                                {k}
                            </span>
                            <p className="text-xs text-gray-400">{ESTADO_META[k].desc}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Ver documento */}
            <Popup
                visible={!!viendo}
                onHiding={() => setViendo(null)}
                showTitle={false}
                dragEnabled={false}
                width="92vw"
                maxWidth={1000}
                height="90vh"
            >
                {viendo ? (
                    <div className="flex h-full flex-col">
                        <div className="flex items-center justify-between border-b px-4 py-2">
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-gray-800">{viendo.asunto}</p>
                                <p className="text-xs text-gray-400">
                                    {viendo.nombreArchivo} · {estadoVista(viendo)}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button text="Descargar" icon="download" stylingMode="outlined" onClick={() => descargar(viendo)} />
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
                                <div className="flex h-full items-center justify-center text-sm text-gray-500">
                                    Cargando documento…
                                </div>
                            ) : (
                                <object
                                    data={`${viendoUrl}#toolbar=1&navpanes=0&view=FitH`}
                                    type="application/pdf"
                                    className="h-full w-full"
                                >
                                    <div className="flex h-full items-center justify-center p-6 text-center text-sm text-gray-500">
                                        Tu navegador no puede previsualizar el PDF aquí. Usa "Descargar".
                                    </div>
                                </object>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="p-6 text-sm text-gray-400">Cargando…</div>
                )}
            </Popup>

            <SeguimientoDocumentoModal doc={seguimiento} onClose={() => setSeguimiento(null)} />

            {/* Anular */}
            <Popup
                visible={!!anulando}
                onHiding={() => setAnulando(null)}
                showCloseButton
                dragEnabled
                width={460}
                height="auto"
                title="Anular documento"
            >
                <div className="flex flex-col gap-3 p-2">
                    <p className="text-sm text-gray-600">
                        Vas a anular el proceso de firma de <strong>{anulando?.asunto}</strong>. Los firmantes serán
                        notificados y el documento ya no podrá firmarse.
                    </p>
                    <label className="text-sm font-medium text-gray-700">
                        Motivo de la anulación <span className="font-normal text-gray-400">(obligatorio)</span>
                    </label>
                    <textarea
                        value={motivoAnular}
                        onChange={(e) => setMotivoAnular(e.target.value)}
                        rows={3}
                        placeholder="Explica por qué anulas este documento…"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                    />
                    <div className="flex justify-end gap-2">
                        <Button text="Cancelar" stylingMode="outlined" onClick={() => setAnulando(null)} disabled={enviandoAnular} />
                        <Button
                            text={enviandoAnular ? "Anulando…" : "Anular"}
                            type="danger"
                            stylingMode="contained"
                            onClick={confirmarAnular}
                            disabled={enviandoAnular || !motivoAnular.trim()}
                        />
                    </div>
                </div>
            </Popup>
        </div>
    );
};

export default DocumentosGenerados;
