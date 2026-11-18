import React, { useCallback, useEffect, useMemo, useState } from 'react';
import notify from 'devextreme/ui/notify';
import { confirm } from 'devextreme/ui/dialog';
import { FileText, Info, Pencil, Plus, Power, Save, Search, User, Utensils } from 'lucide-react';
import { Modal, inputCls } from './ComedorShared';
import { hoyLima, nombreCompleto, normalizarListado, pick, soloFecha, usuarioActual } from './comedorUtils';
import {
    armarDetalle, detalleDeFila, formatearPrecio, FormDieta, formDesdeFila, formVacioDieta, simboloMoneda,
    situacionDe, tiposDeDieta, validarDieta,
} from './dietasLogic';
import { asegurarOk, comedorApi, SituacionDieta } from '../../services/comedor/comedorApi';

const TAMANO = 10;
const SITUACIONES: { value: SituacionDieta; label: string }[] = [
    { value: 'TODOS', label: 'Todas' },
    { value: 'VIGENTE', label: 'Vigentes' },
    { value: 'PROGRAMADA', label: 'Programadas' },
    { value: 'VENCIDA', label: 'Vencidas' },
    { value: 'INACTIVA', label: 'Inactivas' },
];
const CHIP: Record<string, string> = {
    VIGENTE: 'bg-green-100 text-green-700',
    PROGRAMADA: 'bg-blue-100 text-blue-700',
    VENCIDA: 'bg-gray-200 text-gray-600',
    INACTIVA: 'bg-red-100 text-red-700',
};

interface Props {
    tipos: any[];
    puntos: any[];
}

