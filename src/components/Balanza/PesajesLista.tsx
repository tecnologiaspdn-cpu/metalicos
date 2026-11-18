import React, { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { BalanzaHeader, EstadoPesaje, EstadoTrade, Pesaje, inputCls, kg } from './balanzaShared';

interface Props {
    estado: EstadoPesaje;
    onEstado: (e: EstadoPesaje) => void;
    pesajes: Pesaje[];
    cargando: boolean;
    pendientes?: number;
    traderConectado: boolean;
    onConectar: () => void;
    onNuevo: () => void;
    onContinuar: (p: Pesaje) => void;
    onAnular: (p: Pesaje) => void;
    onTicket: (p: Pesaje) => void;
}

const TABS: { clave: EstadoPesaje; texto: string }[] = [
    { clave: 'PENDIENTE', texto: 'Pendientes' },
    { clave: 'FINALIZADO', texto: 'Finalizados' },
    { clave: 'ANULADO', texto: 'Anulados' },
];

const PUNTO: Record<EstadoPesaje, string> = { PENDIENTE: 'bg-amber-500', FINALIZADO: 'bg-green-500', ANULADO: 'bg-red-500' };
const BADGE: Record<EstadoPesaje, string> = { PENDIENTE: 'bg-amber-100 text-amber-700', FINALIZADO: 'bg-green-100 text-green-700', ANULADO: 'bg-red-100 text-red-700' };

const PesajesLista: React.FC<Props> = ({ estado, onEstado, pesajes, cargando, pendientes, traderConectado, onConectar, onNuevo, onContinuar, onAnular, onTicket }) => {
    const [fecha, setFecha] = useState('');
    const [operacion, setOperacion] = useState('');
    const [texto, setTexto] = useState('');

    const operaciones = useMemo(() => Array.from(new Set(pesajes.map((p) => p.operacion).filter(Boolean))), [pesajes]);

    // El listado de la API solo filtra por estado: fecha, operación y búsqueda se aplican aquí.
    const filas = useMemo(() => {
        const q = texto.trim().toLowerCase();
        return pesajes.filter(
            (p) =>
                (!fecha || p.fecha.slice(0, 10) === fecha) &&
                (!operacion || p.operacion === operacion) &&
                (!q || p.ticket.toLowerCase().includes(q) || p.placa.toLowerCase().includes(q)),
        );
    }, [pesajes, fecha, operacion, texto]);

    return (
        <>
            <BalanzaHeader
                migas={['Comercialización', 'Balanza']}
                titulo="Balanza"
                descripcion="Control de pesajes y emisión de tickets"
                acciones={
                    <div className="flex flex-wrap items-center gap-3">
                        <EstadoTrade conectado={traderConectado} />
                        <button type="button" onClick={onConectar} className="rounded border border-blue-600 bg-white px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50">
                            {traderConectado ? 'Desconectar' : 'Conectar con TRADE'}
                        </button>
                        <button type="button" onClick={onNuevo} className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                            <Plus size={16} /> Nuevo pesaje
                        </button>
                    </div>
                }
            />

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex gap-6 border-b border-gray-200">
                    {TABS.map((t) => (
                        <button
                            key={t.clave}
                            type="button"
                            onClick={() => onEstado(t.clave)}
                            className={`-mb-px flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium ${estado === t.clave ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
                        >
                            {t.texto}
                            {t.clave === 'PENDIENTE' && !!pendientes && <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs text-white">{pendientes}</span>}
                        </button>
                    ))}
                </div>

                <div className="mb-4 grid gap-3 md:grid-cols-[1fr_1fr_1.2fr]">
                    <input type="date" className={inputCls} value={fecha} onChange={(e) => setFecha(e.target.value)} aria-label="Fecha operativa" />
                    <select className={inputCls} value={operacion} onChange={(e) => setOperacion(e.target.value)}>
                        <option value="">Todas las operaciones</option>
                        {operaciones.map((o) => (
                            <option key={o}>{o}</option>
                        ))}
                    </select>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input className={`${inputCls} pl-9`} placeholder="Buscar ticket o placa" value={texto} onChange={(e) => setTexto(e.target.value)} />
                    </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-700">
                            <tr>
                                {['Ticket', 'Operación', 'Placa', 'Primera pesada', ...(estado === 'FINALIZADO' ? ['Neto'] : []), 'Estado', 'Acciones'].map((h) => (
                                    <th key={h} className="px-4 py-3 font-semibold">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filas.map((p) => (
                                <tr key={String(p.id)} className="border-t border-gray-100">
                                    <td className="px-4 py-3">{p.ticket || '—'}</td>
                                    <td className="px-4 py-3">{p.operacion || '—'}</td>
                                    <td className="px-4 py-3">{p.placa || '—'}</td>
                                    <td className="px-4 py-3">{kg(p.primeraKg, '.')}</td>
                                    {estado === 'FINALIZADO' && <td className="px-4 py-3">{kg(p.netoKg, '.')}</td>}
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE[p.estado]}`}>
                                            <span className={`h-2 w-2 rounded-full ${PUNTO[p.estado]}`} />
                                            {p.estado.charAt(0) + p.estado.slice(1).toLowerCase()}
                                        </span>
                                    </td>
                                    <td className="flex gap-2 px-4 py-3">
                                        {p.estado === 'PENDIENTE' && (
                                            <>
                                                <button type="button" onClick={() => onContinuar(p)} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700">Continuar</button>
                                                <button type="button" onClick={() => onAnular(p)} className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">Anular</button>
                                            </>
                                        )}
                                        {p.estado === 'FINALIZADO' && (
                                            <button type="button" onClick={() => onTicket(p)} className="rounded border border-blue-600 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50">Ticket PDF</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {filas.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-10 text-center text-gray-400">{cargando ? 'Cargando…' : 'No hay pesajes para mostrar.'}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
};

export default PesajesLista;
