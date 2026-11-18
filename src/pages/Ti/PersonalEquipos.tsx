import React, { useCallback, useEffect, useState } from 'react';
import notify from 'devextreme/ui/notify';
import { Eye, FileClock, Search } from 'lucide-react';
import {
    Badge, Paginacion, TiHeader, TiModal, activoEquipo, filasDe, inputCls, personaArea, personaCantidad,
    personaDni, personaEmpresa, personaId, personaNombre,
} from '../../components/Ti/TiShared';
import HistorialActivoModal from '../../components/Ti/HistorialActivoModal';
import { formatearFechaHora, pick } from '../../components/Comedor/comedorUtils';
import { apiManager } from '../../services/api/ApiManager';
import { asegurarOk, tiApi } from '../../services/ti/tiApi';

const TAM_PAGINA = 10;

const PersonalEquipos: React.FC = () => {
    const [areas, setAreas] = useState<any[]>([]);
    const [busqueda, setBusqueda] = useState('');
    const [area, setArea] = useState('');
    const [equipo, setEquipo] = useState('');
    const [filtros, setFiltros] = useState({ busqueda: '', area: '', equipo: '' });
    const [filas, setFilas] = useState<any[]>([]);
    const [cargando, setCargando] = useState(true);
    const [pagina, setPagina] = useState(1);

    const [persona, setPersona] = useState<any | null>(null);
    const [equipos, setEquipos] = useState<any[]>([]);
    const [cargandoEquipos, setCargandoEquipos] = useState(false);
    const [historialDe, setHistorialDe] = useState<any | null>(null);

    useEffect(() => {
        apiManager.maestro
            .listaAreas({})
            .then((r: any) => setAreas(Array.isArray(r?.data) ? r.data : []))
            .catch(() => undefined);
    }, []);

    const cargar = useCallback(async () => {
        setCargando(true);
        try {
            const resp = asegurarOk(await tiApi.personal.listar(filtros), 'No se pudo cargar el personal.');
            setFilas(filasDe(resp));
        } catch (e: any) {
            notify(e?.message || 'No se pudo cargar el personal.', 'error', 3500);
            setFilas([]);
        } finally {
            setCargando(false);
        }
    }, [filtros]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const buscar = () => {
        setPagina(1);
        setFiltros({ busqueda: busqueda.trim(), area, equipo: equipo.trim() });
    };
    const limpiar = () => {
        setBusqueda('');
        setArea('');
        setEquipo('');
        setPagina(1);
        setFiltros({ busqueda: '', area: '', equipo: '' });
    };

    const verEquipos = async (p: any) => {
        setPersona(p);
        setEquipos([]);
        setCargandoEquipos(true);
        try {
            const resp = asegurarOk(await tiApi.personal.equipos(personaId(p)), 'No se pudo cargar los equipos.');
            // Puede devolver { personal, equipos } o directamente la lista.
            const d = resp.data as any;
            if (d?.personal) setPersona({ ...p, ...d.personal });
            setEquipos(Array.isArray(d) ? d : Array.isArray(d?.equipos) ? d.equipos : []);
        } catch (e: any) {
            notify(e?.message || 'No se pudo cargar los equipos.', 'error', 3500);
        } finally {
            setCargandoEquipos(false);
        }
    };

    const visibles = filas.slice((pagina - 1) * TAM_PAGINA, pagina * TAM_PAGINA);

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
                <TiHeader titulo="Personal y Equipos" descripcion="Consulta los activos actualmente asignados a cada colaborador." />

                <form
                    className="mb-4 flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                    onSubmit={(e) => {
                        e.preventDefault();
                        buscar();
                    }}
                >
                    <div className="min-w-[200px]">
                        <label className="mb-1 block text-xs text-gray-500">DNI o nombre</label>
                        <input className={inputCls} placeholder="Buscar persona" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                    </div>
                    <div className="min-w-[160px]">
                        <label className="mb-1 block text-xs text-gray-500">Área</label>
                        <select className={inputCls} value={area} onChange={(e) => setArea(e.target.value)}>
                            <option value="">Todos</option>
                            {areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                        </select>
                    </div>
                    <div className="min-w-[240px] flex-1">
                        <label className="mb-1 block text-xs text-gray-500">Equipo</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input className={`${inputCls} pl-9`} placeholder="Código, serie, marca o modelo" value={equipo} onChange={(e) => setEquipo(e.target.value)} />
                        </div>
                    </div>
                    <button type="submit" className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"><Search size={16} /> Buscar</button>
                    <button type="button" onClick={limpiar} className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">Limpiar</button>
                    <p className="w-full rounded bg-blue-50 px-3 py-2 text-xs text-blue-700">Los filtros se combinan. Una fila por persona.</p>
                </form>

                <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-600">
                                    <th className="px-4 py-3">DNI</th>
                                    <th className="px-4 py-3">Colaborador</th>
                                    <th className="px-4 py-3">Área</th>
                                    <th className="px-4 py-3 text-center">Equipos asignados</th>
                                    <th className="px-4 py-3 text-center">Ver equipos</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cargando && <tr><td colSpan={5} className="py-10 text-center text-gray-400">Cargando…</td></tr>}
                                {!cargando && visibles.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-gray-400">Sin resultados.</td></tr>}
                                {!cargando &&
                                    visibles.map((p, i) => (
                                        <tr key={personaId(p) ?? i} className="border-b border-gray-100 hover:bg-gray-50">
                                            <td className="px-4 py-3">{personaDni(p) || '—'}</td>
                                            <td className="px-4 py-3 font-medium text-gray-900">{personaNombre(p)}</td>
                                            <td className="px-4 py-3">{personaArea(p) || '—'}</td>
                                            <td className="px-4 py-3 text-center">{personaCantidad(p)}</td>
                                            <td className="px-4 py-3 text-center">
                                                <button type="button" title="Ver equipos asignados" onClick={() => verEquipos(p)} className="rounded border border-gray-300 p-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600">
                                                    <Eye size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                    <Paginacion pagina={pagina} total={filas.length} tam={TAM_PAGINA} onChange={setPagina} unidad="personas" />
                </div>

                {persona && !historialDe && (
                    <TiModal
                        titulo="Equipos asignados"
                        onClose={() => setPersona(null)}
                        ancho="xl"
                        footer={<button type="button" className="rounded bg-blue-600 px-5 py-2 text-sm text-white hover:bg-blue-700" onClick={() => setPersona(null)}>Cerrar</button>}
                    >
                        <div className="mb-4 flex flex-wrap items-center gap-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm">
                            <div className="text-xl font-semibold text-gray-900">{personaNombre(persona)}</div>
                            <div><span className="block text-xs text-gray-500">DNI</span>{personaDni(persona) || '—'}</div>
                            <div><span className="block text-xs text-gray-500">Área</span>{personaArea(persona) || '—'}</div>
                            <div><span className="block text-xs text-gray-500">Empresa</span>{personaEmpresa(persona) || '—'}</div>
                            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">{equipos.length} equipos asignados</span>
                        </div>
                        <div className="overflow-x-auto rounded-lg border border-gray-200">
                            <table className="w-full border-collapse text-left text-sm">
                                <thead>
                                    <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-600">
                                        <th className="px-3 py-2">Código</th>
                                        <th className="px-3 py-2">Equipo</th>
                                        <th className="px-3 py-2">Serie</th>
                                        <th className="px-3 py-2">Condición</th>
                                        <th className="px-3 py-2">Estado</th>
                                        <th className="px-3 py-2">Fecha de asignación</th>
                                        <th className="px-3 py-2 text-center">Historial</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cargandoEquipos && <tr><td colSpan={7} className="py-8 text-center text-gray-400">Cargando…</td></tr>}
                                    {!cargandoEquipos && equipos.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-gray-400">Sin equipos asignados.</td></tr>}
                                    {equipos.map((a, i) => (
                                        <tr key={a.id ?? i} className="border-b border-gray-100">
                                            <td className="px-3 py-2 font-semibold">{a.codigo_activo || '—'}</td>
                                            <td className="px-3 py-2">{activoEquipo(a)}</td>
                                            <td className="px-3 py-2">{a.serie || '—'}</td>
                                            <td className="px-3 py-2"><Badge valor={a.condicion} /></td>
                                            <td className="px-3 py-2"><Badge valor={a.estado_operativo} /></td>
                                            <td className="whitespace-nowrap px-3 py-2">{formatearFechaHora(pick(a, ['fecha_asignacion', 'fecha_entrega', 'fecha_responsable']))}</td>
                                            <td className="px-3 py-2 text-center">
                                                <button type="button" title="Ver historial" onClick={() => setHistorialDe(a)} className="rounded border border-gray-300 p-2 text-gray-600 hover:bg-gray-50"><FileClock size={16} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="mt-3 rounded bg-blue-50 px-3 py-2 text-xs text-blue-700">Se muestran todos los equipos actuales de la persona, aunque la búsqueda se haya realizado por uno de ellos.</p>
                    </TiModal>
                )}

                {historialDe && <HistorialActivoModal activo={historialDe} onClose={() => setHistorialDe(null)} />}
            </div>
        </div>
    );
};

export default PersonalEquipos;
