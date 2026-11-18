import React, { useCallback, useEffect, useMemo, useState } from 'react';
import notify from 'devextreme/ui/notify';
import { Plus, Search } from 'lucide-react';
import { confirm } from 'devextreme/ui/dialog';
import NuevoCatalogoModal, { FilaCatalogo } from '../../components/Balanza/NuevoCatalogoModal';
import { BalanzaHeader, filasDe, inputCls, mensajeError } from '../../components/Balanza/balanzaShared';
import { pick } from '../../components/Comedor/comedorUtils';
import { EstadoBadge } from '../../components/Comedor/ComedorShared';
import { asegurarOk, balanzaApi } from '../../services/balanza/balanzaApi';

type Tipo = 'VEHICULO' | 'CONDUCTOR';

const aFila = (r: any): FilaCatalogo => ({
    id: pick(r, ['id', 'id_catalogo']),
    codigo: String(pick(r, ['codigo', 'placa', 'documento']) ?? ''),
    nombre: String(pick(r, ['nombre', 'descripcion']) ?? ''),
    licencia: String(pick(r, ['licencia']) ?? ''),
    activo: r?.activo !== false && r?.activo !== 0,
    idPersonal: r?.id_personal ?? null,
    version: r?.version ?? 1,
});

const TABS: { tipo: Tipo; texto: string }[] = [
    { tipo: 'VEHICULO', texto: 'Vehículos' },
    { tipo: 'CONDUCTOR', texto: 'Conductores' },
];

const Maestros: React.FC = () => {
    const [tipo, setTipo] = useState<Tipo>('VEHICULO');
    const [filas, setFilas] = useState<FilaCatalogo[]>([]);
    const [cargando, setCargando] = useState(false);
    const [texto, setTexto] = useState('');
    // `null`: cerrado · 'nuevo': alta · fila: edición de ese registro
    const [modal, setModal] = useState<null | 'nuevo' | FilaCatalogo>(null);

    const cargar = useCallback(async (t: Tipo) => {
        setCargando(true);
        try {
            setFilas(filasDe(await balanzaApi.catalogo.listar(t)).map(aFila));
        } catch (e) {
            setFilas([]);
            notify(mensajeError(e, 'No se pudo cargar el catálogo.'), 'error', 3500);
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => {
        setTexto('');
        cargar(tipo);
    }, [tipo, cargar]);

    const visibles = useMemo(() => {
        const q = texto.trim().toLowerCase();
        return q ? filas.filter((f) => f.codigo.toLowerCase().includes(q) || f.nombre.toLowerCase().includes(q) || f.licencia.toLowerCase().includes(q)) : filas;
    }, [filas, texto]);

    // Activar/desactivar es el mismo PUT con `activo` cambiado; se reenvían los demás campos tal cual.
    const alternarActivo = async (f: FilaCatalogo) => {
        const accion = f.activo ? 'desactivar' : 'activar';
        if (!(await confirm(`¿Desea ${accion} ${tipo === 'VEHICULO' ? 'el vehículo' : 'al conductor'} ${f.codigo}?`, 'Confirmar'))) return;
        try {
            asegurarOk(
                await balanzaApi.catalogo.actualizar(tipo, f.id, {
                    codigo: f.codigo,
                    ...(f.idPersonal != null ? {} : { nombre: f.nombre }),
                    ...(tipo === 'CONDUCTOR' ? { id_personal: f.idPersonal, licencia: f.licencia || null } : {}),
                    activo: !f.activo,
                    version: f.version,
                }),
                `No se pudo ${accion} el registro.`,
            );
            notify(f.activo ? 'Registro desactivado.' : 'Registro activado.', 'success', 3000);
        } catch (e) {
            notify(mensajeError(e, `No se pudo ${accion} el registro.`), 'error', 4000);
        }
        cargar(tipo); // también tras un error: la versión pudo haber cambiado
    };

    const esVehiculo = tipo === 'VEHICULO';
    const columnas = esVehiculo ? ['Placa', 'Nombre', 'Estado', 'Acciones'] : ['Documento', 'Nombre', 'Licencia', 'Tipo', 'Estado', 'Acciones'];

    return (
        <>
            <BalanzaHeader
                migas={['Comercialización', 'Maestros']}
                titulo="Maestros de balanza"
                descripcion="Vehículos y conductores disponibles para los pesajes."
                acciones={
                    <button type="button" onClick={() => setModal('nuevo')} className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                        <Plus size={16} /> {esVehiculo ? 'Nuevo vehículo' : 'Nuevo conductor'}
                    </button>
                }
            />

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex gap-6 border-b border-gray-200">
                    {TABS.map((t) => (
                        <button
                            key={t.tipo}
                            type="button"
                            onClick={() => setTipo(t.tipo)}
                            className={`-mb-px border-b-2 px-1 pb-3 text-sm font-medium ${tipo === t.tipo ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
                        >
                            {t.texto}
                        </button>
                    ))}
                </div>

                <div className="relative mb-4 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input className={`${inputCls} pl-9`} placeholder={esVehiculo ? 'Buscar placa' : 'Buscar documento, nombre o licencia'} value={texto} onChange={(e) => setTexto(e.target.value)} />
                </div>

                <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-700">
                            <tr>{columnas.map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
                        </thead>
                        <tbody>
                            {visibles.map((f) => (
                                <tr key={String(f.id)} className="border-t border-gray-100">
                                    <td className="px-4 py-3">{f.codigo || '—'}</td>
                                    <td className="px-4 py-3">{f.nombre || '—'}</td>
                                    {!esVehiculo && <td className="px-4 py-3">{f.licencia || '—'}</td>}
                                    {!esVehiculo && <td className="px-4 py-3">{f.idPersonal != null ? 'Personal' : 'Externo'}</td>}
                                    <td className="px-4 py-3"><EstadoBadge activo={f.activo} /></td>
                                    <td className="flex gap-2 px-4 py-3">
                                        <button type="button" onClick={() => setModal(f)} className="rounded border border-blue-600 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50">Editar</button>
                                        <button type="button" onClick={() => alternarActivo(f)} className={`rounded border px-3 py-1 text-xs font-medium ${f.activo ? 'border-red-300 text-red-600 hover:bg-red-50' : 'border-green-300 text-green-700 hover:bg-green-50'}`}>
                                            {f.activo ? 'Desactivar' : 'Activar'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {visibles.length === 0 && (
                                <tr>
                                    <td colSpan={columnas.length} className="px-4 py-10 text-center text-gray-400">{cargando ? 'Cargando…' : 'No hay registros para mostrar.'}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <p className="mt-3 text-xs text-gray-500">{visibles.length} de {filas.length} registros.</p>
            </div>

            {modal && (
                <NuevoCatalogoModal
                    tipo={tipo}
                    fila={modal === 'nuevo' ? undefined : modal}
                    onClose={() => setModal(null)}
                    onGuardado={() => {
                        setModal(null);
                        cargar(tipo);
                    }}
                />
            )}
        </>
    );
};

export default Maestros;
