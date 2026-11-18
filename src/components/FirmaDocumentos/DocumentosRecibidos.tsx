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
    /** Abre la pantalla "Firmar documento" para este documento. */
    onAbrirFirma: (doc: DocumentoFirma) => void;
    onRechazar: (doc: DocumentoFirma, motivo: string) => Promise<any>;
};

type TipoKey = "unica" | "varios" | "auditoria";

const TIPO_META: Record<TipoKey, { sigla: string; clase: string; label: string; desc: string }> = {
    unica: {
        sigla: "SES",
        clase: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200",
        label: "Firma única",
        desc: "Una sola persona debe firmar.",
    },
    varios: {
        sigla: "VARIOS",
        clase: "bg-purple-50 text-purple-600 ring-1 ring-purple-200",
        label: "Firma varios",
        desc: "Varios destinatarios deben firmar.",
    },
    auditoria: {
        sigla: "AUD",
        clase: "bg-amber-50 text-amber-600 ring-1 ring-amber-200",
        label: "Auditoría",
        desc: "Firma con trazabilidad completa.",
    },
};

const tipoDe = (d: DocumentoFirma): TipoKey =>
    d.tipoSolicitud && d.tipoSolicitud in TIPO_META ? (d.tipoSolicitud as TipoKey) : "unica";

const PAGE_SIZES = [10, 25, 50];

const IconAccion: React.FC<{
    icon: string;
    title: string;
    onClick: () => void;
    disabled?: boolean;
    danger?: boolean;
}> = ({ icon, title, onClick, disabled, danger }) => (
    <button
        type="button"
        title={title}
        onClick={onClick}
        disabled={disabled}
        className={`flex h-8 w-8 items-center justify-center rounded-md border transition disabled:cursor-not-allowed disabled:opacity-40 ${
            danger
                ? "border-red-200 text-red-500 hover:bg-red-50"
                : "border-gray-200 text-gray-500 hover:bg-gray-50"
        }`}
    >
        <i className={`dx-icon-${icon}`} />
    </button>
);

/**
 * "Documentos recibidos": listado de solicitudes de firma dirigidas al usuario.
 * Tabla con búsqueda, filtro por tipo de firma, paginación y acciones
 * (descargar, vista previa, firmar, rechazar/anular).
 */
