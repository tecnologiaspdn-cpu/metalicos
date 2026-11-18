// Vista compartida de "Transferencias" (entrega de equipos) y "Recepción de equipos".
// La API no tiene un recurso aparte para la recepción: una devolución "se registra como
// otra transferencia" (colaborador → responsable TI). Se distingue con el prefijo
// MARCA_RECEPCION en el motivo, que la vista de recepción filtra.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import notify from 'devextreme/ui/notify';
import { confirm } from 'devextreme/ui/dialog';
import { Eye, FileText, Plus, Search } from 'lucide-react';
import {
    Badge, PersonalPicker, Paginacion, TiHeader, TiModal, activoEquipo, filasDe, inputCls, personaCorreo,
    personaId, personaNombre, etiqueta,
} from './TiShared';
import { formatearFechaHora, pick, soloFecha } from '../Comedor/comedorUtils';
import { asegurarOk, nuevoIdSolicitud, tiApi } from '../../services/ti/tiApi';

const TAM_PAGINA = 10;
const MARCA_RECEPCION = '[RECEPCIÓN] ';

type Modo = 'entrega' | 'recepcion';

const TEXTOS = {
    entrega: { titulo: 'Transferencias', desc: 'Entrega equipos a un colaborador con validación por código.', nuevo: 'Nueva transferencia', pref: 'TR', num: 'N° transferencia', u: 'transferencias' },
    recepcion: { titulo: 'Recepción de equipos', desc: 'Registra la devolución de equipos al área de TI.', nuevo: 'Nueva recepción', pref: 'REC', num: 'N° recepción', u: 'registros' },
};

const numero = (pref: string, t: any) => `${pref}-${String(pick(t, ['id', 'id_transferencia']) ?? '').padStart(5, '0')}`;
const tId = (t: any) => pick(t, ['id', 'id_transferencia']);
const origenNombre = (t: any): string => pick(t, ['personal_origen', 'origen', 'nombre_origen', 'origen_nombre', 'entrega']) ?? '—';
const destinoNombre = (t: any): string => pick(t, ['personal_destino', 'destino', 'nombre_destino', 'destino_nombre', 'recibe']) ?? '—';
const motivoLimpio = (m?: string) => String(m ?? '').replace(MARCA_RECEPCION, '');
const esRecepcion = (t: any) => String(t?.motivo ?? '').startsWith(MARCA_RECEPCION);
const activosDe = (d: any): any[] => {
    const a = d?.activos ?? d?.detalle ?? d?.equipos ?? d?.items;
    return Array.isArray(a) ? a : [];
};

