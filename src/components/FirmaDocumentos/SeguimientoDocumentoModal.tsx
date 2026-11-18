import React, { useMemo } from "react";
import { Popup } from "devextreme-react/popup";
import Button from "devextreme-react/button";
import moment from "moment";
import { DestinatarioFirma, DocumentoFirma } from "../../types/FirmaDocumento";

type Props = {
    doc: DocumentoFirma | null;
    onClose: () => void;
    /**
     * true cuando `doc.destinatarios` fue sintetizado a partir de datos que NO
     * traen estado/fecha por firmante (p. ej. `GET /firmas/seguimiento`, que
     * solo da nombres de receptores). En ese caso no se puede saber quién ya
     * firmó y quién no, así que la tabla de firmantes se simplifica en vez de
     * mostrar un estado por persona inventado/incorrecto.
     */
    soloResumen?: boolean;
};

type EstadoFirmante = "Firmado" | "En espera" | "Pendiente" | "Rechazado";

const BADGE: Record<EstadoFirmante, string> = {
    Firmado: "bg-emerald-50 text-emerald-600",
    "En espera": "bg-purple-50 text-purple-600",
    Pendiente: "bg-gray-100 text-gray-500",
    Rechazado: "bg-red-50 text-red-600",
};

const circuloPaso = (estado: "done" | "active" | "error" | "upcoming") => {
    switch (estado) {
        case "done":
            return "bg-emerald-500 text-white";
        case "active":
            return "bg-purple-500 text-white";
        case "error":
            return "bg-red-500 text-white";
        default:
            return "bg-gray-200 text-gray-400";
    }
};

const fechaHora = (iso?: string) =>
    iso ? (
        <>
            {moment(iso).format("DD/MM/YYYY")}
            <span className="block text-gray-400">{moment(iso).format("hh:mm a")}</span>
        </>
    ) : (
        <span className="text-gray-400">—</span>
    );

/**
 * Modal "Seguimiento del documento": resumen, estado general (stepper) y la
 * lista de firmantes por orden. Se abre desde el ícono 👁 en "Documentos
 * Recibidos".
 */
