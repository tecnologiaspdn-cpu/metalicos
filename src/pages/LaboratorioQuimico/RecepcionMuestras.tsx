import React, { useCallback, useEffect, useState } from 'react';
import notify from 'devextreme/ui/notify';
import { Eye, FileText, Info, Lock, PackageCheck, Search } from 'lucide-react';
import {
    EstadoChip, LabHeader, Modal, Paginacion, RecepcionChip, campo, codigoEstado, inputCls, useSesion,
} from '../../components/LaboratorioQuimico/LabShared';
import { formatearFechaHora, pick } from '../../components/Comedor/comedorUtils';
import { nuevoIdSolicitud } from '../../services/comedor/comedorApi';
import { descargarPdfBlob } from '../../services/firmaDocumentos/firmaDocumentosApi';
import { abrirPdf, asegurarOk, extraerListado, labQuimicoApi } from '../../services/labQuimico/labQuimicoApi';

const TAM_PAGINA = 15;

// TODO(CONFIRMAR CON BACKEND): la colección solo usa "CONFORME"; el código de "Con observaciones" es una suposición.
const RESULTADOS = [
    { value: 'CONFORME', label: 'Conforme' },
    { value: 'CON_OBSERVACIONES', label: 'Con observaciones' },
];

interface MuestraRecepcion {
    id: number;
    codigo: string;
    enviada: number;
    recibida: string;
    analisis: string;
    condicion: string;
}

