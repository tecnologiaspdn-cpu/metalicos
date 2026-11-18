import React, { useCallback, useEffect, useMemo, useState } from 'react';
import notify from 'devextreme/ui/notify';
import { confirm } from 'devextreme/ui/dialog';
import { Eye, History, Pencil, Plus, Power, Save, Search } from 'lucide-react';
import {
    Badge, CONDICIONES, ESTADOS_OPERATIVOS, PersonalPicker, Paginacion, TiHeader, TiModal,
    activoEquipo, activoResponsable, activoTipo, etiqueta, filasDe, inputCls, personaId,
} from '../../components/Ti/TiShared';
import HistorialActivoModal from '../../components/Ti/HistorialActivoModal';
import { estaActivo } from '../../components/Comedor/comedorUtils';
import { asegurarOk, tiApi } from '../../services/ti/tiApi';

const TAM_PAGINA = 10;

// Campos que acepta el PUT completo (el backend los espera todos; los no usados van en null).
const CAMPOS_ACTIVO = [
    'codigo_activo', 'id_tipo_activo', 'descripcion', 'marca', 'modelo', 'serie', 'formato', 'procesador', 'ram_gb',
    'almacenamiento_detalle', 'tarjeta_grafica', 'sistema_operativo', 'imei1', 'imei2', 'lote', 'tecnologia_impresion',
    'consumible', 'id_empresa', 'id_area_uso', 'subarea_uso', 'ubicacion', 'condicion', 'estado_operativo', 'accesorios',
    'observaciones', 'acta_origen', 'firma_correo_estado',
];

type Form = Record<string, string>;

const formVacio = (idTipo: number | ''): Form => ({
    id_tipo_activo: String(idTipo),
    codigo_activo: '', marca: '', modelo: '', serie: '', descripcion: '',
    formato: 'LAPTOP', procesador: '', ram_gb: '', almacenamiento_detalle: '', sistema_operativo: '', tarjeta_grafica: '',
    imei1: '', imei2: '', lote: '', tecnologia_impresion: '', consumible: '',
    condicion: 'USADO', estado_operativo: 'OPERATIVO', ubicacion: '', accesorios: '', observaciones: '',
});

const nn = (v: string) => (v.trim() === '' ? null : v.trim());

