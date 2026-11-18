import React, { useEffect, useState } from 'react';
import { Badge, TiModal, activoEquipo, activoResponsable, etiqueta, filasDe, inputCls } from './TiShared';
import { formatearFechaHora, pick } from '../Comedor/comedorUtils';
import { tiApi } from '../../services/ti/tiApi';
import notify from 'devextreme/ui/notify';

const EVENTOS = ['REGISTRO', 'ACTUALIZACION', 'TRANSFERENCIA', 'BAJA', 'REVISION', 'SIM'];

/** Historial de movimientos de un activo (`GET /activos/{id}/historial`). */
const HistorialActivoModal: React.FC<{ activo: any; onClose: () => void }> = ({ activo, onClose }) => {
    const [evento, setEvento] = useState('');
    const [desde, setDesde] = useState('');
    const [hasta, setHasta] = useState('');
    const [filas, setFilas] = useState<any[]>([]);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        let vigente = true;
        setCargando(true);
        tiApi.activos
            .historial(Number(activo.id ?? activo.id_activo), { evento, desde, hasta })
            .then((r) => vigente && setFilas(filasDe(r)))
            .catch((e) => {
                if (!vigente) return;
                setFilas([]);
                notify(e?.message || 'No se pudo cargar el historial.', 'error', 3500);
            })
            .finally(() => vigente && setCargando(false));
        return () => {
            vigente = false;
        };
    }, [activo.id, evento, desde, hasta]);

    return (
        <TiModal
            titulo={`Historial del activo${activo.codigo_activo ? ` · ${activo.codigo_activo}` : ''}`}
            onClose={onClose}
            ancho="xl"
            footer={<button type="button" className="rounded bg-blue-600 px-5 py-2 text-sm text-white hover:bg-blue-700" onClick={onClose}>Cerrar</button>}
        >
            <div className="mb-4 grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm sm:grid-cols-3 lg:grid-cols-5">
                <div className="sm:col-span-3 lg:col-span-5 text-lg font-semibold text-gray-900">{activoEquipo(activo)}</div>
                <div><span className="block text-xs text-gray-500">Serie</span>{activo.serie || '—'}</div>
                <div><span className="block text-xs text-gray-500">Condición</span>{etiqueta(activo.condicion)}</div>
                <div><span className="block text-xs text-gray-500">Estado</span><Badge valor={activo.estado_operativo} /></div>
                <div><span className="block text-xs text-gray-500">Responsable actual</span>{activoResponsable(activo) || '—'}</div>
                <div><span className="block text-xs text-gray-500">Ubicación</span>{activo.ubicacion || '—'}</div>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <div>
                    <label className="mb-1 block text-xs text-gray-500">Tipo de movimiento</label>
                    <select className={inputCls} value={evento} onChange={(e) => setEvento(e.target.value)}>
                        <option value="">Todos</option>
                        {EVENTOS.map((e) => <option key={e} value={e}>{etiqueta(e)}</option>)}
                    </select>
                </div>
                <div>
                    <label className="mb-1 block text-xs text-gray-500">Desde</label>
                    <input type="date" className={inputCls} value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} />
                </div>
                <div>
                    <label className="mb-1 block text-xs text-gray-500">Hasta</label>
                    <input type="date" className={inputCls} value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} />
                </div>
            </div>

            <h4 className="mb-2 font-semibold text-gray-900">Movimientos del activo</h4>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full border-collapse text-left text-sm">
                    <thead>
                        <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-600">
                            <th className="px-3 py-2">Fecha y hora</th>
                            <th className="px-3 py-2">Evento</th>
                            <th className="px-3 py-2">Detalle</th>
                            <th className="px-3 py-2">Registrado por</th>
                        </tr>
                    </thead>
                    <tbody>
                        {cargando && <tr><td colSpan={4} className="py-8 text-center text-gray-400">Cargando…</td></tr>}
                        {!cargando && filas.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-gray-400">Sin movimientos.</td></tr>}
                        {!cargando &&
                            filas.map((f, i) => (
                                <tr key={f.id ?? i} className="border-b border-gray-100 align-top">
                                    <td className="whitespace-nowrap px-3 py-2">{formatearFechaHora(pick(f, ['fecha', 'fecha_evento', 'fecha_registro', 'fecha_creacion']))}</td>
                                    <td className="px-3 py-2 font-medium">{etiqueta(pick(f, ['evento', 'tipo_evento', 'tipo']))}</td>
                                    <td className="px-3 py-2 text-gray-700">{pick(f, ['detalle', 'descripcion', 'observaciones']) ?? '—'}</td>
                                    <td className="px-3 py-2">{pick(f, ['usuario', 'registrado_por', 'usuario_registro']) ?? '—'}</td>
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>
            <p className="mt-3 text-xs text-gray-500">Cada movimiento conserva fecha, usuario y valores anteriores y nuevos.</p>
        </TiModal>
    );
};

export default HistorialActivoModal;