const DietasTab: React.FC<Props> = ({ tipos, puntos }) => {
    const hoy = hoyLima();
    const tiposDieta = useMemo(() => tiposDeDieta(tipos), [tipos]);
    const puntosActivos = useMemo(() => puntos.filter((p) => p.estado === undefined || p.estado === true || p.estado === 1), [puntos]);

    const [filas, setFilas] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [pagina, setPagina] = useState(1);
    const [cargando, setCargando] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [busquedaAplicada, setBusquedaAplicada] = useState('');
    const [puntoFiltro, setPuntoFiltro] = useState('');
    const [situacion, setSituacion] = useState<SituacionDieta>('TODOS');

    const [abierto, setAbierto] = useState(false);
    const [editando, setEditando] = useState<any | null>(null);
    const [form, setForm] = useState<FormDieta>(() => formVacioDieta([], hoy));
    const [dni, setDni] = useState('');
    const [buscando, setBuscando] = useState(false);
    const [personal, setPersonal] = useState<any | null>(null);
    const [guardando, setGuardando] = useState(false);

    const cargar = useCallback(
        async (pag = pagina) => {
            setCargando(true);
            try {
                const resp = asegurarOk(
                    await comedorApi.dietas.listar({
                        situacion,
                        id_punto_atencion: puntoFiltro || undefined,
                        busqueda: busquedaAplicada || undefined,
                        pagina: pag,
                        tamano: TAMANO,
                    }),
                    'No se pudo cargar las dietas autorizadas.'
                );
                const { filas: f, total: t } = normalizarListado(resp.data);
                setFilas(f);
                setTotal(t);
            } catch (e: any) {
                notify(e?.message || 'No se pudo cargar las dietas autorizadas.', 'error', 3500);
                setFilas([]);
                setTotal(0);
            } finally {
                setCargando(false);
            }
        },
        [pagina, situacion, puntoFiltro, busquedaAplicada]
    );

    useEffect(() => {
        cargar();
    }, [cargar]);

    // Cualquier cambio de filtro vuelve a la página 1.
    useEffect(() => setPagina(1), [situacion, puntoFiltro, busquedaAplicada]);

    const abrirNueva = useCallback(() => {
        setEditando(null);
        setPersonal(null);
        setDni('');
        setForm(formVacioDieta(tiposDieta, hoyLima()));
        setAbierto(true);
    }, [tiposDieta]);

    useEffect(() => {
        const handler = (e: Event) => (e as CustomEvent).detail === 'dietas' && abrirNueva();
        window.addEventListener('comedor:nuevo', handler);
        return () => window.removeEventListener('comedor:nuevo', handler);
    }, [abrirNueva]);

    const abrirEditar = async (fila: any) => {
        try {
            // El listado puede no traer el detalle por comida: se consulta la dieta completa.
            const completa = detalleDeFila(fila).length ? fila : asegurarOk(await comedorApi.dietas.obtener(fila.id), 'No se pudo consultar la dieta.').data;
            setEditando(completa);
            setPersonal({
                id_personal: completa.id_personal,
                documento: pick(completa, ['documento', 'dni']),
                nombre: nombreCompleto(completa),
            });
            setDni(String(pick(completa, ['documento', 'dni']) ?? ''));
            setForm(formDesdeFila(completa, tiposDieta));
            setAbierto(true);
        } catch (e: any) {
            notify(e?.message || 'No se pudo abrir la dieta.', 'error', 3500);
        }
    };

    const buscarPersonal = async () => {
        const v = dni.trim();
        if (!/^\d{8}$/.test(v)) return notify('El DNI debe tener 8 dígitos.', 'warning', 3000);
        setBuscando(true);
        setPersonal(null);
        try {
            const resp = asegurarOk(await comedorApi.dietas.personalPorDni(v), 'No se encontró personal activo con ese DNI.');
            const d = resp.data;
            if (!d || !pick(d, ['id_personal', 'id'])) throw new Error('No se encontró personal activo con ese DNI.');
            setPersonal({
                id_personal: Number(pick(d, ['id_personal', 'id'])),
                documento: pick(d, ['documento', 'dni']) ?? v,
                nombre: nombreCompleto(d),
                empresa: pick(d, ['empresa', 'empresa_nombre', 'razon_social']),
                area: pick(d, ['area', 'area_nombre']),
            });
        } catch (e: any) {
            notify(e?.message || 'No se encontró personal activo con ese DNI.', 'warning', 3500);
        } finally {
            setBuscando(false);
        }
    };

    const guardar = async () => {
        const error = validarDieta(form, personal?.id_personal ?? null);
        if (error) return notify(error, 'warning', 3500);
        setGuardando(true);
        try {
            const cuerpo = {
                id_personal: Number(personal.id_personal),
                id_punto_atencion: Number(form.id_punto_atencion),
                vigente_desde: form.vigente_desde,
                vigente_hasta: form.vigente_hasta || null,
                moneda: form.moneda,
                observacion: form.observacion.trim() || null,
                usuario: usuarioActual(),
                detalle: armarDetalle(form),
            };
            if (editando) {
                asegurarOk(await comedorApi.dietas.actualizar(editando.id, { ...cuerpo, version: editando.version }), 'No se pudo actualizar la autorización.');
            } else {
                asegurarOk(await comedorApi.dietas.crear(cuerpo), 'No se pudo guardar la autorización.');
            }
            notify('Autorización guardada correctamente.', 'success', 2500);
            setAbierto(false);
            await cargar();
        } catch (e: any) {
            // 409 = autorización superpuesta: el backend explica el motivo en `message`.
            notify(e?.message || 'No se pudo guardar la autorización.', 'error', 5000);
        } finally {
            setGuardando(false);
        }
    };

    const alternar = async (fila: any) => {
        const activa = situacionDe(fila, hoy) !== 'INACTIVA';
        const ok = await confirm(`¿${activa ? 'Desactivar' : 'Reactivar'} la dieta de <b>${nombreCompleto(fila)}</b>?`, activa ? 'Desactivar dieta' : 'Reactivar dieta');
        if (!ok) return;
        try {
            asegurarOk(await comedorApi.dietas.cambiarEstado(fila.id, { estado: activa ? 0 : 1, version: fila.version, usuario: usuarioActual() }), 'No se pudo cambiar el estado.');
            await cargar();
        } catch (e: any) {
            notify(e?.message || 'No se pudo cambiar el estado.', 'error', 5000);
        }
    };

    const totalPaginas = Math.max(1, Math.ceil(total / TAMANO));
    const nombrePunto = (id: any) => puntos.find((p) => p.id === id)?.nombre ?? '—';
    const celdaComida = (fila: any, idTipo: number) => {
        const d = detalleDeFila(fila).find((x) => x.id_tipo_servicio === idTipo);
        return d ? formatearPrecio(d.precio, fila.moneda) : <span className="text-gray-400">General</span>;
    };
    const setComida = (id: number, parcial: Partial<{ aplicar: boolean; precio: string }>) =>
        setForm({ ...form, comidas: { ...form.comidas, [id]: { ...form.comidas[id], ...parcial } } });

    return (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                    <span className="text-blue-600"><FileText size={18} /></span> Dietas autorizadas
                </h3>
                <button type="button" onClick={abrirNueva} className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                    <Plus size={16} /> Autorizar dieta
                </button>
            </div>

            <div className="flex flex-wrap items-end gap-3 px-4 pb-4">
                <form className="relative min-w-[240px] flex-1" onSubmit={(e) => { e.preventDefault(); setBusquedaAplicada(busqueda.trim()); }}>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input className={`${inputCls} pl-9`} placeholder="Buscar por DNI o nombre… (Enter)" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                </form>
                <div>
                    <label className="mb-1 block text-xs text-gray-500">Punto de atención</label>
                    <select className={inputCls} value={puntoFiltro} onChange={(e) => setPuntoFiltro(e.target.value)}>
                        <option value="">Todos</option>
                        {puntos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                </div>
                <div>
                    <label className="mb-1 block text-xs text-gray-500">Situación</label>
                    <select className={inputCls} value={situacion} onChange={(e) => setSituacion(e.target.value as SituacionDieta)}>
                        {SITUACIONES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                </div>
            </div>

            <div className="overflow-x-auto px-4">
                <table className="w-full border-collapse text-left text-sm">
                    <thead>
                        <tr className="border-y border-gray-200 bg-gray-50 text-gray-700">
                            <th className="px-4 py-3 font-semibold">Personal / DNI</th>
                            <th className="px-4 py-3 font-semibold">Punto</th>
                            {tiposDieta.map((t) => <th key={t.id} className="px-4 py-3 font-semibold capitalize">{t.nombre.toLowerCase()}</th>)}
                            <th className="px-4 py-3 font-semibold">Vigencia</th>
                            <th className="px-4 py-3 text-center font-semibold">Situación</th>
                            <th className="px-4 py-3 text-center font-semibold">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {cargando && <tr><td colSpan={5 + tiposDieta.length} className="py-10 text-center text-gray-400">Cargando…</td></tr>}
                        {!cargando && filas.length === 0 && <tr><td colSpan={5 + tiposDieta.length} className="py-10 text-center text-gray-400">Sin dietas autorizadas.</td></tr>}
                        {!cargando && filas.map((f) => {
                            const sit = situacionDe(f, hoy);
                            return (
                                <tr key={f.id} className="border-b border-gray-100 hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                        <div className="font-medium uppercase text-gray-900">{nombreCompleto(f) || '—'}</div>
                                        <div className="text-xs text-gray-500">{pick(f, ['documento', 'dni']) ?? ''}</div>
                                    </td>
                                    <td className="px-4 py-3">{pick(f, ['punto_atencion', 'punto_atencion_nombre']) ?? nombrePunto(f.id_punto_atencion)}</td>
                                    {tiposDieta.map((t) => <td key={t.id} className="whitespace-nowrap px-4 py-3">{celdaComida(f, t.id)}</td>)}
                                    <td className="whitespace-nowrap px-4 py-3">{soloFecha(f.vigente_desde) || '—'} → {soloFecha(f.vigente_hasta) || 'sin vencimiento'}</td>
                                    <td className="px-4 py-3 text-center"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CHIP[sit] ?? 'bg-gray-100 text-gray-700'}`}>{sit}</span></td>
                                    <td className="px-4 py-3">
                                        <div className="flex justify-center gap-2">
                                            <button type="button" title="Editar" onClick={() => abrirEditar(f)} className="rounded border border-blue-300 p-2 text-blue-600 hover:bg-blue-50"><Pencil size={16} /></button>
                                            <button
                                                type="button"
                                                title={sit === 'INACTIVA' ? 'Reactivar' : 'Desactivar'}
                                                onClick={() => alternar(f)}
                                                className={`rounded border p-2 ${sit === 'INACTIVA' ? 'border-green-300 text-green-600 hover:bg-green-50' : 'border-red-300 text-red-600 hover:bg-red-50'}`}
                                            ><Power size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <p className="px-4 pt-3 text-xs text-gray-500">General: se aplica la tarifa habitual del servicio.</p>
            <div className="flex items-center justify-between p-4 text-sm text-gray-500">
                <span>Mostrando {filas.length === 0 ? 0 : (pagina - 1) * TAMANO + 1} a {(pagina - 1) * TAMANO + filas.length} de {total} registros</span>
                <div className="flex gap-2">
                    <button className="rounded border px-3 py-1 disabled:opacity-40" disabled={pagina <= 1 || cargando} onClick={() => setPagina(pagina - 1)}>Anterior</button>
                    <span className="rounded bg-blue-600 px-3 py-1 text-white">{pagina} / {totalPaginas}</span>
                    <button className="rounded border px-3 py-1 disabled:opacity-40" disabled={pagina >= totalPaginas || cargando} onClick={() => setPagina(pagina + 1)}>Siguiente</button>
                </div>
            </div>
            <div className="mx-4 mb-4 flex items-center gap-2 rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                <Info size={16} /> El precio autorizado se aplica al registrar el DNI o QR del personal.
            </div>

            {abierto && (
                <Modal
                    ancho="max-w-2xl"
                    titulo={editando ? 'Editar dieta autorizada' : 'Autorizar dieta'}
                    onClose={() => !guardando && setAbierto(false)}
                    footer={
                        <>
                            <button type="button" className="rounded border border-gray-300 px-5 py-2 text-sm hover:bg-gray-50" onClick={() => setAbierto(false)} disabled={guardando}>Cancelar</button>
                            <button type="button" className="flex items-center gap-2 rounded bg-blue-600 px-5 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60" onClick={guardar} disabled={guardando}>
                                <Save size={16} /> {guardando ? 'Guardando…' : 'Guardar autorización'}
                            </button>
                        </>
                    }
                >
                    <div className="space-y-4">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">Buscar personal por DNI <span className="text-red-500">*</span></label>
                            <div className="flex gap-2">
                                <input
                                    className={inputCls}
                                    placeholder="12345678"
                                    maxLength={8}
                                    inputMode="numeric"
                                    disabled={!!editando}
                                    value={dni}
                                    onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
                                    onKeyDown={(e) => e.key === 'Enter' && buscarPersonal()}
                                />
                                {!editando && (
                                    <button type="button" onClick={buscarPersonal} disabled={buscando} className="rounded bg-blue-600 px-5 text-sm text-white hover:bg-blue-700 disabled:opacity-60">
                                        {buscando ? '…' : 'Buscar'}
                                    </button>
                                )}
                            </div>
                        </div>

                        {personal && (
                            <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-500"><User size={20} /></div>
                                <div className="text-sm">
                                    <p className="text-base font-semibold uppercase text-gray-900">{personal.nombre || '—'}</p>
                                    <p className="text-gray-600">
                                        {personal.empresa && <>Empresa: {personal.empresa} </>}
                                        {personal.area && <>· Área: {personal.area}</>}
                                        {!personal.empresa && !personal.area && <>DNI {personal.documento}</>}
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">Punto de atención <span className="text-red-500">*</span></label>
                                <select className={inputCls} disabled={!!editando} value={form.id_punto_atencion} onChange={(e) => setForm({ ...form, id_punto_atencion: e.target.value })}>
                                    <option value="">Seleccione…</option>
                                    {(editando ? puntos : puntosActivos).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">Moneda</label>
                                <select className={inputCls} value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value })}>
                                    <option value="PEN">PEN (S/)</option>
                                    <option value="USD">USD ($)</option>
                                </select>
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">Vigente desde <span className="text-red-500">*</span></label>
                                <input type="date" className={inputCls} value={form.vigente_desde} onChange={(e) => setForm({ ...form, vigente_desde: e.target.value })} />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">Vigente hasta</label>
                                <input type="date" className={inputCls} min={form.vigente_desde} value={form.vigente_hasta} onChange={(e) => setForm({ ...form, vigente_hasta: e.target.value })} />
                                <p className="mt-0.5 text-xs text-gray-400">Vacío = sin vencimiento.</p>
                            </div>
                        </div>

                        <div>
                            <h4 className="mb-2 flex items-center gap-2 font-semibold text-gray-800"><Utensils size={16} className="text-blue-600" /> Comidas autorizadas</h4>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 text-left text-gray-600"><th className="px-3 py-2">Aplicar</th><th className="px-3 py-2">Servicio</th><th className="px-3 py-2">Precio especial</th></tr>
                                </thead>
                                <tbody>
                                    {tiposDieta.length === 0 && <tr><td colSpan={3} className="px-3 py-4 text-center text-gray-400">No hay tipos de servicio DESAYUNO, ALMUERZO o CENA activos.</td></tr>}
                                    {tiposDieta.map((t) => {
                                        const c = form.comidas[t.id] ?? { aplicar: false, precio: '' };
                                        return (
                                            <tr key={t.id} className="border-b border-gray-100">
                                                <td className="px-3 py-2"><input type="checkbox" aria-label={`Aplicar ${t.nombre}`} checked={c.aplicar} onChange={(e) => setComida(t.id, { aplicar: e.target.checked })} /></td>
                                                <td className="px-3 py-2 capitalize">{t.nombre.toLowerCase()}</td>
                                                <td className="px-3 py-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-gray-500">{simboloMoneda(form.moneda)}</span>
                                                        <input type="number" min="0" step="0.01" aria-label={`Precio ${t.nombre}`} className={inputCls} disabled={!c.aplicar} placeholder="Tarifa general" value={c.precio} onChange={(e) => setComida(t.id, { precio: e.target.value })} />
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            <p className="mt-1 text-xs text-gray-500">Seleccione una, dos o las tres comidas. Las no seleccionadas mantienen su tarifa general.</p>
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">Observación (opcional)</label>
                            <textarea className={inputCls} rows={2} maxLength={300} placeholder="Ej. Autorización temporal por comisión, etc." value={form.observacion} onChange={(e) => setForm({ ...form, observacion: e.target.value })} />
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default DietasTab;
