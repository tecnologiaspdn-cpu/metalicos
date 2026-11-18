import React, { useCallback, useEffect, useRef, useState } from 'react';
import notify from 'devextreme/ui/notify';
import { CheckCircle2, Keyboard, Printer, RefreshCw, User, XCircle } from 'lucide-react';
import { ComedorHeader, inputCls } from '../../components/Comedor/ComedorShared';
import { formatearFechaHora, nombreCompleto, pick, usuarioActual } from '../../components/Comedor/comedorUtils';
import logoComedor from '../../assets/logo_comedor.jpeg';
import { useComedorPuntos } from '../../hooks/useComedorPuntos';
import { asegurarOk, comedorApi, nuevoIdSolicitud } from '../../services/comedor/comedorApi';

const LS_EQUIPO = 'comedor_equipo';
const EQUIPO_DEFECTO = 'PC-COMEDOR-01';

type Resultado =
    | { tipo: 'ok'; consumo: any; impresion: 'ENVIADA' | 'ERROR' | 'PENDIENTE' }
    | { tipo: 'error'; mensaje: string; dniOQr: string };

/** Empresa que presta el servicio de comida (encabezado del ticket). */
const EMPRESA_SERVICIO = 'YRC GOURMET GROUP E.I.R.L';
/** Empresa del comensal si el backend no la informa. */
const EMPRESA_COMENSAL_DEFECTO = 'POLIMETÁLICOS DEL NORTE S.A.C.';

/** Ticket de 80mm que se imprime desde un iframe oculto (sin abrir otra pestaña). */
const imprimirTicket = (consumo: any, comensal: { nombre: string; area: string; empresa: string; fecha: string; servicio: string }) =>
    new Promise<void>((resolve, reject) => {
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
        document.body.appendChild(iframe);
        const doc = iframe.contentWindow?.document;
        if (!doc || !iframe.contentWindow) {
            iframe.remove();
            return reject(new Error('No se pudo preparar la impresión.'));
        }
        const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
        doc.open();
        doc.write(`<html><head><style>
            @page { margin: 2mm; size: 80mm auto; }
            body { font-family: monospace; font-size: 12px; width: 76mm; text-align: center; }
            img#logo { display: block; margin: 0 auto 4px; max-width: 40mm; max-height: 20mm; } h2 { margin: 4px 0; font-size: 14px; } p { margin: 2px 0; } p.empresa { font-size: 10px; } hr { border: 0; border-top: 1px dashed #000; }
        </style></head><body>
            <img id="logo" src="${new URL(logoComedor, window.location.href).href}" alt="" />
            <h2>${esc(EMPRESA_SERVICIO)}</h2><p>COMEDOR${comensal.servicio ? ' - ' + esc(comensal.servicio) : ''}</p><hr/>
            <p><b>${esc(comensal.nombre)}</b></p><p>${esc(comensal.area)}</p>
            <p class="empresa">EMPRESA: ${esc(comensal.empresa)}</p><p>${esc(comensal.fecha)}</p><hr/>
            <p>Ticket N° ${esc(String(pick(consumo, ['id', 'id_consumo']) ?? ''))}</p>
        </body></html>`);
        doc.close();
        iframe.contentWindow.focus();
        const imprimir = () => {
            try {
                iframe.contentWindow?.print();
                resolve();
            } catch (e) {
                reject(e);
            } finally {
                setTimeout(() => iframe.remove(), 2000);
            }
        };
        // Se espera a que cargue el logo (con tope de 1.5 s) para que salga en el ticket.
        const logo = doc.getElementById('logo') as HTMLImageElement | null;
        if (!logo || logo.complete) {
            setTimeout(imprimir, 250);
        } else {
            let hecho = false;
            const una = () => { if (!hecho) { hecho = true; setTimeout(imprimir, 100); } };
            logo.onload = una;
            logo.onerror = una;
            setTimeout(una, 1500);
        }
    });

