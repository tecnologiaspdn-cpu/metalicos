import React, { useCallback, useEffect, useMemo, useState } from 'react';
import notify from 'devextreme/ui/notify';
import { confirm } from 'devextreme/ui/dialog';
import { Check, Eye, Pencil, Plus, Save, Search, Trash2, UserRound, X } from 'lucide-react';
import { ComedorHeader, Modal, inputCls } from '../../components/Comedor/ComedorShared';
import { formatearFechaHora, hoyLima, pick, soloFecha, usuarioActual } from '../../components/Comedor/comedorUtils';
import { useComedorPuntos } from '../../hooks/useComedorPuntos';
import { apiManager } from '../../services/api/ApiManager';
import { asegurarOk, comedorApi, nuevoIdSolicitud } from '../../services/comedor/comedorApi';

const TAM_PAGINA = 15;
const MONEDA = 'PEN';

type Estado = 'REGISTRADO' | 'ATENDIDO' | 'ANULADO';

const ESTILO_ESTADO: Record<Estado, { cls: string; punto: string; label: string }> = {
    REGISTRADO: { cls: 'bg-blue-100 text-blue-700', punto: 'bg-blue-500', label: 'Registrado' },
    ATENDIDO: { cls: 'bg-green-100 text-green-700', punto: 'bg-green-500', label: 'Atendido' },
    ANULADO: { cls: 'bg-gray-200 text-gray-600', punto: 'bg-gray-500', label: 'Anulado' },
};