const DocumentosRecibidos: React.FC<Props> = ({ documentos, loading, onRefrescar, onAbrirFirma, onRechazar }) => {
    const [search, setSearch] = useState("");
    const [tipoFiltro, setTipoFiltro] = useState<"todos" | TipoKey>("todos");
    const [mostrarFiltros, setMostrarFiltros] = useState(false);
    const [pageSize, setPageSize] = useState(10);
    const [page, setPage] = useState(1);
    const [seleccion, setSeleccion] = useState<Set<number>>(new Set());

    const [rechazando, setRechazando] = useState<DocumentoFirma | null>(null);
    const [motivo, setMotivo] = useState("");
    const [enviandoRechazo, setEnviandoRechazo] = useState(false);
    const [seguimiento, setSeguimiento] = useState<DocumentoFirma | null>(null);

    const filtrados = useMemo(() => {
        const q = search.trim().toLowerCase();
        return documentos.filter((d) => {
            if (tipoFiltro !== "todos" && tipoDe(d) !== tipoFiltro) return false;
            if (!q) return true;
            return [d.asunto, d.comentario, d.creador.nombres, d.codigoDocumento]
                .filter(Boolean)
                .some((s) => String(s).toLowerCase().includes(q));
        });
    }, [documentos, search, tipoFiltro]);

    const totalPaginas = Math.max(1, Math.ceil(filtrados.length / pageSize));
    const pageActual = Math.min(page, totalPaginas);
    const visibles = filtrados.slice((pageActual - 1) * pageSize, pageActual * pageSize);

    useEffect(() => {
        setPage(1);
    }, [search, tipoFiltro, pageSize]);

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

    const descargar = async (d: DocumentoFirma) => {
        try {
            const blobUrl = await descargarPdfComoBlobUrl(d.pdfFirmadoUrl || d.pdfOriginalUrl);
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

    const abrirRechazo = (d: DocumentoFirma) => {
        setMotivo("");
        setRechazando(d);
    };

    const confirmarRechazo = async () => {
        if (!rechazando) return;
        if (!motivo.trim()) {
            notify("Debes indicar el motivo del rechazo.", "warning", 3000);
            return;
        }
        setEnviandoRechazo(true);
        try {
            await onRechazar(rechazando, motivo.trim());
            notify("Solicitud de firma rechazada.", "success", 3000);
            setRechazando(null);
        } catch (e: any) {
            notify(e?.message || "No se pudo rechazar el documento.", "error", 3500);
        } finally {
            setEnviandoRechazo(false);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Encabezado */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-gray-800">Documentos recibidos</h2>
                    <p className="text-sm text-gray-500">Listado de documentos que te han enviado para tu firma.</p>
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
                    <span className="text-xs font-medium text-gray-500">Tipo de firma:</span>
                    {(["todos", "unica", "varios", "auditoria"] as const).map((k) => (
                        <button
                            key={k}
                            type="button"
                            onClick={() => setTipoFiltro(k)}
                            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                                tipoFiltro === k
                                    ? "bg-gray-800 text-white"
                                    : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100"
                            }`}
                        >
                            {k === "todos" ? "Todos" : TIPO_META[k].sigla}
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
                <table className="w-full min-w-[900px] text-sm">
                    <thead>
                        <tr className="border-b bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                            <th className="w-10 px-3 py-3">
                                <input type="checkbox" checked={todosVisiblesSel} onChange={toggleSelTodos} />
                            </th>
                            <th className="px-3 py-3">Tipo firma</th>
                            <th className="px-3 py-3">Asunto</th>
                            <th className="px-3 py-3">Enviado por</th>
                            <th className="px-3 py-3">Fecha envío</th>
                            <th className="px-3 py-3">Vencimiento</th>
                            <th className="px-3 py-3">ID documento</th>
                            <th className="px-3 py-3 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr>
                                <td colSpan={8} className="px-3 py-10 text-center text-gray-400">
                                    Cargando documentos…
                                </td>
                            </tr>
                        )}
                        {!loading && visibles.length === 0 && (
                            <tr>
                                <td colSpan={8} className="px-3 py-10 text-center text-gray-400">
                                    No hay documentos que coincidan.
                                </td>
                            </tr>
                        )}
                        {!loading &&
                            visibles.map((d) => {
                                const meta = TIPO_META[tipoDe(d)];
                                // `puedeFirmar` viene de /firmas/solicitudes/recibidos (turno, vencimiento, etc.);
                                // si el backend no lo informa, se usa el estado como resguardo. "EnProceso"
                                // (ya firmó alguien, pero no necesariamente este destinatario) sigue contando
                                // como pendiente para este resguardo.
                                const pendiente = d.puedeFirmar ?? (d.estado === "Pendiente" || d.estado === "EnProceso");
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
                                            <span
                                                className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold ${meta.clase}`}
                                            >
                                                {meta.sigla}
                                            </span>
                                        </td>
                                        <td className="max-w-[280px] px-3 py-3 align-top">
                                            <p className="font-medium text-gray-800">{d.asunto}</p>
                                            {d.tipoDocumentoNombre && (
                                                <p className="text-[11px] text-gray-400">{d.tipoDocumentoNombre}</p>
                                            )}
                                            {d.comentario && (
                                                <p className="truncate text-xs text-gray-400">{d.comentario}</p>
                                            )}
                                            {d.estado !== "Pendiente" && d.estado !== "EnProceso" && (
                                                <span
                                                    className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                                        d.estado === "Firmado"
                                                            ? "bg-emerald-50 text-emerald-700"
                                                            : "bg-red-50 text-red-700"
                                                    }`}
                                                >
                                                    {d.estado}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-3 align-top text-gray-700">{d.creador.nombres}</td>
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
                                            <div className="flex items-center justify-center gap-1.5">
                                                <IconAccion
                                                    icon="download"
                                                    title="Descargar"
                                                    onClick={() => descargar(d)}
                                                />
                                                <IconAccion
                                                    icon="eyeopen"
                                                    title="Seguimiento del documento"
                                                    onClick={() => setSeguimiento(d)}
                                                />
                                                <IconAccion
                                                    icon="edit"
                                                    title="Firmar"
                                                    onClick={() => onAbrirFirma(d)}
                                                    disabled={!pendiente}
                                                />
                                                <IconAccion
                                                    icon="trash"
                                                    title="Rechazar"
                                                    onClick={() => abrirRechazo(d)}
                                                    disabled={!pendiente}
                                                    danger
                                                />
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
                                n === pageActual
                                    ? "border-blue-500 bg-blue-500 text-white"
                                    : "border-gray-300 hover:bg-gray-50"
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

            {/* Leyenda - Tipo de firma */}
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-gray-700">Leyenda - Tipo de firma</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {(Object.keys(TIPO_META) as TipoKey[]).map((k) => (
                        <div key={k} className="flex items-start gap-3">
                            <span
                                className={`mt-0.5 inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold ${TIPO_META[k].clase}`}
                            >
                                {TIPO_META[k].sigla}
                            </span>
                            <div>
                                <p className="text-sm font-medium text-gray-700">{TIPO_META[k].label}</p>
                                <p className="text-xs text-gray-400">{TIPO_META[k].desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Leyenda - Acciones */}
            <div className="grid grid-cols-1 gap-4 rounded-2xl border bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
                {[
                    { icon: "download", title: "Descargar", desc: "Descarga el documento en PDF." },
                    { icon: "eyeopen", title: "Seguimiento", desc: "Consulta el estado y los firmantes del documento." },
                    { icon: "edit", title: "Firmar", desc: "Firma el documento electrónicamente." },
                    { icon: "trash", title: "Rechazar", desc: "Rechaza la solicitud de firma (requiere indicar un motivo)." },
                ].map((a) => (
                    <div key={a.title} className="flex items-start gap-3">
                        <span
                            className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-md border ${
                                a.icon === "trash" ? "border-red-200 text-red-500" : "border-gray-200 text-gray-500"
                            }`}
                        >
                            <i className={`dx-icon-${a.icon}`} />
                        </span>
                        <div>
                            <p className="text-sm font-medium text-gray-700">{a.title}</p>
                            <p className="text-xs text-gray-400">{a.desc}</p>
                        </div>
                    </div>
                ))}
            </div>

            <SeguimientoDocumentoModal doc={seguimiento} onClose={() => setSeguimiento(null)} />

            {/* Rechazar */}
            <Popup
                visible={!!rechazando}
                onHiding={() => setRechazando(null)}
                showCloseButton
                dragEnabled
                width={460}
                height="auto"
                title="Rechazar solicitud"
            >
                <div className="flex flex-col gap-3 p-2">
                    <p className="text-sm text-gray-600">
                        Vas a rechazar la solicitud de firma de <strong>{rechazando?.asunto}</strong>. El creador será
                        notificado y el documento no podrá firmarse.
                    </p>
                    <label className="text-sm font-medium text-gray-700">
                        Motivo del rechazo <span className="font-normal text-gray-400">(obligatorio)</span>
                    </label>
                    <textarea
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        rows={3}
                        placeholder="Explica por qué rechazas este documento…"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                    />
                    <div className="flex justify-end gap-2">
                        <Button text="Cancelar" stylingMode="outlined" onClick={() => setRechazando(null)} disabled={enviandoRechazo} />
                        <Button
                            text={enviandoRechazo ? "Rechazando…" : "Rechazar"}
                            type="danger"
                            stylingMode="contained"
                            onClick={confirmarRechazo}
                            disabled={enviandoRechazo || !motivo.trim()}
                        />
                    </div>
                </div>
            </Popup>
        </div>
    );
};

export default DocumentosRecibidos;