const RegistroComensales: React.FC = () => {
    const { puntos, idPunto, setIdPunto, cargando: cargandoPuntos } = useComedorPuntos();
    const [entrada, setEntrada] = useState('');
    const [procesando, setProcesando] = useState(false);
    const [resultado, setResultado] = useState<Resultado | null>(null);
    const [equipo, setEquipo] = useState(() => {
        try {
            return localStorage.getItem(LS_EQUIPO) || EQUIPO_DEFECTO;
        } catch {
            return EQUIPO_DEFECTO;
        }
    });
    const [ahora, setAhora] = useState(new Date());
    const inputRef = useRef<HTMLInputElement>(null);
    // Se conserva el id_solicitud mientras se reintenta la MISMA lectura (idempotencia).
    const solicitudRef = useRef<{ clave: string; id: string } | null>(null);

    useEffect(() => {
        const t = setInterval(() => setAhora(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    const enfocar = useCallback(() => setTimeout(() => inputRef.current?.focus(), 0), []);
    useEffect(() => {
        enfocar();
    }, [enfocar]);

    const guardarEquipo = (v: string) => {
        setEquipo(v);
        try {
            localStorage.setItem(LS_EQUIPO, v);
        } catch {
            /* sin persistencia */
        }
    };

    const registrar = async () => {
        const valor = entrada.trim();
        if (!valor || procesando) return;
        if (!idPunto) {
            notify('No hay un punto de atención activo configurado.', 'warning', 3500);
            return;
        }

        // DNI (8 dígitos) o, si no, el contenido de un QR (trabajador o invitado).
        const esDni = /^\d{8}$/.test(valor);
        if (!esDni && /^\d+$/.test(valor)) {
            setResultado({ tipo: 'error', mensaje: 'El DNI debe tener 8 dígitos.', dniOQr: valor });
            setEntrada('');
            return enfocar();
        }

        const clave = `${idPunto}|${valor}`;
        if (solicitudRef.current?.clave !== clave) solicitudRef.current = { clave, id: nuevoIdSolicitud() };

        setProcesando(true);
        try {
            const resp = asegurarOk(
                await comedorApi.registrarConsumo({
                    id_punto_atencion: idPunto,
                    id_solicitud: solicitudRef.current.id,
                    equipo,
                    usuario: usuarioActual(),
                    ...(esDni ? { dni: valor } : { qr: valor }),
                }),
                'No se pudo registrar el consumo.'
            );
            solicitudRef.current = null; // operación completada: la siguiente lectura es nueva
            const consumo = resp.data ?? {};
            const impresion = await enviarAImpresora(consumo);
            setResultado({ tipo: 'ok', consumo, impresion });
        } catch (e: any) {
            setResultado({ tipo: 'error', mensaje: e?.message || 'No se pudo registrar el consumo.', dniOQr: valor });
        } finally {
            setEntrada('');
            setProcesando(false);
            enfocar();
        }
    };

    const datosComensal = (consumo: any) => {
        const c = consumo?.comensal ?? consumo?.trabajador ?? consumo?.invitado ?? consumo;
        return {
            nombre: nombreCompleto(c) || '—',
            area: String(pick(c, ['area', 'area_nombre', 'nombre_area', 'empresa_referencia']) ?? pick(consumo, ['area', 'area_nombre']) ?? '—'),
            empresa: String(pick(c, ['empresa_comensal', 'empresa', 'empresa_nombre']) ?? pick(consumo, ['empresa_comensal', 'empresa']) ?? EMPRESA_COMENSAL_DEFECTO),
            fecha: formatearFechaHora(pick(consumo, ['fecha_hora_registro', 'fecha_hora', 'fecha_consumo', 'fecha_registro', 'created_at']) ?? new Date().toISOString()),
            servicio: String(pick(consumo, ['tipo_servicio', 'tipo_servicio_nombre', 'servicio', 'nombre_servicio']) ?? ''),
        };
    };

    /** Imprime el ticket y deja constancia (ENVIADO) o el error en el historial de impresión. */
    const enviarAImpresora = async (consumo: any): Promise<'ENVIADA' | 'ERROR' | 'PENDIENTE'> => {
        const imp = consumo?.impresion;
        try {
            await imprimirTicket(consumo, datosComensal(consumo));
            if (imp?.id) {
                await comedorApi.cambiarEstadoImpresion(imp.id, { version: imp.version, estado: 'ENVIADO', usuario: usuarioActual() });
            }
            return 'ENVIADA';
        } catch (e: any) {
            console.error('Error de impresión', e);
            if (imp?.id) {
                comedorApi
                    .cambiarEstadoImpresion(imp.id, {
                        version: imp.version,
                        estado: 'ERROR',
                        mensaje_error: String(e?.message || 'Error de impresión').slice(0, 200),
                        usuario: usuarioActual(),
                    })
                    .catch(() => undefined);
            }
            return 'ERROR';
        }
    };

    const reimprimir = async () => {
        if (resultado?.tipo !== 'ok') return;
        const id = Number(pick(resultado.consumo, ['id', 'id_consumo']));
        if (!id) return;
        try {
            const resp = asegurarOk(
                await comedorApi.reimprimir(id, {
                    id_solicitud: nuevoIdSolicitud(),
                    equipo,
                    motivo: 'Reimpresión solicitada desde el registro',
                    usuario: usuarioActual(),
                }),
                'No se pudo solicitar la reimpresión.'
            );
            const impresion = await enviarAImpresora({ ...resultado.consumo, impresion: Array.isArray(resp.data) ? resp.data[0] : resp.data?.impresion ?? resp.data });
            setResultado({ ...resultado, impresion });
        } catch (e: any) {
            notify(e?.message || 'No se pudo reimprimir.', 'error', 3500);
        }
    };

    const limpiar = () => {
        setResultado(null);
        setEntrada('');
        solicitudRef.current = null;
        enfocar();
    };

    const fecha = ahora.toLocaleDateString('es-PE', { timeZone: 'America/Lima', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const hora = ahora.toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour12: false });
    const datos = resultado?.tipo === 'ok' ? datosComensal(resultado.consumo) : null;

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
                <div className="mb-2 flex justify-end gap-3 text-sm text-gray-600">
                    <span className="capitalize">{fecha}</span>
                    <span className="text-2xl font-semibold tabular-nums text-gray-900">{hora}</span>
                </div>

                <ComedorHeader
                    subtitulo="Registro de Comensales"
                    descripcion="Ingrese el número de DNI del trabajador y presione ENTER."
                    onAyuda={() => notify('Escriba el DNI (8 dígitos) o escanee el QR y presione ENTER. Se registra el consumo y se imprime el ticket.', 'info', 5000)}
                />

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                        <label htmlFor="comedor-dni" className="mb-2 block text-lg font-semibold text-gray-800">
                            N° de DNI
                        </label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                            <input
                                id="comedor-dni"
                                ref={inputRef}
                                value={entrada}
                                onChange={(e) => setEntrada(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && registrar()}
                                disabled={procesando || cargandoPuntos}
                                autoComplete="off"
                                inputMode="numeric"
                                className="w-full rounded-lg border-2 border-blue-500 py-3 pl-11 pr-4 text-2xl font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
                            />
                        </div>
                        <div className="mt-3 flex items-center justify-center gap-2 rounded bg-gray-100 py-2.5 text-gray-600">
                            <Keyboard size={18} />
                            {procesando ? 'Registrando…' : 'Ingrese el DNI y presione ENTER'}
                        </div>

                        {resultado?.tipo === 'ok' && datos && (
                            <div className="mt-5 rounded-lg border border-green-300 bg-green-50 p-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <CheckCircle2 className="text-green-600" size={44} />
                                        <div>
                                            <p className="text-xl font-bold text-green-700">Registro exitoso</p>
                                            <p className="text-sm text-gray-600">Comensal registrado correctamente.</p>
                                        </div>
                                    </div>
                                    <span
                                        className={`rounded border px-2 py-1 text-xs font-semibold ${
                                            resultado.impresion === 'ENVIADA'
                                                ? 'border-green-500 text-green-700'
                                                : 'border-red-400 text-red-600'
                                        }`}
                                    >
                                        {resultado.impresion === 'ENVIADA' ? '✓ IMPRESIÓN ENVIADA' : 'ERROR DE IMPRESIÓN'}
                                    </span>
                                </div>
                                <dl className="mt-4 space-y-2 text-sm">
                                    <div>
                                        <dt className="text-gray-500">Nombres y Apellidos</dt>
                                        <dd className="text-lg font-bold text-gray-900">{datos.nombre}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-gray-500">Área</dt>
                                        <dd className="font-semibold uppercase text-gray-900">{datos.area}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-gray-500">Fecha y Hora</dt>
                                        <dd className="font-semibold text-gray-900">{datos.fecha}</dd>
                                    </div>
                                </dl>
                                <button
                                    type="button"
                                    onClick={reimprimir}
                                    className="mt-4 flex items-center gap-2 rounded border border-green-600 px-3 py-1.5 text-sm text-green-700 hover:bg-green-100"
                                >
                                    <Printer size={16} /> Reimprimir ticket
                                </button>
                            </div>
                        )}

                        {resultado?.tipo === 'ok' && (
                            <div className="mx-auto mt-5 flex w-fit items-center gap-3 rounded-full bg-blue-50 px-6 py-2 text-blue-700">
                                <RefreshCw size={20} />
                                <div>
                                    <p className="font-semibold">Listo para un nuevo registro</p>
                                    <p className="text-sm text-gray-500">Ingrese otro DNI…</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <aside className="space-y-4">
                        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                            <label className="mb-1 block text-xs font-medium text-gray-500">Punto de atención</label>
                            <select
                                className={inputCls}
                                value={idPunto ?? ''}
                                onChange={(e) => setIdPunto(Number(e.target.value) || null)}
                            >
                                {puntos.length === 0 && <option value="">Sin puntos activos</option>}
                                {puntos.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.nombre || p.codigo}
                                    </option>
                                ))}
                            </select>
                            <label className="mb-1 mt-3 block text-xs font-medium text-gray-500">Equipo</label>
                            <input className={inputCls} value={equipo} onChange={(e) => guardarEquipo(e.target.value)} />
                        </div>
                    </aside>
                </div>

                {resultado?.tipo === 'error' && (
                    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-red-300 bg-red-50 p-4">
                        <div className="flex items-center gap-3">
                            <XCircle className="shrink-0 text-red-600" size={40} />
                            <div>
                                <p className="text-lg font-bold text-red-700">No se pudo registrar</p>
                                <p className="text-sm text-gray-700">{resultado.mensaje}</p>
                                <p className="text-sm text-gray-500">Por favor, comuníquese con el administrador.</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={limpiar}
                            className="flex items-center gap-2 rounded border border-gray-200 bg-white px-5 py-3 text-blue-600 hover:bg-blue-50"
                        >
                            <RefreshCw size={18} /> Intentar nuevamente
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RegistroComensales;