// ───────────────────────────── Modal: nueva ─────────────────────────────
const NuevaModal: React.FC<{ modo: Modo; onClose: () => void; onCreada: (t: any) => void }> = ({ modo, onClose, onCreada }) => {
    const [origen, setOrigen] = useState<any | null>(null);
    const [destino, setDestino] = useState<any | null>(null);
    const [correo, setCorreo] = useState('');
    const [motivo, setMotivo] = useState('');
    const [equipos, setEquipos] = useState<any[]>([]);
    const [sel, setSel] = useState<Set<number>>(new Set());
    const [cargandoEq, setCargandoEq] = useState(false);
    const [guardando, setGuardando] = useState(false);
    // Un UUID por intento de creación: reintentar la misma operación no duplica la transferencia.
    const [idSolicitud] = useState(nuevoIdSolicitud);

    useEffect(() => {
        setEquipos([]);
        setSel(new Set());
        if (!origen) return;
        setCargandoEq(true);
        tiApi.personal
            .equipos(personaId(origen))
            .then((r) => {
                const d: any = r?.data;
                setEquipos(Array.isArray(d) ? d : Array.isArray(d?.equipos) ? d.equipos : []);
            })
            .catch((e) => notify(e?.message || 'No se pudo cargar los equipos.', 'error', 3500))
            .finally(() => setCargandoEq(false));
    }, [origen]);

    // El receptor recibe el código por correo: se sugiere su correo registrado.
    useEffect(() => {
        if (destino && !correo) setCorreo(personaCorreo(destino));
    }, [destino]); // eslint-disable-line react-hooks/exhaustive-deps

    const alternar = (id: number) => {
        const n = new Set(sel);
        n.has(id) ? n.delete(id) : n.add(id);
        setSel(n);
    };
    const idActivo = (a: any) => Number(pick(a, ['id', 'id_activo']));

    const guardar = async () => {
        if (!origen || !destino) return notify('Seleccione quién entrega y quién recibe.', 'warning', 3000);
        if (personaId(origen) === personaId(destino)) return notify('Origen y destino no pueden ser la misma persona.', 'warning', 3000);
        if (!/^\S+@\S+\.\S+$/.test(correo.trim())) return notify('Ingrese un correo válido del receptor.', 'warning', 3000);
        if (!motivo.trim()) return notify('Indique el motivo.', 'warning', 3000);
        if (sel.size === 0) return notify('Seleccione al menos un equipo.', 'warning', 3000);
        setGuardando(true);
        try {
            const resp = asegurarOk(
                await tiApi.transferencias.crear({
                    id_solicitud: idSolicitud,
                    id_personal_origen: Number(personaId(origen)),
                    id_personal_destino: Number(personaId(destino)),
                    correo_receptor: correo.trim(),
                    motivo: (modo === 'recepcion' ? MARCA_RECEPCION : '') + motivo.trim(),
                    activos: equipos.filter((a) => sel.has(idActivo(a))).map((a) => ({ id_activo: idActivo(a), version: Number(a.version) })),
                }),
                'No se pudo crear la transferencia.'
            );
            notify('Registrada como pendiente. Envíe el código al receptor para confirmar.', 'success', 3500);
            onCreada(resp.data);
        } catch (e: any) {
            notify(e?.message || 'No se pudo crear la transferencia.', 'error', 4000);
        } finally {
            setGuardando(false);
        }
    };

    const recep = modo === 'recepcion';
    return (
        <TiModal
            titulo={recep ? 'Nueva recepción de equipos' : 'Nueva transferencia de equipos'}
            onClose={() => !guardando && onClose()}
            ancho="xl"
            footer={
                <>
                    <button type="button" className="rounded border border-gray-300 px-5 py-2 text-sm hover:bg-gray-50" onClick={onClose} disabled={guardando}>Cancelar</button>
                    <button type="button" className="rounded bg-blue-600 px-5 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60" onClick={guardar} disabled={guardando}>
                        {guardando ? 'Guardando…' : recep ? 'Registrar recepción' : 'Registrar transferencia'}
                    </button>
                </>
            }
        >
            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">{recep ? 'Colaborador que devuelve' : 'Entrega (responsable actual)'} *</label>
                    <PersonalPicker valor={origen} onChange={setOrigen} />
                </div>
                <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">{recep ? 'Responsable TI que recibe' : 'Recibe (nuevo responsable)'} *</label>
                    <PersonalPicker valor={destino} onChange={setDestino} />
                </div>
                <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Correo del receptor (recibirá el código) *</label>
                    <input type="email" className={inputCls} value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="correo@empresa.com" />
                </div>
                <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Motivo *</label>
                    <input className={inputCls} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={recep ? 'Devolución por cambio de asignación' : 'Entrega de equipos'} />
                </div>
            </div>

            <h4 className="mb-2 mt-5 font-semibold text-gray-900">Equipos {recep ? 'a recibir' : 'a entregar'}</h4>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full border-collapse text-left text-sm">
                    <thead>
                        <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-600">
                            <th className="w-10 px-3 py-2">
                                <input
                                    type="checkbox"
                                    aria-label="Seleccionar todos"
                                    checked={equipos.length > 0 && sel.size === equipos.length}
                                    onChange={(e) => setSel(e.target.checked ? new Set(equipos.map(idActivo)) : new Set())}
                                />
                            </th>
                            <th className="px-3 py-2">Equipo / Código</th>
                            <th className="px-3 py-2">Serie</th>
                            <th className="px-3 py-2">Condición</th>
                            <th className="px-3 py-2">Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {!origen && <tr><td colSpan={5} className="py-6 text-center text-gray-400">Seleccione primero a la persona de origen.</td></tr>}
                        {origen && cargandoEq && <tr><td colSpan={5} className="py-6 text-center text-gray-400">Cargando…</td></tr>}
                        {origen && !cargandoEq && equipos.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-gray-400">La persona no tiene equipos asignados.</td></tr>}
                        {equipos.map((a) => (
                            <tr key={idActivo(a)} className="border-b border-gray-100">
                                <td className="px-3 py-2"><input type="checkbox" checked={sel.has(idActivo(a))} onChange={() => alternar(idActivo(a))} /></td>
                                <td className="px-3 py-2">{activoEquipo(a)} · <span className="font-semibold">{a.codigo_activo || 'Sin código'}</span></td>
                                <td className="px-3 py-2">{a.serie || '—'}</td>
                                <td className="px-3 py-2"><Badge valor={a.condicion} /></td>
                                <td className="px-3 py-2"><Badge valor={a.estado_operativo} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="mt-2 text-xs text-gray-500">{sel.size} equipos seleccionados</p>
            <p className="mt-3 rounded bg-blue-50 px-3 py-2 text-xs text-blue-700">
                {recep
                    ? 'Al confirmar con el código, los equipos pasarán al responsable de TI y se generará el acta de recepción.'
                    : 'Al confirmar con el código del receptor, los equipos pasarán a su responsabilidad y se generará el acta.'}
            </p>
        </TiModal>
    );
};

// ───────────────────────────── Modal: detalle ─────────────────────────────
const DetalleModal: React.FC<{ modo: Modo; id: number; onClose: () => void; onCambio: () => void }> = ({ modo, id, onClose, onCambio }) => {
    const [t, setT] = useState<any | null>(null);
    const [codigo, setCodigo] = useState('');
    const [trabajando, setTrabajando] = useState(false);
    const tx = TEXTOS[modo];

    const cargar = useCallback(async () => {
        try {
            setT(asegurarOk(await tiApi.transferencias.detalle(id), 'No se pudo cargar el detalle.').data);
        } catch (e: any) {
            notify(e?.message || 'No se pudo cargar el detalle.', 'error', 3500);
            onClose();
        }
    }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        cargar();
    }, [cargar]);

    const accion = async (fn: () => Promise<any>, ok: string) => {
        setTrabajando(true);
        try {
            asegurarOk(await fn(), 'No se pudo completar la operación.');
            notify(ok, 'success', 3000);
            onCambio();
            await cargar();
        } catch (e: any) {
            notify(e?.message || 'No se pudo completar la operación.', 'error', 4500);
        } finally {
            setTrabajando(false);
        }
    };

    const cancelar = async () => {
        const ok = await confirm('¿Cancelar esta operación pendiente?', 'Cancelar');
        if (!ok) return;
        await accion(() => tiApi.transferencias.cancelar(id, Number(t.version), 'Cancelado desde la intranet'), 'Operación cancelada.');
    };

    const verActa = async (idActa: any) => {
        try {
            await tiApi.abrirActa(idActa);
        } catch (e: any) {
            notify(e?.message || 'No se pudo abrir el acta.', 'error', 3500);
        }
    };

    const estado = String(t?.estado ?? '').toUpperCase();
    const idActa = pick(t, ['id_acta', 'acta']);

    return (
        <TiModal
            titulo={t ? `${numero(tx.pref, t)} · ${etiqueta(estado)}` : 'Cargando…'}
            onClose={onClose}
            ancho="lg"
            footer={<button type="button" className="rounded border border-gray-300 px-5 py-2 text-sm hover:bg-gray-50" onClick={onClose}>Cerrar</button>}
        >
            {t && (
                <>
                    <div className="grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm sm:grid-cols-2">
                        <div><span className="block text-xs text-gray-500">{modo === 'recepcion' ? 'Entrega' : 'Origen'}</span>{origenNombre(t)}</div>
                        <div><span className="block text-xs text-gray-500">{modo === 'recepcion' ? 'Recibe en TI' : 'Destino'}</span>{destinoNombre(t)}</div>
                        <div><span className="block text-xs text-gray-500">Motivo</span>{motivoLimpio(t.motivo) || '—'}</div>
                        <div><span className="block text-xs text-gray-500">Fecha</span>{formatearFechaHora(pick(t, ['fecha', 'fecha_creacion', 'fecha_registro']))}</div>
                    </div>

                    <h4 className="mb-2 mt-4 font-semibold text-gray-900">Equipos</h4>
                    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 text-sm">
                        {activosDe(t).length === 0 && <li className="px-3 py-3 text-gray-400">Sin detalle.</li>}
                        {activosDe(t).map((a, i) => (
                            <li key={i} className="px-3 py-2">
                                <span className="font-semibold">{pick(a, ['codigo_activo', 'codigo']) || 'Sin código'}</span> · {activoEquipo(a)}
                                {a.serie && <span className="text-gray-500"> · Serie {a.serie}</span>}
                            </li>
                        ))}
                    </ul>

                    {estado === 'PENDIENTE' && (
                        <div className="mt-4 space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                            <p className="text-sm text-amber-800">
                                El receptor debe ingresar el código enviado por correo (vigencia 10 min, mínimo 60 s entre envíos, máximo 5 por hora; 5 intentos fallidos bloquean el desafío).
                            </p>
                            <div className="flex flex-wrap items-end gap-3">
                                <button type="button" disabled={trabajando} onClick={() => accion(() => tiApi.transferencias.enviarCodigo(id), 'Código enviado al correo del receptor.')} className="rounded border border-blue-600 px-4 py-2 text-sm text-blue-700 hover:bg-blue-50 disabled:opacity-60">
                                    Enviar / reenviar código
                                </button>
                                <input className={`${inputCls} w-40`} placeholder="Código" value={codigo} onChange={(e) => setCodigo(e.target.value.trim())} maxLength={12} />
                                <button type="button" disabled={trabajando || !codigo} onClick={() => accion(() => tiApi.transferencias.confirmar(id, codigo), 'Entrega confirmada.')} className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60">
                                    Validar y confirmar
                                </button>
                                <button type="button" disabled={trabajando} onClick={cancelar} className="ml-auto rounded border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60">
                                    Cancelar operación
                                </button>
                            </div>
                        </div>
                    )}

                    {estado === 'ACEPTADA' && idActa && (
                        <button type="button" onClick={() => verActa(idActa)} className="mt-4 flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
                            <FileText size={16} /> Ver / imprimir acta
                        </button>
                    )}
                </>
            )}
        </TiModal>
    );
};

// ───────────────────────────── Vista ─────────────────────────────
const TransferenciasView: React.FC<{ modo: Modo }> = ({ modo }) => {
    const tx = TEXTOS[modo];
    const [filas, setFilas] = useState<any[]>([]);
    const [cargando, setCargando] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [estado, setEstado] = useState('');
    const [desde, setDesde] = useState('');
    const [hasta, setHasta] = useState('');
    const [pagina, setPagina] = useState(1);
    const [nueva, setNueva] = useState(false);
    const [detalleId, setDetalleId] = useState<number | null>(null);

    const cargar = useCallback(async () => {
        setCargando(true);
        try {
            const resp = asegurarOk(await tiApi.transferencias.listar({ estado, busqueda: busqueda.trim(), desde, hasta }), 'No se pudo cargar el listado.');
            setFilas(filasDe(resp).filter((t) => (modo === 'recepcion' ? esRecepcion(t) : !esRecepcion(t))));
        } catch (e: any) {
            notify(e?.message || 'No se pudo cargar el listado.', 'error', 3500);
            setFilas([]);
        } finally {
            setCargando(false);
        }
    }, [estado, busqueda, desde, hasta, modo]);

    useEffect(() => {
        const t = setTimeout(cargar, 300);
        return () => clearTimeout(t);
    }, [cargar]);

    useEffect(() => setPagina(1), [estado, busqueda, desde, hasta]);
    const visibles = useMemo(() => filas.slice((pagina - 1) * TAM_PAGINA, pagina * TAM_PAGINA), [filas, pagina]);

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
                <TiHeader
                    titulo={tx.titulo}
                    descripcion={tx.desc}
                    acciones={
                        <button type="button" onClick={() => setNueva(true)} className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                            <Plus size={16} /> {tx.nuevo}
                        </button>
                    }
                />

                <div className="mb-4 flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="relative min-w-[220px] flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input className={`${inputCls} pl-9`} placeholder="DNI o colaborador" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs text-gray-500">Estado</label>
                        <select className={inputCls} value={estado} onChange={(e) => setEstado(e.target.value)}>
                            <option value="">Todos</option>
                            <option value="PENDIENTE">Pendiente</option>
                            <option value="ACEPTADA">Aceptada</option>
                            <option value="CANCELADA">Cancelada</option>
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

                <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-600">
                                    <th className="px-4 py-3">{tx.num}</th>
                                    <th className="px-4 py-3">Fecha</th>
                                    <th className="px-4 py-3">{modo === 'recepcion' ? 'Entrega' : 'Origen'}</th>
                                    <th className="px-4 py-3">{modo === 'recepcion' ? 'Recibe en TI' : 'Destino'}</th>
                                    <th className="px-4 py-3 text-center">Equipos</th>
                                    <th className="px-4 py-3">Estado</th>
                                    <th className="px-4 py-3 text-center">Detalle</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cargando && <tr><td colSpan={7} className="py-10 text-center text-gray-400">Cargando…</td></tr>}
                                {!cargando && visibles.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-gray-400">Sin registros.</td></tr>}
                                {!cargando &&
                                    visibles.map((t, i) => (
                                        <tr key={tId(t) ?? i} className="border-b border-gray-100 hover:bg-gray-50">
                                            <td className="px-4 py-3 font-semibold text-gray-900">{numero(tx.pref, t)}</td>
                                            <td className="whitespace-nowrap px-4 py-3">{soloFecha(pick(t, ['fecha', 'fecha_creacion', 'fecha_registro'])) || '—'}</td>
                                            <td className="px-4 py-3">{origenNombre(t)}</td>
                                            <td className="px-4 py-3">{destinoNombre(t)}</td>
                                            <td className="px-4 py-3 text-center">{pick(t, ['cantidad_activos', 'cantidad_equipos', 'total_activos']) ?? activosDe(t).length}</td>
                                            <td className="px-4 py-3"><Badge valor={t.estado} /></td>
                                            <td className="px-4 py-3 text-center">
                                                <button type="button" title="Ver detalle" onClick={() => setDetalleId(Number(tId(t)))} className="rounded border border-gray-300 p-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600">
                                                    <Eye size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                    <Paginacion pagina={pagina} total={filas.length} tam={TAM_PAGINA} onChange={setPagina} unidad={tx.u} />
                </div>

                {nueva && (
                    <NuevaModal
                        modo={modo}
                        onClose={() => setNueva(false)}
                        onCreada={(t) => {
                            setNueva(false);
                            cargar();
                            const id = Number(pick(t, ['id', 'id_transferencia']));
                            if (id) setDetalleId(id);
                        }}
                    />
                )}
                {detalleId !== null && <DetalleModal modo={modo} id={detalleId} onClose={() => setDetalleId(null)} onCambio={cargar} />}
            </div>
        </div>
    );
};

export default TransferenciasView;
