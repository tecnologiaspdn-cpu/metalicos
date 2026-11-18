import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { NotFoundException } from "@zxing/library";
import { apiManager } from "../../services/api/ApiManager";

type Persona = {
    nombre_completos: string;
    documento: string;
    tipo_doc: string;
    area: string;
    puesto: string;
};

type Movimiento = {
    status: "0" | "1";
    fecha_mov: string; // "YYYY-MM-DD"
    tipo_mov_personal_id: number;
    tipo_mov_personal_nombre: string;
    empresa_id: number;
    razon_social: string;
    descripcion: string;
    estado: "0" | "1";
};

type ApiData = {
    status: "0" | "1";
    persona?: Persona;
    movimiento?: Movimiento;
};

type ApiResponse = {
    code: number;
    message: string;
    value: any;
    data: ApiData;
};

export default function ControlAcceso() {
    const readerRef = useRef<BrowserMultiFormatReader | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const controlsRef = useRef<IScannerControls | null>(null);

    const [scanning, setScanning] = useState(false);
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);
    const [torchOn, setTorchOn] = useState(false);

    const [qrRaw, setQrRaw] = useState<string | null>(null);
    const [manualQr, setManualQr] = useState<string>(""); // <-- input manual
    const [apiData, setApiData] = useState<ApiData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        readerRef.current = new BrowserMultiFormatReader();
        return () => {
            stopScanner();
            readerRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const enumerateDevices = useCallback(async () => {
        try {
            const all = await navigator.mediaDevices.enumerateDevices();
            const cams = all.filter((d) => d.kind === "videoinput");
            setDevices(cams);
            if (!selectedDeviceId && cams.length) {
                const back = cams.find((d) => /back|trase|rear|environment/i.test(d.label));
                setSelectedDeviceId(back?.deviceId || cams[0].deviceId);
            }
        } catch {
            setError("No se pudo enumerar las cámaras. Revisa permisos del navegador.");
        }
    }, [selectedDeviceId]);

    useEffect(() => {
        enumerateDevices();
    }, [enumerateDevices]);

    const fetchInfoByQR = useCallback(async (hashQr: string) => {
        setLoading(true);
        setError(null);
        setApiData(null);
        try {
            const resp = (await (apiManager as any).personal.getInfoByQR({ hashQr })) as ApiResponse;
            setApiData(resp?.data ?? null);
            if (!resp?.data) {
                setError("Respuesta del servidor inválida.");
            }
        } catch (e: any) {
            setError(e?.message || "No se pudo obtener la información del QR.");
        } finally {
            setLoading(false);
        }
    }, []);

    const startScanner = useCallback(async () => {
        setError(null);
        setQrRaw(null);
        setApiData(null);
        if (!readerRef.current) return;

        try {
            setScanning(true);
            const deviceId = selectedDeviceId;
            const controls = await readerRef.current.decodeFromVideoDevice(
                deviceId ?? undefined,
                videoRef.current!,
                (res, err, c) => {
                    if (res) {
                        const text = res.getText();
                        setQrRaw(text);

                        // pedir datos al API y detener escáner
                        (async () => {
                            await fetchInfoByQR(text);
                        })();

                        c?.stop();
                        setScanning(false);
                    }
                    if (err && !(err instanceof NotFoundException)) {
                        setError(err.message);
                    }
                }
            );
            controlsRef.current = controls;
            const stream = (videoRef.current?.srcObject as MediaStream) || null;
            streamRef.current = stream;
        } catch (e: any) {
            setScanning(false);
            setError(e?.message || "No se pudo iniciar la cámara.");
        }
    }, [selectedDeviceId, fetchInfoByQR]);

    const stopScanner = useCallback(() => {
        setScanning(false);
        try {
            controlsRef.current?.stop();
        } catch { }
        const tracks = streamRef.current?.getTracks() || [];
        tracks.forEach((t) => t.stop());
        if (videoRef.current) {
            (videoRef.current as any).srcObject = null;
        }
        streamRef.current = null;
        setTorchOn(false);
    }, []);

    const toggleTorch = useCallback(async () => {
        try {
            controlsRef.current?.switchTorch?.(!torchOn);
            setTorchOn((v) => !v);

            const track = streamRef.current?.getVideoTracks()?.[0];
            if (!track) return;

            const caps = (track.getCapabilities?.() as any) ?? {};
            if (caps.torch) {
                await track.applyConstraints({ advanced: [{ torch: !torchOn }] as any });
                setTorchOn((v) => !v);
            }
        } catch {
            // silencioso
        }
    }, [torchOn]);

    const hasData = apiData?.status === "1" && apiData.persona && apiData.movimiento;

    const fechaMovFmt = useMemo(() => {
        const f = apiData?.movimiento?.fecha_mov;
        if (!f) return "-";
        const [y, m, d] = f.split("-");
        return `${d}/${m}/${y}`;
    }, [apiData?.movimiento?.fecha_mov]);

    const parseYYYYMMDD = (s?: string) => {
        if (!s) return null;
        const [y, m, d] = s.split("-").map(Number);
        const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
        dt.setHours(0, 0, 0, 0);
        return isNaN(dt.getTime()) ? null : dt;
    };

    const startOfToday = () => {
        const t = new Date();
        t.setHours(0, 0, 0, 0);
        return t;
    };
    const movDate = parseYYYYMMDD(apiData?.movimiento?.fecha_mov);
    const today = startOfToday();
    const oneYearLater = new Date(today);
    oneYearLater.setFullYear(today.getFullYear() + 1);

    let movTone: "vip" | "past" | "future_or_today" | null = null;
    if (movDate) {
        if (movDate > oneYearLater) movTone = "vip";
        else if (movDate < today) movTone = "past";
        else movTone = "future_or_today";
    }

    const movTintClasses =
        movTone === "vip"
            ? "border-amber-200 bg-amber-50"
            : movTone === "past"
                ? "border-red-200 bg-red-50"
                : movTone === "future_or_today"
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-gray-100 bg-white";

    const movBadgeColor =
        movTone === "vip" ? "amber" : movTone === "past" ? "red" : movTone === null ? "red" : "green";

    // --- NUEVO: búsqueda manual ---
    const onManualSubmit = useCallback(
        async (e?: React.FormEvent) => {
            if (e) e.preventDefault();
            const q = (manualQr || "").trim();
            if (!q) {
                setError("Ingresa el texto del QR para buscar.");
                return;
            }
            // si estaba escaneando, detener la cámara para evitar conflictos
            stopScanner();
            setQrRaw(q);
            await fetchInfoByQR(q);
        },
        [manualQr, fetchInfoByQR, stopScanner]
    );

    const onClearManual = useCallback(() => {
        setManualQr("");
        setQrRaw(null);
        setApiData(null);
        setError(null);
    }, []);

    return (
        <div className="w-full p-4 md:p-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Escáner + manual input */}
                <section className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 p-5 md:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                        <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Escanear Código QR</h2>

                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                onClick={scanning ? stopScanner : startScanner}
                                className={`inline-flex items-center justify-center rounded-xl px-4 py-2 font-medium text-white shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2
                ${scanning ? "bg-red-600 hover:bg-red-700 focus:ring-red-600" : "bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-600"}`}
                            >
                                {scanning ? "Detener" : "Iniciar Escáner"}
                            </button>
                        </div>
                    </div>

                    <div className="aspect-video w-full rounded-xl bg-black/5 ring-1 ring-gray-100 overflow-hidden flex items-center justify-center">
                        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                    </div>

                    <div className="mt-4 min-h-[2.5rem]">
                        {error && <p className="text-sm text-red-600">{error}</p>}

                        {!error && qrRaw && (
                            <div className="space-y-1">
                                <p className="text-sm text-gray-500">QR detectado:</p>
                                <pre className="text-xs md:text-sm whitespace-pre-wrap break-all bg-gray-50 p-3 rounded-lg border border-gray-200">
                                    {qrRaw}
                                </pre>
                            </div>
                        )}

                        {!error && !qrRaw && (
                            <p className="text-sm text-gray-500">Apunta la cámara hacia un código QR nítido y bien iluminado, o usa la búsqueda manual más abajo.</p>
                        )}
                    </div>

                    {/* --- NUEVO: búsqueda manual debajo del escáner --- */}
                    <form onSubmit={onManualSubmit} className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                        <label htmlFor="manualQr" className="sr-only">Texto del QR</label>
                        <input
                            id="manualQr"
                            value={manualQr}
                            onChange={(e) => setManualQr(e.target.value)}
                            placeholder="Pega o escribe aquí el texto del QR..."
                            className="md:col-span-9 w-full rounded-xl border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            disabled={loading}
                        />
                        <div className="flex md:col-span-3 gap-2">
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 font-medium disabled:opacity-50"
                            >
                                Buscar
                            </button>
                            <button
                                type="button"
                                onClick={onClearManual}
                                className="rounded-xl bg-gray-100 hover:bg-gray-200 text-sm px-4 py-2 font-medium"
                            >
                                Limpiar
                            </button>
                        </div>
                    </form>
                </section>

                {/* Resultado */}
                <aside className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 p-5 md:p-6">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Resultado</h2>
                    </div>

                    {loading && (
                        <div className="animate-pulse space-y-4">
                            <div className="h-4 bg-gray-100 rounded w-1/3" />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <div key={i} className="h-10 bg-gray-100 rounded-xl" />
                                ))}
                            </div>
                        </div>
                    )}

                    {!loading && apiData?.status === "0" && (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                            <div className="text-sm font-medium text-red-700">QR no existente</div>
                            <p className="text-sm text-red-700/80 mt-1">
                                No se encontró información para el código escaneado. Intenta nuevamente o verifica con soporte.
                            </p>
                            <div className="mt-3">
                                <button
                                    onClick={startScanner}
                                    className="rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-2 font-medium"
                                >
                                    Reintentar escaneo
                                </button>
                            </div>
                        </div>
                    )}

                    {!loading && hasData && (
                        <div className="space-y-6">
                            <section>
                                <h3 className="text-sm font-semibold text-gray-700 mb-3">Persona</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <InputDiv label="NOMBRES COMPLETOS" value={apiData!.persona!.nombre_completos} full />
                                    <InputDiv label="TIPO DOCUMENTO" value={apiData!.persona!.tipo_doc} />
                                    <InputDiv label="N° DOCUMENTO" value={apiData!.persona!.documento} />
                                    <InputDiv label="ÁREA" value={apiData!.persona!.area} />
                                    <InputDiv label="PUESTO" value={apiData!.persona!.puesto} />
                                </div>
                            </section>

                            <section className={`rounded-xl border ${movTintClasses} p-4 md:p-5`}>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-semibold text-gray-700">Movimiento</h3>
                                    <Badge
                                        color={movBadgeColor as any}
                                        text={
                                            movTone === "vip"
                                                ? "VIP (≥ 1 año)"
                                                : movTone === "past"
                                                    ? "Pasado"
                                                    : movTone === null
                                                        ? "Pasado"
                                                        : "Activo"
                                        }
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <InputDiv label="FECHA" value={fechaMovFmt} />
                                    <InputDiv label="TIPO MOVIMIENTO" value={apiData!.movimiento!.tipo_mov_personal_nombre} />
                                    <InputDiv label="DESCRIPCIÓN" value={apiData!.movimiento!.descripcion} full />
                                    {/* <InputDiv label="EMPRESA ID" value={String(apiData!.movimiento!.empresa_id)} /> */}
                                    <InputDiv label="EMPRESA" value={String(apiData!.movimiento!.razon_social || "-")} />
                                    <InputDiv
                                        label="ESTADO"
                                        value={apiData!.movimiento!.estado === "1" ? "Habilitado" : "Deshabilitado"}
                                    />
                                </div>
                            </section>

                            <div className="flex gap-2">
                                <button
                                    onClick={startScanner}
                                    className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 font-medium"
                                >
                                    Escanear otro QR
                                </button>
                            </div>
                        </div>
                    )}

                    {!loading && !apiData && (
                        <div className="rounded-xl border border-dashed border-gray-200 p-6 text-sm text-gray-500">
                            Escanea un QR o usa la búsqueda manual para ver la información aquí.
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
}

function InputDiv({ label, value, full = false }: { label: string; value?: string; full?: boolean }) {
    return (
        <div className={full ? "md:col-span-2" : undefined}>
            <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">{label}</div>
            <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-800">
                {value || "-"}
            </div>
        </div>
    );
}

function Badge({
    text,
    color = "gray",
}: {
    text: string;
    color?: "green" | "gray" | "red" | "yellow" | "amber";
}) {
    const map: Record<string, string> = {
        green: "bg-emerald-100 text-emerald-700 ring-emerald-200",
        gray: "bg-gray-100 text-gray-700 ring-gray-200",
        red: "bg-red-100 text-red-700 ring-red-200",
        yellow: "bg-yellow-100 text-yellow-700 ring-yellow-200",
        amber: "bg-amber-100 text-amber-800 ring-amber-200",
    };
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${map[color]}`}>
            {text}
        </span>
    );
}