const SeguimientoDocumentoModal: React.FC<Props> = ({ doc, onClose, soloResumen }) => {
    const firmantes: DestinatarioFirma[] = useMemo(() => {
        if (!doc) return [];
        if (doc.destinatarios?.length) return [...doc.destinatarios].sort((a, b) => a.orden - b.orden);
        return [
            {
                id: doc.firmante.id,
                nombres: doc.firmante.nombres,
                orden: 1,
                estado:
                    doc.estado === "Firmado" ? "Firmado" : doc.estado === "Rechazado" ? "Rechazado" : "Pendiente",
                fechaFirma: doc.fechaFirma,
            },
        ];
    }, [doc]);

    const total = firmantes.length;
    const firmados = firmantes.filter((f) => f.estado === "Firmado").length;
    const turnoActual =
        firmantes.find((f) => f.estado !== "Firmado" && f.estado !== "Rechazado")?.orden ?? total + 1;
    const yo = firmantes.find((f) => f.id === "me");
    const miOrden = yo?.orden;

    const completado = doc?.estado === "Firmado";
    // No basta con mirar `doc.estado`: si el backend todavía no propaga el
    // rechazo de un destinatario al estado agregado del documento, esto
    // seguía mostrando "En proceso" aunque un firmante ya hubiera rechazado.
    // Con que CUALQUIERA de las dos señales diga "rechazado" alcanza.
    const firmanteQueRechazo = firmantes.find((f) => f.estado === "Rechazado");
    const rechazado = doc?.estado === "Rechazado" || !!firmanteQueRechazo;

    const estadoDe = (f: DestinatarioFirma): EstadoFirmante => {
        if (f.estado === "Firmado") return "Firmado";
        if (f.estado === "Rechazado") return "Rechazado";
        return f.orden === turnoActual ? "En espera" : "Pendiente";
    };

    const detalleDe = (f: DestinatarioFirma): { texto: string; icono: string; color: string } => {
        const e = estadoDe(f);
        if (e === "Firmado") return { texto: "Firmó el documento", icono: "check", color: "text-emerald-500" };
        if (e === "Rechazado") return { texto: "Rechazó el documento", icono: "close", color: "text-red-500" };
        if (e === "En espera")
            return {
                texto: f.id === "me" ? "Pendiente tu firma" : "Pendiente de firma",
                icono: "clock",
                color: "text-purple-500",
            };
        return { texto: "Aún no ha revisado", icono: "clock", color: "text-gray-400" };
    };

    const pendientesDespuesDeMi = firmantes.filter(
        (f) => f.orden > (miOrden ?? 0) && f.estado !== "Firmado"
    ).length;

    const pasos: { titulo: string; sub: string; icono: string; estado: "done" | "active" | "error" | "upcoming" }[] =
        [
            {
                titulo: "Solicitado",
                sub: doc ? moment(doc.fechaCreacion).format("DD/MM/YYYY hh:mm a") : "",
                icono: "check",
                estado: "done",
            },
            {
                titulo: rechazado ? "Rechazado" : "En proceso",
                sub: rechazado
                    ? "La solicitud fue rechazada"
                    : miOrden
                    ? `Estás en el orden ${miOrden}`
                    : "Firmas en curso",
                icono: rechazado ? "close" : "clock",
                estado: completado ? "done" : rechazado ? "error" : "active",
            },
            {
                titulo: "Firmas restantes",
                sub: soloResumen
                    ? "No disponible por firmante"
                    : `${miOrden ? pendientesDespuesDeMi : total - firmados} pendiente${
                          (miOrden ? pendientesDespuesDeMi : total - firmados) === 1 ? "" : "s"
                      }`,
                icono: "group",
                estado: completado ? "done" : "upcoming",
            },
            {
                titulo: "Completado",
                sub: completado && doc?.fechaFirma ? moment(doc.fechaFirma).format("DD/MM/YYYY hh:mm a") : "Pendiente",
                icono: "check",
                estado: completado ? "done" : "upcoming",
            },
        ];

    return (
        <Popup
            visible={!!doc}
            onHiding={onClose}
            showTitle={false}
            dragEnabled={false}
            width="92vw"
            maxWidth={680}
            height="auto"
            maxHeight="92vh"
        >
            {doc ? (
                <div className="flex max-h-[86vh] flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b px-5 py-3">
                        <h2 className="text-lg font-semibold text-gray-800">Seguimiento del documento</h2>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-8 w-8 items-center justify-center rounded text-gray-400 hover:bg-gray-100"
                            title="Cerrar"
                        >
                            <i className="dx-icon-close" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-5 py-4">
                        {rechazado && (
                            <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                                <i className="dx-icon-warning mt-0.5 text-red-500" />
                                <div>
                                    <p className="text-sm font-semibold text-red-700">
                                        Solicitud rechazada
                                        {firmanteQueRechazo ? ` por ${firmanteQueRechazo.nombres}` : ""}
                                    </p>
                                    <p className="text-xs text-red-600">
                                        {doc.motivoRechazo || firmanteQueRechazo?.motivoRechazo || "El documento no se firmará."}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Resumen */}
                        <section className="rounded-xl border p-4">
                            <h3 className="mb-3 text-sm font-semibold text-gray-700">Resumen del documento</h3>
                            <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
                                <Dato label="Asunto">{doc.asunto}</Dato>
                                <Dato label="Tipo de documento">{doc.tipoDocumentoNombre || "—"}</Dato>
                                <Dato label="Cantidad de firmas requeridas">
                                    <span className="inline-flex items-center gap-1">
                                        <i className="dx-icon-group text-gray-400" /> {total}
                                    </span>
                                </Dato>
                                <Dato label="Fecha de solicitud de firma">
                                    <span className="inline-flex items-center gap-1">
                                        <i className="dx-icon-event text-gray-400" />
                                        {moment(doc.fechaCreacion).format("DD/MM/YYYY hh:mm a")}
                                    </span>
                                </Dato>
                                <Dato label="Comentario">{doc.comentario || "—"}</Dato>
                                {doc.tipoSolicitud === "varios" && doc.firmaSecuencial !== undefined && (
                                    <Dato label="Orden de firma">
                                        {doc.firmaSecuencial ? "Requerido (por turnos)" : "No requerido (cualquiera puede firmar)"}
                                    </Dato>
                                )}
                                <Dato label="Orden de tu firma">
                                    {miOrden ? (
                                        <span className="inline-flex items-center gap-2">
                                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 text-[11px] font-bold text-purple-600">
                                                {miOrden}º
                                            </span>
                                            <span
                                                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                                    BADGE[estadoDe(yo as DestinatarioFirma)]
                                                }`}
                                            >
                                                {estadoDe(yo as DestinatarioFirma)}
                                            </span>
                                        </span>
                                    ) : (
                                        "—"
                                    )}
                                </Dato>
                                <Dato label="ID Documento">
                                    <span className="break-all font-mono text-xs text-gray-500">
                                        {doc.codigoDocumento || doc.id}
                                    </span>
                                </Dato>
                            </div>
                        </section>

                        {/* Estado general (stepper) */}
                        <section className="mt-4 rounded-xl border p-4">
                            <h3 className="mb-4 text-sm font-semibold text-gray-700">Estado general del documento</h3>
                            <div className="flex items-start">
                                {pasos.map((p, i) => (
                                    <React.Fragment key={p.titulo}>
                                        <div className="flex flex-1 flex-col items-center px-1 text-center">
                                            <div
                                                className={`flex h-9 w-9 items-center justify-center rounded-full ${circuloPaso(
                                                    p.estado
                                                )}`}
                                            >
                                                <i className={`dx-icon-${p.icono}`} />
                                            </div>
                                            <p className="mt-1.5 text-xs font-medium text-gray-700">{p.titulo}</p>
                                            <p className="text-[11px] leading-tight text-gray-400">{p.sub}</p>
                                        </div>
                                        {i < pasos.length - 1 && <div className="mt-4 h-px w-6 shrink-0 bg-gray-200" />}
                                    </React.Fragment>
                                ))}
                            </div>
                        </section>

                        {/* Firmantes */}
                        <section className="mt-4 rounded-xl border p-4">
                            <h3 className="mb-3 text-sm font-semibold text-gray-700">
                                Firmantes del documento (por orden)
                            </h3>
                            {soloResumen && (
                                <p className="mb-3 flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
                                    <i className="dx-icon-info mt-0.5" />
                                    Esta vista no informa el estado individual de cada firmante; arriba se muestra el
                                    estado general del documento.
                                </p>
                            )}
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[520px] text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                                            <th className="py-2 pr-2">Orden</th>
                                            <th className="py-2 pr-2">Firmante</th>
                                            {!soloResumen && (
                                                <>
                                                    <th className="py-2 pr-2">Estado</th>
                                                    <th className="py-2 pr-2">Fecha / hora</th>
                                                    <th className="py-2 pr-2">Detalle</th>
                                                </>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {firmantes.map((f) => {
                                            const est = estadoDe(f);
                                            const det = detalleDe(f);
                                            const esYo = f.id === "me";
                                            return (
                                                <tr
                                                    key={`${f.id}-${f.orden}`}
                                                    className={`border-b last:border-0 ${esYo ? "bg-purple-50" : ""}`}
                                                >
                                                    <td className="py-2 pr-2">
                                                        <span
                                                            className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                                                                esYo
                                                                    ? "bg-purple-500 text-white"
                                                                    : "bg-gray-100 text-gray-500"
                                                            }`}
                                                        >
                                                            {f.orden}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 pr-2">
                                                        <p className="font-medium text-gray-700">
                                                            {f.nombres}
                                                            {esYo && " (Tú)"}
                                                        </p>
                                                        {f.cargo && (
                                                            <p className="text-xs text-gray-400">{f.cargo}</p>
                                                        )}
                                                    </td>
                                                    {!soloResumen && (
                                                        <>
                                                            <td className="py-2 pr-2">
                                                                <span
                                                                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${BADGE[est]}`}
                                                                >
                                                                    {est}
                                                                </span>
                                                            </td>
                                                            <td className="whitespace-nowrap py-2 pr-2 text-gray-600">
                                                                {fechaHora(f.fechaFirma)}
                                                            </td>
                                                            <td className="py-2 pr-2">
                                                                <span className="inline-flex items-center gap-1 text-gray-600">
                                                                    {det.texto}
                                                                    <i className={`dx-icon-${det.icono} ${det.color}`} />
                                                                </span>
                                                                {est === "Rechazado" && f.motivoRechazo && (
                                                                    <p className="mt-0.5 max-w-[220px] text-xs italic text-red-500">
                                                                        "{f.motivoRechazo}"
                                                                    </p>
                                                                )}
                                                            </td>
                                                        </>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between gap-3 border-t px-5 py-3">
                        <p className="flex items-center gap-2 text-xs text-gray-500">
                            <i className="dx-icon-info" />
                            {rechazado
                                ? "La solicitud fue rechazada; el documento no se firmará."
                                : "El documento se completará cuando todos los firmantes hayan firmado."}
                        </p>
                        <Button text="Cerrar" stylingMode="outlined" onClick={onClose} />
                    </div>
                </div>
            ) : (
                <div className="p-6 text-sm text-gray-400">Cargando…</div>
            )}
        </Popup>
    );
};

const Dato: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
        <div className="text-sm text-gray-700">{children}</div>
    </div>
);

export default SeguimientoDocumentoModal;