const RecepcionMuestras: React.FC = () => {
    const sesion = useSesion();
    const [tiposAnalisis, setTiposAnalisis] = useState<any[]>([]);

    const [busqueda, setBusqueda] = useState('');
    const [desde, setDesde] = useState('');
    const [hasta, setHasta] = useState('');
    // `LISTA` = pendientes de recepción de ambas modalidades (firmadas y envío directo).
    const [recepcion, setRecepcion] = useState('LISTA');
    const [firma, setFirma] = useState('');

    const [filas, setFilas] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [pagina, setPagina] = useState(1);
    const [cargando, setCargando] = useState(false);

    const [detalle, setDetalle] = useState<any | null>(null);
    const [soloLectura, setSoloLectura] = useState(false);
    const [clave, setClave] = useState(nuevoIdSolicitud());
    const [sacosRecibidos, setSacosRecibidos] = useState('');
    const [muestras, setMuestras] = useState<MuestraRecepcion[]>([]);
    const [resultado, setResultado] = useState('CONFORME');
    const [observaciones, setObservaciones] = useState('');
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        labQuimicoApi.tiposAnalisis().then((r) => setTiposAnalisis(Array.isArray(r?.data) ? r.data : [])).catch(() => setTiposAnalisis([]));
    }, []);

    const consultar = useCallback(
        async (pag = 1) => {
            if (desde && hasta && desde > hasta) return notify('"Desde" no puede ser posterior a "Hasta".', 'warning', 3000);
            setCargando(true);
            try {
                const resp = asegurarOk(
                    await labQuimicoApi.listar({
                        pagina: pag,
                        tamano: TAM_PAGINA,
                        recepcion: recepcion || undefined,
                        estado: firma || undefined,
                        busqueda: busqueda.trim() || undefined,
                        fecha_inicio: desde || undefined,
                        fecha_fin: hasta || undefined,
                    }),
                    'No se pudo cargar las solicitudes.'
                );
                const { filas: f, total: t } = extraerListado(resp.data);
                setFilas(f);
                setTotal(t);
                setPagina(pag);
            } catch (e: any) {
                notify(e?.message || 'No se pudo cargar las solicitudes.', 'error', 4000);
                setFilas([]);
                setTotal(0);
            } finally {
                setCargando(false);
            }
        },
        [busqueda, desde, hasta, recepcion, firma]
    );

    useEffect(() => {
        consultar(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const nombresAnalisis = (m: any): string => {
        if (Array.isArray(m.analisis) && m.analisis.length) return m.analisis.map((a: any) => a?.codigo ?? a?.nombre ?? a).join(', ');
        const ids: number[] = Array.isArray(m.analisis_ids) ? m.analisis_ids : [];
        return ids.map((id) => tiposAnalisis.find((t) => t.id === id)?.codigo ?? id).join(', ');
    };

    const abrir = async (fila: any, lectura: boolean) => {
        try {
            const d = asegurarOk(await labQuimicoApi.obtener(fila.id), 'No se pudo cargar la solicitud.').data;
            // TODO(CONFIRMAR CON BACKEND): estructura de la recepción ya registrada (solo para "Ver recepción").
            const r = d.recepcion ?? {};
            setDetalle(d);
            setSoloLectura(lectura);
            setClave(nuevoIdSolicitud());
            setSacosRecibidos(String(lectura ? pick(r, ['sacos', 'sacos_recibidos']) ?? pick(d, ['sacos_recibidos']) ?? d.sacos ?? '' : d.sacos ?? ''));
            setResultado(String(lectura ? pick(r, ['resultado']) ?? pick(d, ['resultado_recepcion']) ?? 'CONFORME' : 'CONFORME'));
            setObservaciones(lectura ? String(pick(r, ['observaciones']) ?? pick(d, ['observaciones_recepcion']) ?? '') : '');
            const recibidas: any[] = Array.isArray(r.muestras) ? r.muestras : [];
            setMuestras(
                (Array.isArray(d.muestras) ? d.muestras : []).map((m: any) => {
                    const rm = recibidas.find((x) => Number(x.id_muestra ?? x.id) === Number(m.id)) ?? m;
                    return {
                        id: m.id,
                        codigo: m.codigo,
                        enviada: Number(m.cantidad) || 0,
                        recibida: String(lectura ? pick(rm, ['cantidad_recibida', 'cantidad']) ?? m.cantidad : m.cantidad ?? ''),
                        analisis: nombresAnalisis(m),
                        condicion: String(lectura ? pick(rm, ['condicion']) ?? 'CONFORME' : 'CONFORME'),
                    };
                })
            );
        } catch (e: any) {
            notify(e?.message || 'No se pudo cargar la solicitud.', 'error', 4000);
        }
    };

    const verSolicitudFirmada = async () => {
        try {
            const url = detalle?.url_ultimo_documento;
            abrirPdf(url ? await descargarPdfBlob(url) : await labQuimicoApi.pdfSolicitud(detalle.id));
        } catch (e: any) {
            notify(e?.message || 'No se pudo abrir el PDF.', 'error', 4000);
        }
    };

    const verConstancia = async () => {
        try {
            abrirPdf(await labQuimicoApi.pdfRecepcion(detalle.id));
        } catch (e: any) {
            notify(e?.message || 'No se pudo abrir la constancia.', 'error', 4000);
        }
    };

    const confirmar = async () => {
        if (!detalle) return;
        if (sacosRecibidos === '' || Number(sacosRecibidos) < 0) return notify('Indique los sacos recibidos.', 'warning', 3000);
        if (muestras.some((m) => m.recibida === '' || Number(m.recibida) < 0)) return notify('Indique la cantidad recibida de cada muestra.', 'warning', 3000);
        if (resultado !== 'CONFORME' && !observaciones.trim()) return notify('Detalle las observaciones de la recepción.', 'warning', 3000);
        setGuardando(true);
        try {
            asegurarOk(
                await labQuimicoApi.recepcionar(detalle.id, {
                    clave,
                    version: detalle.version,
                    sacos: Number(sacosRecibidos),
                    resultado,
                    observaciones: observaciones.trim() || null,
                    muestras: muestras.map((m) => ({
                        id_muestra: m.id,
                        cantidad: Number(m.recibida),
                        condicion: m.condicion,
                        observacion: null,
                    })),
                }),
                'No se pudo confirmar la recepción.'
            );
            notify('Recepción confirmada.', 'success', 3000);
            setDetalle(null);
            await consultar(pagina);
        } catch (e: any) {
            notify(e?.message || 'No se pudo confirmar la recepción.', 'error', 5000);
        } finally {
            setGuardando(false);
        }
    };

    const muestrasDeclaradas = muestras.reduce((a, m) => a + m.enviada, 0);
    const muestrasRecibidas = muestras.reduce((a, m) => a + (Number(m.recibida) || 0), 0);
    const lbl = 'mb-1 block text-sm text-gray-600';
    const ro = `${inputCls} bg-gray-100`;

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
                <LabHeader titulo="Recepción de muestras" descripcion="Verifica las solicitudes y registra el ingreso físico de muestras." />

                <form
                    className="mb-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                    onSubmit={(e) => {
                        e.preventDefault();
                        consultar(1);
                    }}
                >
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div>
                            <label className={lbl}>Buscar N° o remitente</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input className={`${inputCls} pl-9`} placeholder="Ej. SA-2026-0012 o nombre…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                            </div>
                        </div>
                        <div>
                            <label className={lbl}>Desde</label>
                            <input type="date" className={inputCls} value={desde} onChange={(e) => setDesde(e.target.value)} />
                        </div>
                        <div>
                            <label className={lbl}>Hasta</label>
                            <input type="date" className={inputCls} value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} />
                        </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-end gap-4">
                        <div className="min-w-[180px]">
                            <label className={lbl}>Recepción</label>
                            <select className={inputCls} value={recepcion} onChange={(e) => setRecepcion(e.target.value)}>
                                <option value="LISTA">Pendientes</option>
                                <option value="RECIBIDA">Recibidas</option>
                                <option value="">Todas</option>
                            </select>
                        </div>
                        <div className="min-w-[180px]">
                            <label className={lbl}>Firma</label>
                            <select className={inputCls} value={firma} onChange={(e) => setFirma(e.target.value)}>
                                <option value="">Todas</option>
                                <option value="FIRMADA">Firmado</option>
                                <option value="EN_FIRMA">En firma</option>
                                <option value="ENVIADA">Sin firma (envío directo)</option>
                            </select>
                        </div>
                        <button type="submit" disabled={cargando} className="min-w-[200px] flex-1 rounded bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 sm:flex-none">
                            {cargando ? 'Consultando…' : 'Consultar'}
                        </button>
                    </div>
                </form>

                <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 bg-gray-50 text-gray-700">
                                    <th className="px-4 py-3 font-semibold">N° solicitud</th>
                                    <th className="px-4 py-3 font-semibold">Remitente</th>
                                    <th className="px-4 py-3 text-center font-semibold">Muestras</th>
                                    <th className="px-4 py-3 font-semibold">Firma</th>
                                    <th className="px-4 py-3 font-semibold">Recepción</th>
                                    <th className="px-4 py-3 text-center font-semibold">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cargando && <tr><td colSpan={6} className="py-10 text-center text-gray-400">Cargando…</td></tr>}
                                {!cargando && filas.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-gray-400">Sin solicitudes para los filtros indicados.</td></tr>}
                                {!cargando &&
                                    filas.map((f) => {
                                        const recibida = codigoEstado(campo.recepcion(f)) !== 'PENDIENTE';
                                        // Lista para recibir: firmada, o enviada directo (sin firma electrónica).
                                        const firmada = ['FIRMADA', 'FIRMADO', 'ENVIADA'].includes(codigoEstado(campo.estado(f)));
                                        return (
                                            <tr key={f.id} className="border-b border-gray-100 hover:bg-gray-50">
                                                <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-800">{campo.codigo(f)}</td>
                                                <td className="px-4 py-3">{campo.solicitante(f)}</td>
                                                <td className="px-4 py-3 text-center">{campo.muestras(f)}</td>
                                                <td className="px-4 py-3"><EstadoChip valor={campo.estado(f)} /></td>
                                                <td className="px-4 py-3"><RecepcionChip valor={campo.recepcion(f)} /></td>
                                                <td className="px-4 py-3 text-center">
                                                    {recibida ? (
                                                        <button type="button" onClick={() => abrir(f, true)} className="inline-flex items-center gap-2 rounded border border-blue-400 px-4 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50">
                                                            <Eye size={16} /> Ver recepción
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            disabled={!firmada}
                                                            title={firmada ? 'Registrar recepción' : 'Disponible al completar las firmas'}
                                                            onClick={() => abrir(f, false)}
                                                            className="inline-flex items-center gap-2 rounded bg-blue-600 px-5 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500 disabled:hover:bg-gray-200"
                                                        >
                                                            {firmada ? <PackageCheck size={16} /> : <Lock size={16} />} Recibir
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    </div>
                    <Paginacion pagina={pagina} total={total} tamano={TAM_PAGINA} mostrados={filas.length} onCambiar={consultar} cargando={cargando} etiqueta="solicitudes" />
                </div>
                <div className="mt-4 flex items-center gap-2 rounded border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                    <Info size={16} /> La recepción se habilita al completar las firmas, o de inmediato si la solicitud se envió directo (sin firma electrónica).
                </div>

                {detalle && (
                    <Modal
                        ancho="max-w-4xl"
                        titulo={`${soloLectura ? 'Recepción' : 'Recibir muestras'} · ${campo.codigo(detalle)}`}
                        onClose={() => !guardando && setDetalle(null)}
                        footer={
                            <div className="flex w-full flex-wrap items-center justify-between gap-3">
                                <span className="flex items-center gap-2 text-xs text-blue-700"><Info size={14} /> La recepción conserva la solicitud y su PDF firmado.</span>
                                <div className="flex gap-3">
                                    {soloLectura ? (
                                        <>
                                            <button type="button" className="flex items-center gap-2 rounded border border-gray-300 px-5 py-2 text-sm hover:bg-gray-50" onClick={verConstancia}><FileText size={16} /> Constancia PDF</button>
                                            <button type="button" className="rounded bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700" onClick={() => setDetalle(null)}>Cerrar</button>
                                        </>
                                    ) : (
                                        <>
                                            <button type="button" className="rounded border border-gray-300 px-5 py-2 text-sm hover:bg-gray-50" disabled={guardando} onClick={() => setDetalle(null)}>Cancelar</button>
                                            <button type="button" className="rounded bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60" disabled={guardando} onClick={confirmar}>
                                                {guardando ? 'Confirmando…' : 'Confirmar recepción'}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        }
                    >
                        <div className="space-y-5">
                            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-gray-200 p-4 text-sm">
                                <div className="flex flex-wrap gap-x-8 gap-y-2">
                                    <div><p className="text-xs text-gray-500">Compañía/Empresa:</p><p className="font-semibold">{campo.empresa(detalle)}</p></div>
                                    <div><p className="text-xs text-gray-500">Enviado por:</p><p className="font-semibold">{campo.solicitante(detalle)}</p></div>
                                    <div><p className="text-xs text-gray-500">Guardia:</p><p className="font-semibold">{{ DIA: 'Día', NOCHE: 'Noche' }[String(detalle.guardia ?? '').toUpperCase()] ?? detalle.guardia ?? '—'}</p></div>
                                    <div><p className="text-xs text-gray-500">Firma:</p>{detalle.requiere_firma === false ? <span className="inline-block rounded bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">Sin firma electrónica</span> : <EstadoChip valor={campo.estado(detalle)} />}</div>
                                </div>
                                <button type="button" onClick={verSolicitudFirmada} className="flex items-center gap-2 rounded border border-blue-400 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50">
                                    <FileText size={16} /> {detalle.requiere_firma === false ? 'Ver solicitud' : 'Ver solicitud firmada'}
                                </button>
                            </div>

                            <section className="rounded-lg border border-gray-200 p-4">
                                <h4 className="mb-3 font-semibold text-gray-900">Información de la solicitud</h4>
                                <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
                                    <div>
                                        <label className={lbl}>Tipo de muestra</label>
                                        <input className={ro} disabled value={pick(detalle, ['tipo_muestra', 'tipo_muestra_nombre', 'nombre_tipo_muestra']) ?? '—'} />
                                    </div>
                                    <div>
                                        <label className={lbl}>Indicaciones del remitente</label>
                                        <input className={ro} disabled value={detalle.indicaciones ?? ''} />
                                    </div>
                                </div>
                            </section>

                            <section className="rounded-lg border border-gray-200 p-4">
                                <h4 className="mb-3 font-semibold text-gray-900">Verificación de entrega</h4>
                                <div className="grid gap-4 sm:grid-cols-4">
                                    <div><label className={lbl}>Sacos declarados</label><input className={ro} disabled value={detalle.sacos ?? ''} /></div>
                                    <div>
                                        <label className={lbl}>Sacos recibidos</label>
                                        <input type="number" min={0} className={soloLectura ? ro : inputCls} disabled={soloLectura} value={sacosRecibidos} onChange={(e) => setSacosRecibidos(e.target.value)} />
                                    </div>
                                    <div><label className={lbl}>Muestras declaradas</label><input className={ro} disabled value={muestrasDeclaradas} /></div>
                                    <div><label className={lbl}>Muestras recibidas</label><input className={ro} disabled value={muestrasRecibidas} /></div>
                                </div>
                            </section>

                            <section className="rounded-lg border border-gray-200 p-4">
                                <h4 className="mb-3 font-semibold text-gray-900">Detalle recibido</h4>
                                <div className="overflow-x-auto rounded border border-gray-200">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-gray-50 text-gray-700">
                                                <th className="px-3 py-2 text-left font-semibold">Código</th>
                                                <th className="px-3 py-2 text-left font-semibold">Cant. enviada</th>
                                                <th className="px-3 py-2 text-left font-semibold">Cant. recibida</th>
                                                <th className="px-3 py-2 text-left font-semibold">Análisis solicitados</th>
                                                <th className="px-3 py-2 text-left font-semibold">Condición</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {muestras.map((m, i) => (
                                                <tr key={m.id} className="border-t border-gray-100">
                                                    <td className="px-3 py-2">{m.codigo}</td>
                                                    <td className="px-3 py-2">{m.enviada}</td>
                                                    <td className="px-3 py-2">
                                                        <input type="number" min={0} className={`${soloLectura ? ro : inputCls} max-w-[110px]`} disabled={soloLectura} value={m.recibida} onChange={(e) => setMuestras(muestras.map((x, j) => (j === i ? { ...x, recibida: e.target.value } : x)))} />
                                                    </td>
                                                    <td className="px-3 py-2">{m.analisis || '—'}</td>
                                                    <td className="px-3 py-2">
                                                        <select className={`${soloLectura ? ro : inputCls} max-w-[170px]`} disabled={soloLectura} value={m.condicion} onChange={(e) => setMuestras(muestras.map((x, j) => (j === i ? { ...x, condicion: e.target.value } : x)))}>
                                                            {RESULTADOS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                                                        </select>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <p className="mt-2 text-xs text-gray-500">Las cantidades enviadas se conservan. Registra lo recibido.</p>
                            </section>

                            <section className="rounded-lg border border-gray-200 p-4">
                                <div className="grid gap-4 sm:grid-cols-[260px_1fr]">
                                    <div>
                                        <h4 className="mb-3 font-semibold text-gray-900">Resultado de recepción</h4>
                                        <select className={soloLectura ? ro : inputCls} disabled={soloLectura} value={resultado} onChange={(e) => setResultado(e.target.value)}>
                                            {RESULTADOS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <h4 className="mb-3 font-semibold text-gray-900">Observaciones de recepción</h4>
                                        <textarea rows={3} className={soloLectura ? ro : inputCls} disabled={soloLectura} placeholder="Indica diferencias, bolsas dañadas o identificación ilegible…" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
                                    </div>
                                </div>
                            </section>

                            <section className="rounded-lg border border-gray-200 p-4">
                                <h4 className="mb-3 font-semibold text-gray-900">Responsable de recepción</h4>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div>
                                        <label className={lbl}>Recibido por:</label>
                                        <input className={ro} disabled value={soloLectura ? pick(detalle, ['recibido_por', 'usuario_recepcion']) ?? pick(detalle.recepcion, ['recibido_por', 'usuario']) ?? '—' : sesion.nombres} />
                                    </div>
                                    <div>
                                        <label className={lbl}>Fecha y hora:</label>
                                        <input className={ro} disabled value={soloLectura ? formatearFechaHora(pick(detalle, ['fecha_recepcion']) ?? pick(detalle.recepcion, ['fecha', 'fecha_recepcion'])) : 'Automática al confirmar'} />
                                    </div>
                                </div>
                                {!soloLectura && <p className="mt-2 text-xs text-gray-500">Se registra con tu usuario de sesión.</p>}
                            </section>
                        </div>
                    </Modal>
                )}
            </div>
        </div>
    );
};

export default RecepcionMuestras;
