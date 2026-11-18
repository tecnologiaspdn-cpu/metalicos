import React, { useMemo, useRef, useState } from "react";
import SelectBox from "devextreme-react/select-box";
import notify from "devextreme/ui/notify";
import {
    ActorFirma,
    CrearDocumentoFirmaPayload,
    DOCUMENTO_PDF_MAX_BYTES,
    TipoDocumentoFirma,
    TipoSolicitudFirma,
} from "../../types/FirmaDocumento";

type Props = {
    /** Tipo elegido en la pantalla previa "Solicitud Firma". */
    solicitudTipo?: TipoSolicitudFirma | null;
    /** Personal de la empresa + "(Yo)" para elegir a los firmantes. */
    opcionesFirmante: ActorFirma[];
    loadingPersonal: boolean;
    /** Catálogo del desplegable "Tipo de documento" (`GET firmas/tipos-documento`). */
    tiposDocumento: TipoDocumentoFirma[];
    loadingTiposDocumento: boolean;
    /** Vuelve a la pantalla de selección de tipo de firma. */
    onVolver?: () => void;
    /** Persiste el documento. `enviar = false` → borrador; `true` → inicia la firma. */
    onGuardar: (payload: CrearDocumentoFirmaPayload) => Promise<any>;
    /** Se llama tras guardar correctamente (enviado = true si se envió). */
    onGuardado: (enviado: boolean) => void;
};

const subtitulo = (a?: ActorFirma) => [a?.cargo, a?.area].filter(Boolean).join(" · ");

const personaItem = (data: ActorFirma) => (
    <div className="flex flex-col">
        <span className="text-sm text-gray-700">{data.nombres}</span>
        {subtitulo(data) && <span className="text-xs text-gray-400">{subtitulo(data)}</span>}
    </div>
);

/**
 * Pantalla "Nuevo Documento" para los flujos "Firma Única" y "Firma Varios".
 *
 * - "Guardar borrador": registra el documento en estado Borrador (no se envía,
 *   el destinatario no lo recibe) y se puede completar/enviar más tarde.
 * - "Enviar documento": inicia el proceso de firma. Una vez enviado ya no se
 *   podrá modificar (solo anular, desde otra pantalla).
 */