const dinero = (n: number) => `S/ ${(Number.isFinite(n) ? n : 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const redondear = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const estadoDe = (f: any): Estado => String(f?.estado ?? '').toUpperCase() as Estado;

interface LineaForm {
    concepto: string;
    cantidad: string;
    precio_unitario: string;
}

interface FormExtra {
    fecha_atencion: string;
    id_punto_atencion: string;
    id_empresa_cargo: string;
    solicitante: string;
    motivo: string;
    observaciones: string;
    detalle: LineaForm[];
}

const lineaVacia = (): LineaForm => ({ concepto: '', cantidad: '1', precio_unitario: '' });

const importe = (l: LineaForm) => redondear((Number(l.cantidad) || 0) * (Number(l.precio_unitario) || 0));

const EstadoChip: React.FC<{ estado: Estado }> = ({ estado }) => {
    const s = ESTILO_ESTADO[estado] ?? ESTILO_ESTADO.REGISTRADO;
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
            <span className={`h-2 w-2 rounded-full ${s.punto}`} />
            {s.label}
        </span>
    );
};

const Extras: React.FC = () => {
    const { puntos, idPunto } = useComedorPuntos();
    const [empresas, setEmpresas] = useState<any[]>([]);
    const hoy = hoyLima();

    const [fechaInicio, setFechaInicio] = useState(hoy);
    const [fechaFin, setFechaFin] = useState(hoy);
    const [puntoFiltro, setPuntoFiltro] = useState('');
    const [estado, setEstado] = useState('');
    const [busqueda, setBusqueda] = useState('');
    const [busquedaAplicada, setBusquedaAplicada] = useState('');

    const [filas, setFilas] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [totalVigente, setTotalVigente] = useState<number | null>(null);
    const [pagina, setPagina] = useState(1);
    const [cargando, setCargando] = useState(true);

    const [abierto, setAbierto] = useState(false);
    const [editando, setEditando] = useState<any | null>(null);
    const [soloLectura, setSoloLectura] = useState(false);
    const [idSolicitud, setIdSolicitud] = useState(nuevoIdSolicitud());
    const [form, setForm] = useState<FormExtra | null>(null);
    const [guardando, setGuardando] = useState(false);

    const [anulando, setAnulando] = useState<any | null>(null);
    const [motivoAnulacion, setMotivoAnulacion] = useState('');

    const nombreEmpresa = (e: any) => e?.razonSocial ?? e?.nombre ?? String(e?.id ?? '');
    const nombrePunto = (p: any) => p?.nombre ?? p?.codigo ?? String(p?.id ?? '');

    useEffect(() => {
        apiManager.maestro
            .listaEmpresas({})
            .then((r: any) => setEmpresas(r?.data || []))
            .catch(() => setEmpresas([]));
    }, []);

    // Por defecto se filtra por el punto de atención activo del equipo.
    useEffect(() => {
        if (idPunto && !puntoFiltro) setPuntoFiltro(String(idPunto));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idPunto]);

    const cargar = useCallback(
        async (pag = 1) => {
            if (!fechaInicio || !fechaFin) return notify('Indique el rango de fechas.', 'warning', 3000);
            if (fechaInicio > fechaFin) return notify('"Desde" no puede ser posterior a "Hasta".', 'warning', 3000);
            setCargando(true);
            try {
                const resp = asegurarOk(
                    await comedorApi.extras.listar({
                        fecha_inicio: fechaInicio,
                        fecha_fin: fechaFin,
                        id_punto_atencion: puntoFiltro || undefined,
                        estado: estado || undefined,
                        busqueda: busquedaAplicada || undefined,
                        pagina: pag,
                        tamano: TAM_PAGINA,
                    }),
                    'No se pudo cargar los extras.'
                );
                const f: any[] = Array.isArray(resp.data?.pedidos) ? resp.data.pedidos : [];
                setFilas(f);
                setTotal(Number(resp.data?.total ?? f.length));
                setPagina(pag);
                // Importes agrupados por moneda; el comedor opera solo en PEN.
                const pen = (resp.data?.importes_por_moneda ?? []).find((m: any) => m.moneda === MONEDA);
                setTotalVigente(pen ? Number(pen.total_vigente) : 0);
            } catch (e: any) {
                notify(e?.message || 'No se pudo cargar los extras.', 'error', 3500);
                setFilas([]);
                setTotal(0);
            } finally {
                setCargando(false);
            }
        },
        [fechaInicio, fechaFin, puntoFiltro, estado, busquedaAplicada]
    );

    useEffect(() => {
        cargar(1);
    }, [cargar]);

    const totalPaginas = Math.max(1, Math.ceil(total / TAM_PAGINA));

    // Si el backend no informa el total vigente, se suma lo no anulado de la página visible.
    const vigente = useMemo(
        () => totalVigente ?? redondear(filas.filter((f) => estadoDe(f) !== 'ANULADO').reduce((a, f) => a + Number(pick(f, ['total', 'monto_total', 'importe_total']) ?? 0), 0)),
        [totalVigente, filas]
    );

    const formDesde = (d: any): FormExtra => ({
        fecha_atencion: soloFecha(d.fecha_atencion) || hoy,
        id_punto_atencion: String(d.id_punto_atencion ?? ''),
        id_empresa_cargo: String(d.id_empresa_cargo ?? ''),
        solicitante: d.solicitante ?? '',
        motivo: d.motivo ?? '',
        observaciones: d.observaciones ?? '',
        detalle: (Array.isArray(d.detalle) ? d.detalle : []).map((l: any) => ({
            concepto: l.concepto ?? '',
            cantidad: String(l.cantidad ?? ''),
            precio_unitario: String(l.precio_unitario ?? ''),
        })),
    });

    const abrirNuevo = () => {
        setEditando(null);
        setSoloLectura(false);
        setIdSolicitud(nuevoIdSolicitud());
        setForm({
            fecha_atencion: hoy,
            id_punto_atencion: puntoFiltro || (idPunto ? String(idPunto) : ''),
            id_empresa_cargo: '',
            solicitante: '',
            motivo: '',
            observaciones: '',
            detalle: [lineaVacia()],
        });
        setAbierto(true);
    };

    const abrirExistente = async (fila: any, lectura: boolean) => {
        try {
            const resp = asegurarOk(await comedorApi.extras.obtener(fila.id), 'No se pudo cargar el pedido.');
            const d = resp.data;
            setEditando(d);
            setSoloLectura(lectura);
            setIdSolicitud(d.id_solicitud ?? nuevoIdSolicitud());
            setForm(formDesde(d));
            setAbierto(true);
        } catch (e: any) {
            notify(e?.message || 'No se pudo cargar el pedido.', 'error', 3500);
        }
    };

    const setCampo = (k: keyof Omit<FormExtra, 'detalle'>) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
        setForm((f) => (f ? { ...f, [k]: e.target.value } : f));

    const setLinea = (i: number, k: keyof LineaForm, v: string) =>
        setForm((f) => (f ? { ...f, detalle: f.detalle.map((l, j) => (j === i ? { ...l, [k]: v } : l)) } : f));

    const totalForm = form ? redondear(form.detalle.reduce((a, l) => a + importe(l), 0)) : 0;

    const guardar = async () => {
        if (!form) return;
        if (!form.fecha_atencion || !form.id_punto_atencion || !form.id_empresa_cargo) return notify('Complete fecha, punto de atención y empresa a cargo.', 'warning', 3000);
        if (!form.solicitante.trim() || !form.motivo.trim()) return notify('Complete solicitante y motivo.', 'warning', 3000);
        if (form.detalle.length === 0) return notify('Agregue al menos un concepto.', 'warning', 3000);
        for (const l of form.detalle) {
            if (!l.concepto.trim()) return notify('Todos los conceptos requieren descripción.', 'warning', 3000);
            if (!(Number(l.cantidad) > 0)) return notify('La cantidad debe ser mayor a 0.', 'warning', 3000);
            if (!(Number(l.precio_unitario) >= 0) || l.precio_unitario === '') return notify('Ingrese un precio unitario válido.', 'warning', 3000);
        }
        setGuardando(true);
        try {
            const cuerpo = {
                id_solicitud: idSolicitud,
                fecha_atencion: form.fecha_atencion,
                id_punto_atencion: Number(form.id_punto_atencion),
                id_empresa_cargo: Number(form.id_empresa_cargo),
                solicitante: form.solicitante.trim(),
                motivo: form.motivo.trim(),
                observaciones: form.observaciones.trim() || null,
                moneda: MONEDA,
                usuario: usuarioActual(),
                detalle: form.detalle.map((l) => ({
                    concepto: l.concepto.trim(),
                    cantidad: Number(l.cantidad),
                    precio_unitario: Number(l.precio_unitario),
                })),
            };
            if (editando) {
                asegurarOk(await comedorApi.extras.actualizar(editando.id, { ...cuerpo, version: editando.version }), 'No se pudo actualizar el pedido.');
            } else {
                asegurarOk(await comedorApi.extras.crear(cuerpo), 'No se pudo registrar el pedido.');
            }
            notify('Pedido guardado correctamente.', 'success', 2500);
            setAbierto(false);
            await cargar(editando ? pagina : 1);
        } catch (e: any) {
            notify(e?.message || 'No se pudo guardar el pedido.', 'error', 4000);
        } finally {
            setGuardando(false);
        }
    };

    const atender = async (f: any) => {
        const codigo = pick(f, ['codigo', 'codigo_pedido']) ?? f.id;
        if (!(await confirm(`¿Marcar el pedido <b>${codigo}</b> como atendido? Esta acción es definitiva.`, 'Marcar atendido'))) return;
        try {
            asegurarOk(await comedorApi.extras.atender(f.id, { version: f.version, usuario: usuarioActual() }), 'No se pudo marcar como atendido.');
            await cargar(pagina);
        } catch (e: any) {
            notify(e?.message || 'No se pudo marcar como atendido.', 'error', 4000);
        }
    };

    const anular = async () => {
        if (!anulando) return;
        if (!motivoAnulacion.trim()) return notify('Indique el motivo de la anulación.', 'warning', 3000);
        setGuardando(true);
        try {
            asegurarOk(
                await comedorApi.extras.anular(anulando.id, { version: anulando.version, usuario: usuarioActual(), motivo: motivoAnulacion.trim() }),
                'No se pudo anular el pedido.'
            );
            notify('Pedido anulado.', 'success', 2500);
            setAnulando(null);
            setMotivoAnulacion('');
            await cargar(pagina);
        } catch (e: any) {
            notify(e?.message || 'No se pudo anular el pedido.', 'error', 4000);
        } finally {
            setGuardando(false);
        }
    };

    const labelCls = 'mb-1 block text-xs font-medium text-gray-600';

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
                <ComedorHeader
                    icono={<UserRound size={28} />}
                    subtitulo="Registro de extras"
                    descripcion="Registra pedidos adicionales con cantidades y precios propios."
                    onAyuda={() => notify('El precio se define por pedido y no cambia la tarifa habitual del comedor. Un pedido ATENDIDO se incluye en la valorización.', 'info', 6000)}
                    acciones={
                        <button type="button" onClick={abrirNuevo} className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                            <Plus size={16} /> Registrar extra
                        </button>
                    }
                />

                <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                            <label className={labelCls}>Desde</label>
                            <input type="date" className={inputCls} value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
                        </div>
                        <div>
                            <label className={labelCls}>Hasta</label>
                            <input type="date" className={inputCls} value={fechaFin} min={fechaInicio} onChange={(e) => setFechaFin(e.target.value)} />
                        </div>
                        <div>
                            <label className={labelCls}>Punto de atención</label>
                            <select className={inputCls} value={puntoFiltro} onChange={(e) => setPuntoFiltro(e.target.value)}>
                                <option value="">Todos</option>
                                {puntos.map((p) => (
                                    <option key={p.id} value={p.id}>{nombrePunto(p)}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Estado</label>
                            <select className={inputCls} value={estado} onChange={(e) => setEstado(e.target.value)}>
                                <option value="">Todos</option>
                                <option value="REGISTRADO">Registrado</option>
                                <option value="ATENDIDO">Atendido</option>
                                <option value="ANULADO">Anulado</option>
                            </select>
                        </div>
                    </div>
                    <form
                        className="relative mt-4"
                        onSubmit={(e) => {
                            e.preventDefault();
                            setBusquedaAplicada(busqueda.trim());
                        }}
                    >
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input className={`${inputCls} pl-9`} placeholder="Buscar por pedido, solicitante o motivo… (Enter)" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                    </form>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 bg-gray-50 text-gray-700">
                                    <th className="px-4 py-3 font-semibold">Pedido</th>
                                    <th className="px-4 py-3 font-semibold">Fecha</th>
                                    <th className="px-4 py-3 font-semibold">Solicitante / Motivo</th>
                                    <th className="px-4 py-3 font-semibold">Punto</th>
                                    <th className="px-4 py-3 text-right font-semibold">Total</th>
                                    <th className="px-4 py-3 font-semibold">Estado</th>
                                    <th className="px-4 py-3 text-center font-semibold">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cargando && <tr><td colSpan={7} className="py-10 text-center text-gray-400">Cargando…</td></tr>}
                                {!cargando && filas.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-gray-400">Sin pedidos extra.</td></tr>}
                                {!cargando &&
                                    filas.map((f) => {
                                        const est = estadoDe(f);
                                        const registrado = est === 'REGISTRADO';
                                        return (
                                            <tr key={f.id} className="border-b border-gray-100 hover:bg-gray-50">
                                                <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-800">{pick(f, ['codigo', 'codigo_pedido']) ?? f.id}</td>
                                                <td className="whitespace-nowrap px-4 py-3">{soloFecha(f.fecha_atencion).split('-').reverse().join('/')}</td>
                                                <td className="px-4 py-3">
                                                    <div className="text-gray-900">{f.solicitante}</div>
                                                    <div className="text-xs text-gray-500">{f.motivo}</div>
                                                </td>
                                                <td className="px-4 py-3">{pick(f, ['punto_atencion', 'punto_atencion_nombre', 'punto', 'nombre_punto']) ?? '—'}</td>
                                                <td className="whitespace-nowrap px-4 py-3 text-right">{dinero(Number(pick(f, ['total', 'monto_total', 'importe_total']) ?? 0))}</td>
                                                <td className="px-4 py-3"><EstadoChip estado={est} /></td>
                                                <td className="px-4 py-3">
                                                    <div className="flex justify-center gap-2">
                                                        <button type="button" title="Ver detalle" onClick={() => abrirExistente(f, true)} className="rounded border border-blue-300 p-2 text-blue-600 hover:bg-blue-50">
                                                            <Eye size={16} />
                                                        </button>
                                                        {registrado && (
                                                            <>
                                                                <button type="button" title="Editar" onClick={() => abrirExistente(f, false)} className="rounded border border-blue-300 p-2 text-blue-600 hover:bg-blue-50">
                                                                    <Pencil size={16} />
                                                                </button>
                                                                <button type="button" title="Marcar atendido" onClick={() => atender(f)} className="rounded border border-green-300 p-2 text-green-600 hover:bg-green-50">
                                                                    <Check size={16} />
                                                                </button>
                                                                <button type="button" title="Anular" onClick={() => { setAnulando(f); setMotivoAnulacion(''); }} className="rounded border border-red-300 p-2 text-red-600 hover:bg-red-50">
                                                                    <X size={16} />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    </div>
                    <div className="border-t border-gray-100 px-4 py-3 text-right text-sm">
                        <span className="font-semibold text-gray-700">Total vigente: </span>
                        <span className="text-lg font-bold text-gray-900">{dinero(vigente)}</span>
                    </div>
                    <div className="flex items-center justify-between p-4 text-sm text-gray-500">
                        <span>
                            Mostrando {total === 0 ? 0 : (pagina - 1) * TAM_PAGINA + 1} a {Math.min(pagina * TAM_PAGINA, total)} de {total} pedidos
                        </span>
                        <div className="flex gap-2">
                            <button className="rounded border px-3 py-1 disabled:opacity-40" disabled={pagina <= 1} onClick={() => cargar(pagina - 1)}>Anterior</button>
                            <span className="rounded bg-blue-600 px-3 py-1 text-white">{pagina}</span>
                            <button className="rounded border px-3 py-1 disabled:opacity-40" disabled={pagina >= totalPaginas} onClick={() => cargar(pagina + 1)}>Siguiente</button>
                        </div>
                    </div>
                </div>

                {abierto && form && (
                    <Modal
                        ancho="max-w-3xl"
                        titulo={soloLectura ? `Pedido ${pick(editando, ['codigo', 'codigo_pedido']) ?? ''}` : editando ? 'Editar extra' : 'Registrar extra'}
                        subtitulo={editando ? `Estado: ${ESTILO_ESTADO[estadoDe(editando)]?.label ?? editando.estado}${editando.fecha_registro ? ` · ${formatearFechaHora(editando.fecha_registro)}` : ''}` : undefined}
                        onClose={() => !guardando && setAbierto(false)}
                        footer={
                            soloLectura ? (
                                <button type="button" className="rounded border border-gray-300 px-5 py-2 text-sm hover:bg-gray-50" onClick={() => setAbierto(false)}>Cerrar</button>
                            ) : (
                                <>
                                    <button type="button" className="rounded border border-gray-300 px-5 py-2 text-sm hover:bg-gray-50" onClick={() => setAbierto(false)} disabled={guardando}>Cancelar</button>
                                    <button type="button" className="flex items-center gap-2 rounded bg-blue-600 px-5 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60" onClick={guardar} disabled={guardando}>
                                        <Save size={16} /> {guardando ? 'Guardando…' : 'Guardar pedido'}
                                    </button>
                                </>
                            )
                        }
                    >
                        <fieldset disabled={soloLectura} className="space-y-5">
                            {soloLectura && editando?.estado === 'ANULADO' && (
                                <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                    Anulado por <b>{editando.usuario_anulacion ?? '—'}</b> el {formatearFechaHora(editando.fecha_anulacion)}. Motivo: {editando.motivo_anulacion ?? '—'}
                                </div>
                            )}
                            {soloLectura && editando?.estado === 'ATENDIDO' && (
                                <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                                    Atendido por <b>{editando.usuario_atencion ?? '—'}</b> el {formatearFechaHora(editando.fecha_confirmacion_atencion)}.
                                </div>
                            )}
                            <h4 className="font-semibold text-gray-900">Datos del pedido</h4>
                            <div className="grid gap-4 sm:grid-cols-3">
                                <div>
                                    <label className={labelCls}>Fecha de atención <span className="text-red-500">*</span></label>
                                    <input type="date" className={inputCls} value={form.fecha_atencion} onChange={setCampo('fecha_atencion')} />
                                </div>
                                <div>
                                    <label className={labelCls}>Punto de atención <span className="text-red-500">*</span></label>
                                    <select className={inputCls} value={form.id_punto_atencion} onChange={setCampo('id_punto_atencion')}>
                                        <option value="">Seleccione…</option>
                                        {puntos.map((p) => (
                                            <option key={p.id} value={p.id}>{nombrePunto(p)}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelCls}>Empresa a cargo <span className="text-red-500">*</span></label>
                                    <select className={inputCls} value={form.id_empresa_cargo} onChange={setCampo('id_empresa_cargo')}>
                                        <option value="">Seleccione…</option>
                                        {empresas.map((e) => (
                                            <option key={e.id} value={e.id}>{nombreEmpresa(e)}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label className={labelCls}>Solicitante <span className="text-red-500">*</span></label>
                                    <input className={inputCls} value={form.solicitante} onChange={setCampo('solicitante')} />
                                </div>
                                <div>
                                    <label className={labelCls}>Motivo <span className="text-red-500">*</span></label>
                                    <input className={inputCls} value={form.motivo} onChange={setCampo('motivo')} />
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-gray-900">Detalle del pedido</h4>
                                {!soloLectura && (
                                    <button
                                        type="button"
                                        onClick={() => setForm({ ...form, detalle: [...form.detalle, lineaVacia()] })}
                                        className="flex items-center gap-2 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                                    >
                                        <Plus size={14} /> Agregar concepto
                                    </button>
                                )}
                            </div>
                            <div className="overflow-x-auto rounded-lg border border-gray-200">
                                <table className="w-full text-left text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 text-gray-600">
                                            <th className="px-3 py-2 font-medium">Concepto</th>
                                            <th className="w-24 px-3 py-2 font-medium">Cantidad</th>
                                            <th className="w-32 px-3 py-2 font-medium">Precio unit.</th>
                                            <th className="w-28 px-3 py-2 text-right font-medium">Importe</th>
                                            {!soloLectura && <th className="w-10" />}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {form.detalle.map((l, i) => (
                                            <tr key={i} className="border-t border-gray-100">
                                                <td className="px-3 py-2"><input className={inputCls} value={l.concepto} onChange={(e) => setLinea(i, 'concepto', e.target.value)} /></td>
                                                <td className="px-3 py-2"><input type="number" min={1} step="any" className={inputCls} value={l.cantidad} onChange={(e) => setLinea(i, 'cantidad', e.target.value)} /></td>
                                                <td className="px-3 py-2"><input type="number" min={0} step="0.01" className={inputCls} value={l.precio_unitario} onChange={(e) => setLinea(i, 'precio_unitario', e.target.value)} /></td>
                                                <td className="whitespace-nowrap px-3 py-2 text-right">{dinero(importe(l))}</td>
                                                {!soloLectura && (
                                                    <td className="px-2 py-2">
                                                        <button
                                                            type="button"
                                                            title="Quitar concepto"
                                                            disabled={form.detalle.length === 1}
                                                            onClick={() => setForm({ ...form, detalle: form.detalle.filter((_, j) => j !== i) })}
                                                            className="rounded border border-red-300 p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-40"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                <span className="text-xs text-gray-500">El precio se define por pedido y no cambia la tarifa habitual del comedor.</span>
                                <span className="font-semibold text-gray-800">Total: <span className="text-lg">{dinero(totalForm)}</span></span>
                            </div>

                            <div>
                                <label className={labelCls}>Observaciones (opcional)</label>
                                <textarea rows={3} className={inputCls} placeholder="Agrega alguna observación adicional…" value={form.observaciones} onChange={setCampo('observaciones')} />
                            </div>
                        </fieldset>
                    </Modal>
                )}

                {anulando && (
                    <Modal
                        titulo="Anular pedido"
                        subtitulo={`${pick(anulando, ['codigo', 'codigo_pedido']) ?? anulando.id} · ${anulando.solicitante ?? ''}`}
                        onClose={() => !guardando && setAnulando(null)}
                        footer={
                            <>
                                <button type="button" className="rounded border border-gray-300 px-5 py-2 text-sm hover:bg-gray-50" onClick={() => setAnulando(null)} disabled={guardando}>Cancelar</button>
                                <button type="button" className="rounded bg-red-600 px-5 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-60" onClick={anular} disabled={guardando}>
                                    {guardando ? 'Anulando…' : 'Anular pedido'}
                                </button>
                            </>
                        }
                    >
                        <label className={labelCls}>Motivo de la anulación <span className="text-red-500">*</span></label>
                        <textarea rows={3} className={inputCls} value={motivoAnulacion} onChange={(e) => setMotivoAnulacion(e.target.value)} />
                    </Modal>
                )}
            </div>
        </div>
    );
};

export default Extras;
