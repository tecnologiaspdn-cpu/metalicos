import React, { useCallback, useEffect, useMemo, useState } from 'react';
import notify from 'devextreme/ui/notify';
import { confirm } from 'devextreme/ui/dialog';
import DietasTab from '../../components/Comedor/DietasTab';
import { AlertTriangle, Building2, Clock, FileText, Info, Pencil, Plus, Power, Search, Tag, Utensils } from 'lucide-react';
import { ComedorHeader, EstadoBadge, Modal, inputCls } from '../../components/Comedor/ComedorShared';
import { estaActivo, horaCorta, soloFecha, usuarioActual } from '../../components/Comedor/comedorUtils';
import { asegurarOk, CatalogoApi, comedorApi } from '../../services/comedor/comedorApi';
import { apiManager } from '../../services/api/ApiManager';

type TipoCampo = 'text' | 'time' | 'number' | 'date' | 'select';

interface Campo {
    key: string;
    label: string;
    tipo: TipoCampo;
    requerido?: boolean;
    placeholder?: string;
    opciones?: { value: string | number; label: string }[];
    paso?: string;
}

interface Columna {
    titulo: string;
    render: (fila: any) => React.ReactNode;
}

interface ConfigTab {
    id: string;
    titulo: string;
    icono: React.ReactNode;
    nuevo: string;
    api: CatalogoApi;
    campos: Campo[];
    columnas: Columna[];
    /** Transforma los valores del formulario en el cuerpo del POST/PUT. */
    aPayload: (v: Record<string, string>) => any;
    /** Valores iniciales del formulario a partir de una fila existente. */
    desdeFila: (f: any) => Record<string, string>;
    /** Texto de la fila usado por el buscador. */
    textoBusqueda: (f: any) => string;
    /** Descripción de la fila para el diálogo de confirmación. */
    etiqueta: (f: any) => string;
}

const TAM_PAGINA = 10;
const horaApi = (h: string) => (h.length === 5 ? `${h}:00` : h);