const NuevoDocumentoFirma: React.FC<Props> = ({
    solicitudTipo,
    opcionesFirmante,
    loadingPersonal,
    tiposDocumento,
    loadingTiposDocumento,
    onVolver,
    onGuardar,
    onGuardado,
}) => {
    const tipo: "unica" | "varios" = solicitudTipo === "varios" ? "varios" : "unica";
    const esVarios = tipo === "varios";

    const T = esVarios
        ? {
              etiqueta: "Firma Varios",
              badge: "bg-emerald-100 text-emerald-700",
              badgeTxt: "FIRMA VARIOS",
              btn: "bg-emerald-600 hover:bg-emerald-700",
              info: "bg-emerald-50 text-emerald-700",
              drop: "border-emerald-300 bg-emerald-50/40",
          }
        : {
              etiqueta: "Firma Única",
              badge: "bg-blue-100 text-blue-700",
              badgeTxt: "FIRMA ÚNICA",
              btn: "bg-blue-600 hover:bg-blue-700",
              info: "bg-blue-50 text-blue-700",
              drop: "border-blue-300 bg-blue-50/40",
          };

    const inputRef = useRef<HTMLInputElement>(null);

    const [asunto, setAsunto] = useState("");
    const [comentario, setComentario] = useState("");
    const [archivo, setArchivo] = useState<File | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [tipoDocumentoId, setTipoDocumentoId] = useState<number | null>(null);

    // Firma única
    const [destinatarioId, setDestinatarioId] = useState<number | "me" | null>(null);
    // Firma varios
    const [destinatarios, setDestinatarios] = useState<ActorFirma[]>([]);
    const [candidatoId, setCandidatoId] = useState<number | "me" | null>(null);
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    // Solo aplica a "varios": si deben firmar respetando el orden de la lista
    // o si cualquiera puede firmar sin esperar turno.
    const [firmaSecuencial, setFirmaSecuencial] = useState(true);

    const [accion, setAccion] = useState<"borrador" | "enviar" | null>(null);

    const opcionesDisponibles = useMemo(
        () => opcionesFirmante.filter((o) => !destinatarios.some((d) => d.id === o.id)),
        [opcionesFirmante, destinatarios]
    );

    const handleFile = (file?: File | null) => {
        if (!file) return;
        const esPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        if (!esPdf) return notify("Solo se permiten archivos PDF.", "error", 3000);
        if (file.size > DOCUMENTO_PDF_MAX_BYTES) {
            return notify("El PDF supera el tamaño máximo de 50 MB.", "error", 3500);
        }
        setArchivo(file);
    };

    const moverA = (from: number, to: number) => {
        setDestinatarios((prev) => {
            if (to < 0 || to >= prev.length || to === from) return prev;
            const arr = [...prev];
            const [m] = arr.splice(from, 1);
            arr.splice(to, 0, m);
            return arr;
        });
    };

    const onRowDrop = (i: number) => {
        if (dragIndex !== null) moverA(dragIndex, i);
        setDragIndex(null);
    };

    const agregarPersona = () => {
        if (candidatoId == null) return notify("Selecciona una persona para agregar.", "warning", 2000);
        const p = opcionesFirmante.find((o) => o.id === candidatoId);
        if (!p) return;
        if (destinatarios.some((d) => d.id === p.id)) {
            return notify("Esa persona ya está en la lista.", "info", 2000);
        }
        setDestinatarios((prev) => [...prev, p]);
        setCandidatoId(null);
    };

    const quitarPersona = (id: number | "me") =>
        setDestinatarios((prev) => prev.filter((d) => d.id !== id));

    const construirPayload = (enviar: boolean): CrearDocumentoFirmaPayload | null => {
        if (!asunto.trim()) {
            notify("El asunto es obligatorio.", "warning", 2500);
            return null;
        }
        if (!archivo) {
            notify("Adjunta el archivo PDF del documento.", "warning", 2500);
            return null;
        }
        if (!tipoDocumentoId) {
            notify("Selecciona el tipo de documento.", "warning", 2500);
            return null;
        }

        let elegidos: ActorFirma[] = [];
        if (tipo === "unica") {
            const d = opcionesFirmante.find((o) => o.id === destinatarioId);
            if (enviar && !d) {
                notify("Selecciona el destinatario que debe firmar.", "warning", 2500);
                return null;
            }
            elegidos = d ? [d] : [];
        } else {
            if (enviar && destinatarios.length === 0) {
                notify("Agrega al menos un destinatario.", "warning", 2500);
                return null;
            }
            elegidos = destinatarios;
        }

        return {
            tipoSolicitud: tipo,
            asunto: asunto.trim(),
            comentario: comentario.trim() || undefined,
            archivo,
            destinatarios: elegidos.map((d) => ({
                id: d.id,
                nombres: d.nombres,
                cargo: d.cargo,
                area: d.area,
            })),
            enviar,
            tipoDocumento: tipoDocumentoId,
            // En "firma única" el orden no aplica (un solo firmante): se envía
            // siempre `true`, como en el ejemplo real del backend.
            firmaSecuencial: esVarios ? firmaSecuencial : true,
        };
    };

    const guardar = async (enviar: boolean) => {
        const payload = construirPayload(enviar);
        if (!payload) return;
        setAccion(enviar ? "enviar" : "borrador");
        try {
            await onGuardar(payload);
            notify(
                enviar
                    ? "Documento enviado. Se inició el proceso de firma."
                    : "Borrador guardado. Podrás completarlo o enviarlo más tarde.",
                "success",
                3000
            );
            onGuardado(enviar);
        } catch (e: any) {
            notify(e?.message || "No se pudo guardar el documento.", "error", 3500);
        } finally {
            setAccion(null);
        }
    };

    const ocupado = accion !== null;

    return (
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
            {onVolver && (
                <button
                    type="button"
                    onClick={onVolver}
                    disabled={ocupado}
                    className="flex w-fit items-center gap-1 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
                >
                    <i className="dx-icon-chevronleft" /> Volver
                </button>
            )}

            <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-gray-800">Nuevo Documento - {T.etiqueta}</h2>
                <span className={`rounded px-2 py-0.5 text-[10px] font-bold tracking-wide ${T.badge}`}>
                    {T.badgeTxt}
                </span>
            </div>

            {/* ── Información del documento ── */}
            <section className="rounded-2xl border bg-white p-5 shadow-sm">
                <h3 className="mb-4 text-sm font-semibold text-gray-700">Información del documento</h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Asunto <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={asunto}
                            onChange={(e) => setAsunto(e.target.value)}
                            placeholder="Ej: Contrato de mantenimiento"
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Comentario <span className="font-normal text-gray-400">(opcional)</span>
                        </label>
                        <input
                            type="text"
                            value={comentario}
                            onChange={(e) => setComentario(e.target.value)}
                            placeholder="Comentario adicional (opcional)"
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Tipo de documento <span className="text-red-500">*</span>
                        </label>
                        <SelectBox
                            dataSource={tiposDocumento}
                            valueExpr="id"
                            displayExpr="nombre"
                            value={tipoDocumentoId}
                            placeholder="Selecciona el tipo de documento"
                            disabled={loadingTiposDocumento}
                            onValueChanged={(e: any) => setTipoDocumentoId(e.value ?? null)}
                        />
                    </div>
                </div>

                <div className="mt-4">
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                        Archivo del documento (PDF) <span className="text-red-500">*</span>
                    </label>
                    <div
                        onDragOver={(e) => {
                            e.preventDefault();
                            setDragOver(true);
                        }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={(e) => {
                            e.preventDefault();
                            setDragOver(false);
                            handleFile(e.dataTransfer.files?.[0]);
                        }}
                        className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition ${
                            dragOver ? "border-gray-500 bg-gray-50" : T.drop
                        }`}
                    >
                        {archivo ? (
                            <div className="flex items-center gap-3">
                                <i className="dx-icon-pdffile text-2xl text-red-500" />
                                <div className="text-left">
                                    <p className="text-sm font-medium text-gray-700">{archivo.name}</p>
                                    <p className="text-xs text-gray-400">
                                        {(archivo.size / 1024 / 1024).toFixed(2)} MB
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setArchivo(null)}
                                    className="ml-2 text-gray-400 hover:text-red-500"
                                    title="Quitar archivo"
                                >
                                    <i className="dx-icon-trash" />
                                </button>
                            </div>
                        ) : (
                            <>
                                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-gray-400 shadow-sm">
                                    <i className="dx-icon-upload text-xl" />
                                </span>
                                <p className="text-sm text-gray-500">Arrastra tu archivo PDF aquí o</p>
                                <button
                                    type="button"
                                    onClick={() => inputRef.current?.click()}
                                    className={`rounded-md px-4 py-2 text-sm font-medium text-white transition ${T.btn}`}
                                >
                                    Seleccionar archivo
                                </button>
                                <p className="text-xs text-gray-400">Solo archivos PDF. Máx. 50 MB.</p>
                            </>
                        )}
                        <input
                            ref={inputRef}
                            type="file"
                            accept="application/pdf,.pdf"
                            className="hidden"
                            onChange={(e) => {
                                handleFile(e.target.files?.[0]);
                                e.target.value = "";
                            }}
                        />
                    </div>
                </div>
            </section>

            {/* ── Destinatario(s) ── */}
            <section className="rounded-2xl border bg-white p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-gray-700">
                    {esVarios ? "Destinatarios (varios)" : "Destinatario (solo uno)"}
                </h3>

                <div className={`mb-3 flex items-start gap-2 rounded-lg p-3 text-xs ${T.info}`}>
                    <i className="dx-icon-info mt-0.5" />
                    <span>
                        {esVarios
                            ? "Selecciona una o más personas que deberán firmar este documento."
                            : "Selecciona la persona que deberá firmar este documento."}
                    </span>
                </div>

                {esVarios ? (
                    <>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Buscar personas</label>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <div className="flex-1">
                                <SelectBox
                                    dataSource={opcionesDisponibles}
                                    valueExpr="id"
                                    displayExpr="nombres"
                                    value={candidatoId}
                                    searchEnabled
                                    searchExpr={["nombres", "cargo", "area"]}
                                    placeholder="Buscar por nombre, cargo o área"
                                    disabled={loadingPersonal || ocupado}
                                    onValueChanged={(e: any) => setCandidatoId(e.value)}
                                    itemRender={personaItem}
                                />
                            </div>
                            <button
                                type="button"
                                onClick={agregarPersona}
                                disabled={ocupado}
                                className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50 ${T.btn}`}
                            >
                                + Agregar persona
                            </button>
                        </div>

                        <label className="mt-3 flex items-start gap-2 text-sm text-gray-700">
                            <input
                                type="checkbox"
                                checked={firmaSecuencial}
                                onChange={(e) => setFirmaSecuencial(e.target.checked)}
                                disabled={ocupado}
                                className="mt-0.5"
                            />
                            <span>
                                Requiere firmar en orden
                                <span className="block text-xs font-normal text-gray-400">
                                    {firmaSecuencial
                                        ? "Cada firmante espera su turno según el orden de la lista."
                                        : "Cualquier destinatario puede firmar sin esperar su turno (el orden queda solo como referencia)."}
                                </span>
                            </span>
                        </label>

                        {destinatarios.length > 0 && (
                            <div className="mt-4">
                                <div className="mb-2 flex items-center justify-between text-xs font-medium text-gray-500">
                                    <span>Destinatarios seleccionados</span>
                                    <span className="flex items-center gap-1">
                                        Orden de firma <i className="dx-icon-info" />
                                    </span>
                                </div>
                                <ul className="flex flex-col divide-y rounded-lg border">
                                    {destinatarios.map((d, i) => (
                                        <li
                                            key={d.id}
                                            draggable
                                            onDragStart={() => setDragIndex(i)}
                                            onDragOver={(e) => e.preventDefault()}
                                            onDrop={() => onRowDrop(i)}
                                            className={`flex items-center gap-3 p-2 ${
                                                dragIndex === i ? "opacity-50" : ""
                                            }`}
                                        >
                                            <i className="dx-icon-dragvertical cursor-grab text-gray-300" />
                                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                                                <i className="dx-icon-user" />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium text-gray-700">
                                                    {d.nombres}
                                                </p>
                                                <p className="truncate text-xs text-gray-400">
                                                    {subtitulo(d) || "—"}
                                                </p>
                                            </div>
                                            <select
                                                value={i + 1}
                                                onChange={(e) => moverA(i, Number(e.target.value) - 1)}
                                                className="rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none"
                                                title="Orden de firma"
                                            >
                                                {destinatarios.map((_, n) => (
                                                    <option key={n} value={n + 1}>
                                                        {n + 1}
                                                    </option>
                                                ))}
                                            </select>
                                            <button
                                                type="button"
                                                onClick={() => quitarPersona(d.id)}
                                                className="text-gray-400 hover:text-red-500"
                                                title="Quitar"
                                            >
                                                <i className="dx-icon-trash" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                                <p className="mt-2 flex items-center gap-1 text-xs text-gray-400">
                                    <i className="dx-icon-lock" />
                                    {firmaSecuencial
                                        ? "Puedes arrastrar para cambiar el orden de firma. El orden define quién firma primero."
                                        : "Como no requiere orden, este orden es solo una referencia; cualquiera puede firmar primero."}
                                </p>
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Destinatario <span className="text-red-500">*</span>
                        </label>
                        <SelectBox
                            dataSource={opcionesFirmante}
                            valueExpr="id"
                            displayExpr="nombres"
                            value={destinatarioId}
                            searchEnabled
                            searchExpr={["nombres", "cargo", "area"]}
                            placeholder="Buscar y seleccionar persona"
                            showClearButton
                            disabled={loadingPersonal || ocupado}
                            onValueChanged={(e: any) => setDestinatarioId(e.value ?? null)}
                            itemRender={personaItem}
                        />
                        <p className="mt-2 flex items-center gap-1 text-xs text-gray-400">
                            <i className="dx-icon-lock" /> Solo puedes seleccionar un destinatario para firma
                            única.
                        </p>
                    </>
                )}
            </section>

            {/* ── Acciones ── */}
            <section className="flex flex-col items-stretch gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2 text-xs text-gray-400">
                    <i className="dx-icon-doc mt-0.5 text-base" />
                    <span>
                        Al guardar como borrador, el documento quedará registrado y podrás completarlo o
                        enviarlo más tarde.
                    </span>
                </div>
                <div className="flex shrink-0 gap-3">
                    <button
                        type="button"
                        onClick={() => guardar(false)}
                        disabled={ocupado}
                        className="flex flex-col items-center rounded-lg border border-gray-300 px-4 py-2 transition hover:bg-gray-50 disabled:opacity-50"
                    >
                        <span className="flex items-center gap-1 text-sm font-medium text-gray-700">
                            <i className="dx-icon-save" />
                            {accion === "borrador" ? "Guardando…" : "Guardar borrador"}
                        </span>
                        <span className="text-[11px] text-gray-400">Guardar sin enviar</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => guardar(true)}
                        disabled={ocupado}
                        className={`flex flex-col items-center rounded-lg px-4 py-2 text-white transition disabled:opacity-50 ${T.btn}`}
                    >
                        <span className="flex items-center gap-1 text-sm font-medium">
                            <i className="dx-icon-send" />
                            {accion === "enviar" ? "Enviando…" : "Enviar documento"}
                        </span>
                        <span className="text-[11px] opacity-80">Iniciar proceso de firma</span>
                    </button>
                </div>
            </section>
        </div>
    );
};

export default NuevoDocumentoFirma;
