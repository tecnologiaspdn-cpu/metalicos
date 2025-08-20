import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { NotFoundException, Result } from "@zxing/library";

export default function QRScannerResponsive() {
    const readerRef = useRef<BrowserMultiFormatReader | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const controlsRef = useRef<IScannerControls | null>(null);

    const [scanning, setScanning] = useState(false);
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);
    const [torchOn, setTorchOn] = useState(false);
    const [result, setResult] = useState<Result | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        readerRef.current = new BrowserMultiFormatReader();
        return () => {
            stopScanner();
            readerRef.current = null;
        };
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
        } catch (e) {
            setError("No se pudo enumerar las cámaras. Revisa permisos del navegador.");
        }
    }, [selectedDeviceId]);

    useEffect(() => {
        enumerateDevices();
    }, [enumerateDevices]);

    const startScanner = useCallback(async () => {
        setError(null);
        setResult(null);
        if (!readerRef.current) return;
        try {
            setScanning(true);
            const deviceId = selectedDeviceId;
            const controls = await readerRef.current.decodeFromVideoDevice(
                deviceId ?? undefined,
                videoRef.current!,
                (res, err, c) => {
                    if (res) {
                        setResult(res);
                        // detener inmediatamente tras el primer QR
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
    }, [selectedDeviceId]);

    const stopScanner = useCallback(() => {
        setScanning(false);
        try {
            controlsRef.current?.stop();
        } catch { }
        const tracks = streamRef.current?.getTracks() || [];
        tracks.forEach((t) => t.stop());
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        streamRef.current = null;
        setTorchOn(false);
    }, []);

    const toggleTorch = useCallback(async () => {
        try {
            // Preferir API de ZXing si existe
            /*if (controlsRef.current?.switchTorch) {
                const ok = await controlsRef.current.switchTorch(!torchOn);
                if (ok) setTorchOn((v) => !v);
                return;
            }*/
            controlsRef.current?.switchTorch?.(!torchOn);
            setTorchOn((v) => !v);

            // Fallback manual via MediaTrack constraints
            const track = streamRef.current?.getVideoTracks()?.[0];
            if (!track) return;
            const ImageCaptureConstructor = (window as any).ImageCapture;
            const imageCapture = ImageCaptureConstructor ? new ImageCaptureConstructor(track) : null;
            let canTorch = false;
            if (imageCapture?.getPhotoCapabilities) {
                try {
                    const caps = await imageCapture.getPhotoCapabilities();
                    canTorch = (caps as any).fillLightMode?.includes("flash") || (track.getCapabilities?.() as any)?.torch;
                } catch { }
            }
            const supports = (track.getCapabilities?.() as any)?.torch ?? canTorch;
            if (supports) {
                await track.applyConstraints({ advanced: [{ torch: !torchOn }] as any });
                setTorchOn((v) => !v);
            }
        } catch {
            // silencioso
        }
    }, [torchOn]);

    const onPickImage = useCallback(
        async (file: File) => {
            setError(null);
            setResult(null);
            if (!readerRef.current) return;
            const url = URL.createObjectURL(file);
            try {
                const res = await readerRef.current.decodeFromImageUrl(url);
                setResult(res);
            } catch (e: any) {
                setError("No se pudo leer un QR en la imagen seleccionada.");
            } finally {
                URL.revokeObjectURL(url);
            }
        },
        []
    );

    const parsedProfile = useMemo(() => {
        if (!result) return null;
        try {
            const data = JSON.parse(result.getText());
            return {
                nombre: data.nombre || data.name,
                docTipo: data.docTipo || data.doc_type,
                docNum: data.docNum || data.doc_number,
                empleado: data.tipoEmpleado || data.role,
                guardia: data.guardia || data.shift,
                direccion: data.direccion || data.address,
                telefono: data.telefono || data.phone,
                email: data.email,
            } as Record<string, string | undefined>;
        } catch {
            return null;
        }
    }, [result]);

    return (
        <div className="w-full p-4 md:p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <section className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 p-5 md:p-6">
                    <header className="flex items-center justify-between mb-4">
                        <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Escanear Código QR</h2>
                    </header>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                        <button
                            onClick={scanning ? stopScanner : startScanner}
                            className={`inline-flex items-center justify-center rounded-xl px-4 py-2 font-medium text-white shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${scanning
                                ? "bg-red-600 hover:bg-red-700 focus:ring-red-600"
                                : "bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-600"
                                }`}
                        >
                            {scanning ? "Detener" : "Iniciar Escáner"}
                        </button>

                        <label className="flex items-center gap-2 text-sm text-gray-600">
                            Cámara:
                            <select
                                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                value={selectedDeviceId}
                                onChange={(e) => setSelectedDeviceId(e.target.value)}
                                disabled={scanning}
                            >
                                {devices.map((d) => (
                                    <option key={d.deviceId} value={d.deviceId}>
                                        {d.label || `Cámara ${d.deviceId.slice(0, 6)}`}
                                    </option>
                                ))}
                            </select>
                        </label>

                        {/* <button
                            onClick={toggleTorch}
                            disabled={!scanning}
                            className="inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
                            title="Linterna"
                        >
                            {torchOn ? "Apagar linterna" : "Encender linterna"}
                        </button> */}

                        {/* <label className="ml-auto sm:ml-0">
                            <span className="sr-only">Subir imagen</span>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => e.target.files && onPickImage(e.target.files[0])}
                                className="hidden"
                                id="qr-image"
                            />
                            <label
                                htmlFor="qr-image"
                                className="cursor-pointer inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-medium text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
                            >
                                Leer desde imagen
                            </label>
                        </label>*/}
                    </div>

                    <div className="aspect-video w-full rounded-xl bg-black/5 ring-1 ring-gray-100 overflow-hidden flex items-center justify-center">
                        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                    </div>

                    <div className="mt-4 min-h-[2.5rem]">
                        {error && (
                            <p className="text-sm text-red-600">{error}</p>
                        )}
                        {!error && result && (
                            <div className="space-y-1">
                                <p className="text-sm text-gray-500">QR detectado:</p>
                                <pre className="text-xs md:text-sm whitespace-pre-wrap break-all bg-gray-50 p-3 rounded-lg border border-gray-200">
                                    {result.getText()}
                                </pre>
                            </div>
                        )}
                        {!error && !result && (
                            <p className="text-sm text-gray-500">Apunta la cámara hacia un código QR nítido y bien iluminado.</p>
                        )}
                    </div>
                </section>

                <aside className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 p-5 md:p-6">
                    <header className="flex items-center justify-between mb-5">
                        <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Mi Perfil</h2>
                        {/* <button className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 font-medium">
                            Marcar Asistencia Manual
                        </button> */}
                    </header>

                    {parsedProfile ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InputDiv label="NOMBRES COMPLETOS" value={parsedProfile.nombre || "-"} full />
                            <InputDiv label="TIPO DOCUMENTO" value={parsedProfile.docTipo || "-"} />
                            <InputDiv label="N° DOCUMENTO" value={parsedProfile.docNum || "-"} />
                            <InputDiv label="TIPO EMPLEADO" value={parsedProfile.empleado || "-"} />
                            <InputDiv label="GUARDIA" value={parsedProfile.guardia || "-"} />
                            <InputDiv label="DIRECCIÓN" value={parsedProfile.direccion || "-"} full />
                            <InputDiv label="TELÉFONO" value={parsedProfile.telefono || "-"} />
                            <InputDiv label="EMAIL" value={parsedProfile.email || "-"} />
                        </div>
                    ) : (
                        <div className="rounded-xl border border-dashed border-gray-200 p-6 text-sm text-gray-500">
                            Escanea un QR para ver tus datos aquí

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