const Activos: React.FC = () => {
    const [tipos, setTipos] = useState<any[]>([]);
    const [filas, setFilas] = useState<any[]>([]);
    const [cargando, setCargando] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [fTipo, setFTipo] = useState('');
    const [fCondicion, setFCondicion] = useState('');
    const [fEstado, setFEstado] = useState('1');
    const [pagina, setPagina] = useState(1);

    const [abierto, setAbierto] = useState(false);
    const [soloLectura, setSoloLectura] = useState(false);
    const [editando, setEditando] = useState<any | null>(null);
    const [form, setForm] = useState<Form>(formVacio(''));
    const [responsable, setResponsable] = useState<any | null>(null);
    const [guardando, setGuardando] = useState(false);
    const [historialDe, setHistorialDe] = useState<any | null>(null);

    useEffect(() => {
        tiApi.tipos().then((r) => setTipos(filasDe(r))).catch(() => notify('No se pudo cargar los tipos de activo.', 'error', 3500));
    }, []);

    const cargar = useCallback(async () => {
        setCargando(true);
        try {
            const resp = asegurarOk(
                await tiApi.activos.listar({ estado: fEstado || 'todos', busqueda: busqueda.trim(), tipo: fTipo, condicion: fCondicion }),
                'No se pudo cargar los activos.'
            );
            setFilas(filasDe(resp));
        } catch (e: any) {
            notify(e?.message || 'No se pudo cargar los activos.', 'error', 3500);
            setFilas([]);
        } finally {
            setCargando(false);
        }
    }, [fEstado, busqueda, fTipo, fCondicion]);

    useEffect(() => {
        const t = setTimeout(cargar, 300);
        return () => clearTimeout(t);
    }, [cargar]);

    useEffect(() => setPagina(1), [busqueda, fTipo, fCondicion, fEstado]);
    const visibles = useMemo(() => filas.slice((pagina - 1) * TAM_PAGINA, pagina * TAM_PAGINA), [filas, pagina]);

    const nombreTipo = (idTipo: any) => String(tipos.find((t) => String(t.id) === String(idTipo))?.nombre ?? '').toUpperCase();
    const tipoForm = nombreTipo(form.id_tipo_activo);

    const abrirNuevo = () => {
        setEditando(null);
        setSoloLectura(false);
        setResponsable(null);
        setForm(formVacio(tipos[0]?.id ?? ''));
        setAbierto(true);
    };

    const abrirFila = (a: any, lectura: boolean) => {
        const f = formVacio(a.id_tipo_activo ?? '');
        Object.keys(f).forEach((k) => {
            if (a[k] !== undefined && a[k] !== null) f[k] = String(a[k]);
        });
        setEditando(a);
        setSoloLectura(lectura);
        setForm(f);
        setAbierto(true);
    };

    const guardar = async () => {
        if (!form.id_tipo_activo) return notify('Seleccione el tipo de activo.', 'warning', 3000);
        if (tipoForm === 'COMPUTADORA' && !form.formato) return notify('Seleccione el formato de la computadora.', 'warning', 3000);
        if (!editando && !responsable) return notify('Seleccione el responsable inicial.', 'warning', 3000);
        setGuardando(true);
        try {
            const cuerpo: Record<string, any> = {};
            CAMPOS_ACTIVO.forEach((k) => {
                // Se conserva lo que el formulario no edita (empresa, área de uso, acta de origen…).
                cuerpo[k] = form[k] !== undefined ? nn(form[k]) : editando?.[k] ?? null;
            });
            cuerpo.id_tipo_activo = Number(form.id_tipo_activo);
            cuerpo.ram_gb = form.ram_gb ? Number(form.ram_gb) : null;
            if (editando) {
                asegurarOk(await tiApi.activos.actualizar(editando.id, { ...cuerpo, version: editando.version }), 'No se pudo actualizar el activo.');
            } else {
                asegurarOk(await tiApi.activos.crear({ ...cuerpo, id_personal_responsable: Number(personaId(responsable)) }), 'No se pudo crear el activo.');
            }
            notify('Activo guardado correctamente.', 'success', 2500);
            setAbierto(false);
            await cargar();
        } catch (e: any) {
            notify(e?.message || 'No se pudo guardar el activo.', 'error', 4000);
        } finally {
            setGuardando(false);
        }
    };

    const alternarEstado = async (a: any) => {
        const activo = estaActivo(a);
        const ok = await confirm(
            `¿${activo ? 'Dar de baja' : 'Reactivar'} el activo <b>${a.codigo_activo || activoEquipo(a)}</b>?`,
            activo ? 'Baja lógica' : 'Reactivar activo'
        );
        if (!ok) return;
        try {
            asegurarOk(await tiApi.activos.cambiarEstado(a.id, activo ? 0 : 1, a.version), 'No se pudo cambiar el estado.');
            await cargar();
        } catch (e: any) {
            notify(e?.message || 'No se pudo cambiar el estado.', 'error', 4000);
        }
    };

    const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });
    const campo = (k: string, label: string, ph = '', tipo = 'text') => (
        <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
            <input type={tipo} className={inputCls} placeholder={ph} value={form[k] ?? ''} onChange={set(k)} disabled={soloLectura} />
        </div>
    );
    const seccion = (t: string) => <h4 className="mb-2 mt-5 rounded bg-blue-50 px-3 py-1.5 text-sm font-semibold text-[#0a1f5c]">{t}</h4>;

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
                <TiHeader
                    titulo="Activos de TI"
                    descripcion="Consulta y administra el inventario de equipos."
                    acciones={
                        <button type="button" onClick={abrirNuevo} className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                            <Plus size={16} /> Nuevo activo
                        </button>
                    }
                />

                <div className="mb-4 flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="relative min-w-[240px] flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input className={`${inputCls} pl-9`} placeholder="Buscar por código, serie o responsable…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs text-gray-500">Tipo</label>
                        <select className={inputCls} value={fTipo} onChange={(e) => setFTipo(e.target.value)}>
                            <option value="">Todos</option>
                            {tipos.map((t) => <option key={t.id} value={t.id}>{etiqueta(t.nombre)}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs text-gray-500">Condición</label>
                        <select className={inputCls} value={fCondicion} onChange={(e) => setFCondicion(e.target.value)}>
                            <option value="">Todas</option>
                            {CONDICIONES.map((c) => <option key={c} value={c}>{etiqueta(c)}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs text-gray-500">Estado</label>
                        <select className={inputCls} value={fEstado} onChange={(e) => setFEstado(e.target.value)}>
                            <option value="todos">Todos</option>
                            <option value="1">Activos</option>
                            <option value="0">De baja</option>
                        </select>
                    </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-600">
                                    <th className="px-4 py-3">Serie</th>
                                    <th className="px-4 py-3">Tipo / Equipo</th>
                                    <th className="px-4 py-3">Responsable</th>
                                    <th className="px-4 py-3">Condición</th>
                                    <th className="px-4 py-3">Estado</th>
                                    <th className="px-4 py-3 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cargando && <tr><td colSpan={6} className="py-10 text-center text-gray-400">Cargando…</td></tr>}
                                {!cargando && visibles.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-gray-400">Sin activos.</td></tr>}
                                {!cargando &&
                                    visibles.map((a) => {
                                        const activo = estaActivo(a);
                                        return (
                                            <tr key={a.id} className={`border-b border-gray-100 hover:bg-gray-50 ${activo ? '' : 'opacity-60'}`}>
                                                <td className="px-4 py-3 font-semibold text-gray-900">{a.serie || '—'}</td>
                                                <td className="px-4 py-3">
                                                    <div className="font-medium">{etiqueta(activoTipo(a) || nombreTipo(a.id_tipo_activo))}</div>
                                                    <div className="text-xs text-gray-500">{[a.formato, [a.marca, a.modelo].filter(Boolean).join(' ') || a.descripcion].filter(Boolean).join(' - ')}</div>
                                                </td>
                                                <td className="px-4 py-3">{activoResponsable(a) || '—'}</td>
                                                <td className="px-4 py-3"><Badge valor={a.condicion} /></td>
                                                <td className="px-4 py-3"><Badge valor={activo ? a.estado_operativo : 'INACTIVO'} /></td>
                                                <td className="px-4 py-3">
                                                    <div className="flex justify-center gap-2">
                                                        <button type="button" title="Ver historial" onClick={() => setHistorialDe(a)} className="rounded border border-gray-300 p-2 text-gray-600 hover:bg-gray-50"><History size={16} /></button>
                                                        <button type="button" title="Ver" onClick={() => abrirFila(a, true)} className="rounded border border-gray-300 p-2 text-gray-600 hover:bg-gray-50"><Eye size={16} /></button>
                                                        <button type="button" title="Editar" onClick={() => abrirFila(a, false)} className="rounded border border-blue-300 p-2 text-blue-600 hover:bg-blue-50"><Pencil size={16} /></button>
                                                        <button
                                                            type="button"
                                                            title={activo ? 'Dar de baja' : 'Reactivar'}
                                                            onClick={() => alternarEstado(a)}
                                                            className={`rounded border p-2 ${activo ? 'border-red-300 text-red-600 hover:bg-red-50' : 'border-green-300 text-green-600 hover:bg-green-50'}`}
                                                        >
                                                            <Power size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    </div>
                    <Paginacion pagina={pagina} total={filas.length} tam={TAM_PAGINA} onChange={setPagina} unidad="activos" />
                </div>

                {historialDe && <HistorialActivoModal activo={historialDe} onClose={() => setHistorialDe(null)} />}

                {abierto && (
                    <TiModal
                        titulo={soloLectura ? 'Detalle del activo' : editando ? 'Editar activo' : 'Nuevo activo'}
                        onClose={() => !guardando && setAbierto(false)}
                        footer={
                            <>
                                <button type="button" className="rounded border border-gray-300 px-5 py-2 text-sm hover:bg-gray-50" onClick={() => setAbierto(false)} disabled={guardando}>
                                    {soloLectura ? 'Cerrar' : 'Cancelar'}
                                </button>
                                {!soloLectura && (
                                    <button type="button" className="flex items-center gap-2 rounded bg-blue-600 px-5 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60" onClick={guardar} disabled={guardando}>
                                        <Save size={16} /> {guardando ? 'Guardando…' : 'Guardar activo'}
                                    </button>
                                )}
                            </>
                        }
                    >
                        <label className="mb-2 block text-sm font-semibold text-gray-800">Tipo de activo <span className="text-red-500">*</span></label>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {tipos.map((t) => {
                                const sel = String(t.id) === form.id_tipo_activo;
                                return (
                                    <button
                                        key={t.id}
                                        type="button"
                                        disabled={soloLectura || !!editando}
                                        onClick={() => setForm({ ...form, id_tipo_activo: String(t.id) })}
                                        className={`rounded border px-3 py-2 text-sm font-medium ${sel ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'} disabled:cursor-not-allowed ${!sel && 'disabled:opacity-50'}`}
                                    >
                                        {etiqueta(t.nombre)}
                                    </button>
                                );
                            })}
                        </div>

                        {seccion('Datos generales')}
                        <div className="grid gap-3 sm:grid-cols-3">
                            {campo('codigo_activo', 'Código de activo', 'Sin código')}
                            {campo('marca', 'Marca')}
                            {campo('modelo', 'Modelo')}
                            {campo('serie', 'Serie', 'Ej. 5CD1234ABC')}
                            <div className="sm:col-span-2">
                                <label className="mb-1 block text-xs font-medium text-gray-600">Descripción</label>
                                <input className={inputCls} value={form.descripcion} onChange={set('descripcion')} disabled={soloLectura} placeholder="Ej. Laptop de trabajo administrativo" />
                            </div>
                        </div>

                        {tipoForm && seccion(`Características de ${etiqueta(tipoForm).toLowerCase()}`)}
                        {tipoForm === 'COMPUTADORA' && (
                            <div className="grid gap-3 sm:grid-cols-3">
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-600">Formato *</label>
                                    <select className={inputCls} value={form.formato} onChange={set('formato')} disabled={soloLectura}>
                                        {['LAPTOP', 'ESCRITORIO', 'ALL_IN_ONE', 'SERVIDOR'].map((f) => <option key={f} value={f}>{etiqueta(f)}</option>)}
                                    </select>
                                </div>
                                {campo('procesador', 'Procesador', 'Intel Core i5')}
                                {campo('ram_gb', 'RAM (GB)', '16', 'number')}
                                {campo('almacenamiento_detalle', 'Almacenamiento', 'SSD 512 GB')}
                                {campo('sistema_operativo', 'Sistema operativo', 'Windows 11')}
                                {campo('tarjeta_grafica', 'Tarjeta gráfica', 'Integrada')}
                            </div>
                        )}
                        {tipoForm === 'CELULAR' && (
                            <div className="grid gap-3 sm:grid-cols-3">
                                {campo('imei1', 'IMEI 1')}
                                {campo('imei2', 'IMEI 2')}
                                {campo('almacenamiento_detalle', 'Almacenamiento', '256 GB')}
                            </div>
                        )}
                        {tipoForm === 'RADIO' && <div className="grid gap-3 sm:grid-cols-3">{campo('lote', 'Lote')}</div>}
                        {tipoForm === 'IMPRESORA' && (
                            <div className="grid gap-3 sm:grid-cols-3">
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-600">Tecnología de impresión</label>
                                    <select className={inputCls} value={form.tecnologia_impresion} onChange={set('tecnologia_impresion')} disabled={soloLectura}>
                                        <option value="">—</option>
                                        {['INYECCION', 'LASER', 'TERMICA', 'MATRIZ'].map((f) => <option key={f} value={f}>{etiqueta(f)}</option>)}
                                    </select>
                                </div>
                                {campo('consumible', 'Consumible', 'Tinta')}
                            </div>
                        )}

                        {seccion('Asignación y estado')}
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            {!editando && (
                                <div className="sm:col-span-2 lg:col-span-4">
                                    <label className="mb-1 block text-xs font-medium text-gray-600">Responsable inicial *</label>
                                    <PersonalPicker valor={responsable} onChange={setResponsable} />
                                </div>
                            )}
                            <div>
                                <label className="mb-1 block text-xs font-medium text-gray-600">Condición</label>
                                <select className={inputCls} value={form.condicion} onChange={set('condicion')} disabled={soloLectura}>
                                    {CONDICIONES.map((c) => <option key={c} value={c}>{etiqueta(c)}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-medium text-gray-600">Estado operativo</label>
                                <select className={inputCls} value={form.estado_operativo} onChange={set('estado_operativo')} disabled={soloLectura}>
                                    {ESTADOS_OPERATIVOS.map((c) => <option key={c} value={c}>{etiqueta(c)}</option>)}
                                </select>
                            </div>
                            <div className="sm:col-span-2">{campo('ubicacion', 'Ubicación', 'Oficina de TI')}</div>
                        </div>
                        {editando && <p className="mt-2 text-xs text-gray-500">El responsable solo cambia mediante una transferencia.</p>}

                        {seccion('Accesorios y observaciones')}
                        <div className="grid gap-3">
                            <textarea className={inputCls} rows={2} placeholder="Cargador, maletín, licencia…" value={form.accesorios} onChange={set('accesorios')} disabled={soloLectura} />
                            <textarea className={inputCls} rows={2} placeholder="Observaciones" value={form.observaciones} onChange={set('observaciones')} disabled={soloLectura} />
                        </div>
                    </TiModal>
                )}
            </div>
        </div>
    );
};

export default Activos;