// ───────────────────────── Pestaña genérica de catálogo ─────────────────────────
const CatalogoTab: React.FC<{ cfg: ConfigTab; onCambio: () => void }> = ({ cfg, onCambio }) => {
    const [filas, setFilas] = useState<any[]>([]);
    const [cargando, setCargando] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [pagina, setPagina] = useState(1);
    const [editando, setEditando] = useState<any | null>(null);
    const [abierto, setAbierto] = useState(false);
    const [valores, setValores] = useState<Record<string, string>>({});
    const [guardando, setGuardando] = useState(false);

    const cargar = useCallback(async () => {
        setCargando(true);
        try {
            const resp = asegurarOk(await cfg.api.listar('todos'), 'No se pudo cargar el listado.');
            setFilas(Array.isArray(resp.data) ? resp.data : []);
        } catch (e: any) {
            notify(e?.message || 'No se pudo cargar el listado.', 'error', 3500);
            setFilas([]);
        } finally {
            setCargando(false);
        }
    }, [cfg.api]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const filtradas = useMemo(() => {
        const q = busqueda.trim().toLowerCase();
        return q ? filas.filter((f) => cfg.textoBusqueda(f).toLowerCase().includes(q)) : filas;
    }, [filas, busqueda, cfg]);

    const totalPaginas = Math.max(1, Math.ceil(filtradas.length / TAM_PAGINA));
    useEffect(() => setPagina((p) => Math.min(p, totalPaginas)), [totalPaginas]);
    const visibles = filtradas.slice((pagina - 1) * TAM_PAGINA, pagina * TAM_PAGINA);

    // El botón "Nueva Variable" del encabezado abre este formulario vía evento.
    const abrirNuevo = useCallback(() => {
        setEditando(null);
        setValores(Object.fromEntries(cfg.campos.map((c) => [c.key, ''])));
        setAbierto(true);
    }, [cfg.campos]);

    useEffect(() => {
        const handler = (e: Event) => (e as CustomEvent).detail === cfg.id && abrirNuevo();
        window.addEventListener('comedor:nuevo', handler);
        return () => window.removeEventListener('comedor:nuevo', handler);
    }, [cfg.id, abrirNuevo]);

    const abrirEditar = (fila: any) => {
        setEditando(fila);
        setValores({ ...Object.fromEntries(cfg.campos.map((c) => [c.key, ''])), ...cfg.desdeFila(fila) });
        setAbierto(true);
    };

    const guardar = async () => {
        const faltante = cfg.campos.find((c) => c.requerido && !String(valores[c.key] ?? '').trim());
        if (faltante) {
            notify(`Complete el campo "${faltante.label}".`, 'warning', 3000);
            return;
        }
        setGuardando(true);
        try {
            const usuario = usuarioActual();
            const cuerpo = { ...cfg.aPayload(valores), usuario };
            if (editando) {
                asegurarOk(await cfg.api.actualizar(editando.id, { ...cuerpo, version: editando.version }), 'No se pudo actualizar.');
            } else {
                asegurarOk(await cfg.api.crear(cuerpo), 'No se pudo crear.');
            }
            notify('Guardado correctamente.', 'success', 2500);
            setAbierto(false);
            await cargar();
            onCambio();
        } catch (e: any) {
            notify(e?.message || 'No se pudo guardar.', 'error', 4000);
        } finally {
            setGuardando(false);
        }
    };

    const alternarEstado = async (fila: any) => {
        const activo = estaActivo(fila);
        const ok = await confirm(
            `¿${activo ? 'Desactivar' : 'Activar'} <b>${cfg.etiqueta(fila)}</b>?`,
            activo ? 'Desactivar' : 'Activar'
        );
        if (!ok) return;
        try {
            asegurarOk(
                await cfg.api.cambiarEstado(fila.id, { estado: activo ? 0 : 1, version: fila.version, usuario: usuarioActual() }),
                'No se pudo cambiar el estado.'
            );
            await cargar();
            onCambio();
        } catch (e: any) {
            notify(e?.message || 'No se pudo cambiar el estado.', 'error', 4000);
        }
    };

    return (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                    <span className="text-blue-600">{cfg.icono}</span> {cfg.titulo}
                </h3>
                <div className="relative w-full max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        className={`${inputCls} pl-9`}
                        placeholder="Buscar..."
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                    />
                </div>
            </div>

            <div className="overflow-x-auto px-4">
                <table className="w-full border-collapse text-left text-sm">
                    <thead>
                        <tr className="border-y border-gray-200 bg-gray-50 text-gray-700">
                            {cfg.columnas.map((c) => (
                                <th key={c.titulo} className="px-4 py-3 font-semibold">{c.titulo}</th>
                            ))}
                            <th className="px-4 py-3 text-center font-semibold">Estado</th>
                            <th className="px-4 py-3 text-center font-semibold">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {cargando && (
                            <tr><td colSpan={cfg.columnas.length + 2} className="py-10 text-center text-gray-400">Cargando…</td></tr>
                        )}
                        {!cargando && visibles.length === 0 && (
                            <tr><td colSpan={cfg.columnas.length + 2} className="py-10 text-center text-gray-400">Sin registros.</td></tr>
                        )}
                        {!cargando &&
                            visibles.map((f) => {
                                const activo = estaActivo(f);
                                return (
                                    <tr key={f.id} className="border-b border-gray-100 hover:bg-gray-50">
                                        {cfg.columnas.map((c) => (
                                            <td key={c.titulo} className="px-4 py-3 text-gray-800">{c.render(f)}</td>
                                        ))}
                                        <td className="px-4 py-3 text-center"><EstadoBadge activo={activo} /></td>
                                        <td className="px-4 py-3">
                                            <div className="flex justify-center gap-2">
                                                <button
                                                    type="button"
                                                    title="Editar"
                                                    onClick={() => abrirEditar(f)}
                                                    className="rounded border border-blue-300 p-2 text-blue-600 hover:bg-blue-50"
                                                >
                                                    <Pencil size={16} />
                                                </button>
                                                <button
                                                    type="button"
                                                    title={activo ? 'Desactivar' : 'Activar'}
                                                    onClick={() => alternarEstado(f)}
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

            <div className="flex items-center justify-between p-4 text-sm text-gray-500">
                <span>
                    Mostrando {filtradas.length === 0 ? 0 : (pagina - 1) * TAM_PAGINA + 1} a {Math.min(pagina * TAM_PAGINA, filtradas.length)} de {filtradas.length} registros
                </span>
                <div className="flex gap-2">
                    <button className="rounded border px-3 py-1 disabled:opacity-40" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</button>
                    <span className="rounded bg-blue-600 px-3 py-1 text-white">{pagina}</span>
                    <button className="rounded border px-3 py-1 disabled:opacity-40" disabled={pagina >= totalPaginas} onClick={() => setPagina(pagina + 1)}>Siguiente</button>
                </div>
            </div>

            {abierto && (
                <Modal
                    titulo={editando ? `Editar ${cfg.nuevo}` : `Nuevo ${cfg.nuevo}`}
                    onClose={() => !guardando && setAbierto(false)}
                    footer={
                        <>
                            <button type="button" className="rounded border border-gray-300 px-5 py-2 text-sm hover:bg-gray-50" onClick={() => setAbierto(false)} disabled={guardando}>
                                Cancelar
                            </button>
                            <button type="button" className="rounded bg-blue-600 px-5 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60" onClick={guardar} disabled={guardando}>
                                {guardando ? 'Guardando…' : 'Guardar'}
                            </button>
                        </>
                    }
                >
                    <div className="space-y-4">
                        {cfg.campos.map((c) => (
                            <div key={c.key}>
                                <label className="mb-1 block text-sm font-medium text-gray-700">
                                    {c.label} {c.requerido && <span className="text-red-500">*</span>}
                                </label>
                                {c.tipo === 'select' ? (
                                    <select className={inputCls} value={valores[c.key] ?? ''} onChange={(e) => setValores({ ...valores, [c.key]: e.target.value })}>
                                        <option value="">Seleccione…</option>
                                        {c.opciones?.map((o) => (
                                            <option key={o.value} value={o.value}>{o.label}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        className={inputCls}
                                        type={c.tipo}
                                        step={c.paso}
                                        placeholder={c.placeholder}
                                        value={valores[c.key] ?? ''}
                                        onChange={(e) => setValores({ ...valores, [c.key]: e.target.value })}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </Modal>
            )}
        </div>
    );
};

// ───────────────────────────────── Página ─────────────────────────────────
const VariablesSistema: React.FC = () => {
    const [tab, setTab] = useState('horarios');
    const [tipos, setTipos] = useState<any[]>([]);
    const [puntos, setPuntos] = useState<any[]>([]);
    const [empresas, setEmpresas] = useState<any[]>([]);

    // Catálogos de apoyo para los selects y para resolver nombres en las tablas.
    const cargarApoyo = useCallback(async () => {
        try {
            const [t, p] = await Promise.all([comedorApi.tipoServicios.listar('todos'), comedorApi.puntos.listar('todos')]);
            setTipos(Array.isArray(t?.data) ? t.data : []);
            setPuntos(Array.isArray(p?.data) ? p.data : []);
        } catch (e) {
            console.error('No se pudieron cargar los catálogos del comedor.', e);
        }
    }, []);

    useEffect(() => {
        cargarApoyo();
        apiManager.maestro
            .listaEmpresas({})
            .then((r: any) => setEmpresas(r?.data || []))
            .catch(() => setEmpresas([]));
    }, [cargarApoyo]);

    const nombreTipo = (id: any) => tipos.find((t) => t.id === id)?.nombre ?? '—';
    const nombrePunto = (id: any) => puntos.find((p) => p.id === id)?.nombre ?? '—';
    const opcTipos = tipos.filter(estaActivo).map((t) => ({ value: t.id, label: t.nombre }));
    const opcPuntos = puntos.filter(estaActivo).map((p) => ({ value: p.id, label: p.nombre }));
    const opcEmpresas = empresas.map((e) => ({ value: e.id, label: e.razonSocial ?? e.nombre ?? String(e.id) }));

    const tabs: ConfigTab[] = useMemo(
        () => [
            {
                id: 'horarios',
                titulo: 'Horarios de Atención',
                icono: <Clock size={18} />,
                nuevo: 'horario',
                api: comedorApi.horarios,
                campos: [
                    { key: 'id_punto_atencion', label: 'Punto de atención', tipo: 'select', requerido: true, opciones: opcPuntos },
                    { key: 'id_tipo_servicio', label: 'Tipo de servicio', tipo: 'select', requerido: true, opciones: opcTipos },
                    { key: 'codigo', label: 'Código', tipo: 'text', requerido: true, placeholder: 'Ej. H01' },
                    { key: 'hora_inicio', label: 'Hora inicio', tipo: 'time', requerido: true },
                    { key: 'hora_fin', label: 'Hora final', tipo: 'time', requerido: true },
                ],
                columnas: [
                    { titulo: 'Código', render: (f) => f.codigo },
                    { titulo: 'Nombre', render: (f) => nombreTipo(f.id_tipo_servicio) },
                    { titulo: 'Punto', render: (f) => nombrePunto(f.id_punto_atencion) },
                    { titulo: 'Hora inicio', render: (f) => horaCorta(f.hora_inicio) },
                    { titulo: 'Hora final', render: (f) => horaCorta(f.hora_fin) },
                ],
                aPayload: (v) => ({
                    id_punto_atencion: Number(v.id_punto_atencion),
                    id_tipo_servicio: Number(v.id_tipo_servicio),
                    codigo: v.codigo.trim().toUpperCase(),
                    hora_inicio: horaApi(v.hora_inicio),
                    hora_fin: horaApi(v.hora_fin),
                }),
                desdeFila: (f) => ({
                    id_punto_atencion: String(f.id_punto_atencion ?? ''),
                    id_tipo_servicio: String(f.id_tipo_servicio ?? ''),
                    codigo: f.codigo ?? '',
                    hora_inicio: horaCorta(f.hora_inicio),
                    hora_fin: horaCorta(f.hora_fin),
                }),
                textoBusqueda: (f) => `${f.codigo} ${nombreTipo(f.id_tipo_servicio)} ${nombrePunto(f.id_punto_atencion)}`,
                etiqueta: (f) => `${f.codigo} - ${nombreTipo(f.id_tipo_servicio)}`,
            },
            {
                id: 'tarifas',
                titulo: 'Precio de Servicios',
                icono: <Tag size={18} />,
                nuevo: 'precio',
                api: comedorApi.tarifas,
                campos: [
                    { key: 'id_punto_atencion', label: 'Punto de atención', tipo: 'select', requerido: true, opciones: opcPuntos },
                    { key: 'id_tipo_servicio', label: 'Tipo de servicio', tipo: 'select', requerido: true, opciones: opcTipos },
                    { key: 'precio', label: 'Precio', tipo: 'number', requerido: true, paso: '0.01' },
                    { key: 'moneda', label: 'Moneda', tipo: 'select', requerido: true, opciones: [{ value: 'PEN', label: 'PEN (S/)' }, { value: 'USD', label: 'USD ($)' }] },
                    { key: 'vigente_desde', label: 'Vigente desde', tipo: 'date', requerido: true },
                    { key: 'vigente_hasta', label: 'Vigente hasta (opcional)', tipo: 'date' },
                ],
                columnas: [
                    { titulo: 'Servicio', render: (f) => nombreTipo(f.id_tipo_servicio) },
                    { titulo: 'Punto', render: (f) => nombrePunto(f.id_punto_atencion) },
                    { titulo: 'Precio', render: (f) => `${f.moneda ?? ''} ${Number(f.precio).toFixed(2)}` },
                    { titulo: 'Vigente desde', render: (f) => soloFecha(f.vigente_desde) },
                    { titulo: 'Vigente hasta', render: (f) => soloFecha(f.vigente_hasta) || '—' },
                ],
                aPayload: (v) => ({
                    id_punto_atencion: Number(v.id_punto_atencion),
                    id_tipo_servicio: Number(v.id_tipo_servicio),
                    precio: Number(v.precio),
                    moneda: v.moneda,
                    vigente_desde: v.vigente_desde,
                    vigente_hasta: v.vigente_hasta || null,
                }),
                desdeFila: (f) => ({
                    id_punto_atencion: String(f.id_punto_atencion ?? ''),
                    id_tipo_servicio: String(f.id_tipo_servicio ?? ''),
                    precio: String(f.precio ?? ''),
                    moneda: f.moneda ?? 'PEN',
                    vigente_desde: soloFecha(f.vigente_desde),
                    vigente_hasta: soloFecha(f.vigente_hasta),
                }),
                textoBusqueda: (f) => `${nombreTipo(f.id_tipo_servicio)} ${nombrePunto(f.id_punto_atencion)} ${f.precio}`,
                etiqueta: (f) => `${nombreTipo(f.id_tipo_servicio)} (${f.moneda} ${Number(f.precio).toFixed(2)})`,
            },
            {
                id: 'tipos',
                titulo: 'Tipos de Servicio',
                icono: <Utensils size={18} />,
                nuevo: 'tipo de servicio',
                api: comedorApi.tipoServicios,
                campos: [
                    { key: 'codigo', label: 'Código', tipo: 'text', requerido: true, placeholder: 'Ej. DESAYUNO' },
                    { key: 'nombre', label: 'Nombre', tipo: 'text', requerido: true, placeholder: 'Ej. DESAYUNO' },
                ],
                columnas: [
                    { titulo: 'Código', render: (f) => f.codigo },
                    { titulo: 'Nombre', render: (f) => f.nombre },
                ],
                aPayload: (v) => ({ codigo: v.codigo.trim().toUpperCase(), nombre: v.nombre.trim().toUpperCase() }),
                desdeFila: (f) => ({ codigo: f.codigo ?? '', nombre: f.nombre ?? '' }),
                textoBusqueda: (f) => `${f.codigo} ${f.nombre}`,
                etiqueta: (f) => f.nombre,
            },
            {
                id: 'puntos',
                titulo: 'Puntos de Atención',
                icono: <Building2 size={18} />,
                nuevo: 'punto de atención',
                api: comedorApi.puntos,
                campos: [
                    { key: 'id_empresa', label: 'Empresa', tipo: 'select', requerido: true, opciones: opcEmpresas },
                    { key: 'codigo', label: 'Código', tipo: 'text', requerido: true, placeholder: 'Ej. COM-PLANTA' },
                    { key: 'nombre', label: 'Nombre', tipo: 'text', requerido: true, placeholder: 'Ej. Comedor Planta' },
                    { key: 'ubicacion', label: 'Ubicación', tipo: 'text', placeholder: 'Ej. Planta' },
                ],
                columnas: [
                    { titulo: 'Código', render: (f) => f.codigo },
                    { titulo: 'Nombre', render: (f) => f.nombre },
                    { titulo: 'Ubicación', render: (f) => f.ubicacion || '—' },
                ],
                aPayload: (v) => ({
                    id_empresa: Number(v.id_empresa),
                    codigo: v.codigo.trim().toUpperCase(),
                    nombre: v.nombre.trim(),
                    ubicacion: v.ubicacion.trim() || null,
                }),
                desdeFila: (f) => ({
                    id_empresa: String(f.id_empresa ?? ''),
                    codigo: f.codigo ?? '',
                    nombre: f.nombre ?? '',
                    ubicacion: f.ubicacion ?? '',
                }),
                textoBusqueda: (f) => `${f.codigo} ${f.nombre} ${f.ubicacion ?? ''}`,
                etiqueta: (f) => f.nombre,
            },
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [tipos, puntos, empresas]
    );

    const activa = tabs.find((t) => t.id === tab) ?? tabs[0];

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
                <ComedorHeader
                    subtitulo="Variables del Sistema"
                    descripcion="Configure los horarios de atención y demás parámetros del comedor."
                    onAyuda={() => notify('Los cambios se reflejan de inmediato en el registro de comensales y la impresión de tickets.', 'info', 5000)}
                    acciones={
                        <button
                            type="button"
                            onClick={() => window.dispatchEvent(new CustomEvent('comedor:nuevo', { detail: tab === 'dietas' ? 'dietas' : activa.id }))}
                            className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                        >
                            <Plus size={16} /> Nueva Variable
                        </button>
                    }
                />

                <div className="mb-4 flex flex-wrap overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                    {[...tabs, { id: 'dietas', titulo: 'Dietas autorizadas', icono: <FileText size={18} /> }].map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setTab(t.id)}
                            className={`flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-medium ${
                                tab === t.id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            {t.icono} {t.titulo}
                        </button>
                    ))}
                </div>

                {tab === 'dietas' ? (
                    <DietasTab tipos={tipos} puntos={puntos} />
                ) : (
                    <CatalogoTab key={activa.id} cfg={activa} onCambio={cargarApoyo} />
                )}

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                        <h4 className="mb-2 flex items-center gap-2 font-semibold text-blue-700"><Info size={18} /> Información</h4>
                        <p className="text-sm text-gray-700">Estas variables se utilizan para el registro de comensales y la impresión de tickets. Cualquier cambio se reflejará inmediatamente en el sistema.</p>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <h4 className="mb-2 flex items-center gap-2 font-semibold text-amber-700"><AlertTriangle size={18} /> Importante</h4>
                        <p className="text-sm text-gray-700">Verifique que los horarios estén correctamente configurados. Un horario mal configurado puede afectar el registro de comensales.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VariablesSistema;
