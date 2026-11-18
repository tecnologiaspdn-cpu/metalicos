import React, { useCallback, useEffect, useState } from 'react';
import notify from 'devextreme/ui/notify';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import { Calendar, Coins, Eye, FileSpreadsheet, FileText, Filter, Info, RefreshCw, Search } from 'lucide-react';
import { Modal, inputCls } from './ComedorShared';
import { hoyLima, soloFecha } from './comedorUtils';
import { useComedorPuntos } from '../../hooks/useComedorPuntos';
import { apiManager } from '../../services/api/ApiManager';
import { asegurarOk, comedorApi, FiltrosExtras } from '../../services/comedor/comedorApi';

const TAMANOS = [10, 15, 25, 50];
const MONEDA = 'PEN';

type Estado = 'REGISTRADO' | 'ATENDIDO' | 'ANULADO';

const ESTILO_ESTADO: Record<Estado, { cls: string; label: string }> = {
    REGISTRADO: { cls: 'bg-blue-100 text-blue-700', label: 'REGISTRADO' },
    ATENDIDO: { cls: 'bg-green-100 text-green-700', label: 'ATENDIDO' },
    ANULADO: { cls: 'bg-red-100 text-red-700', label: 'ANULADO' },
};

const num = (v: any) => Number(v) || 0;
const dinero = (n: number) => `S/ ${num(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fechaCorta = (v?: string | null) => soloFecha(v).split('-').reverse().join('/');
const chipEstado = (e: string) => ESTILO_ESTADO[String(e).toUpperCase() as Estado] ?? { cls: 'bg-gray-100 text-gray-700', label: e };

const COLUMNAS_EXPORT: { titulo: string; valor: (p: any) => string | number; ancho: number }[] = [
    { titulo: 'Fecha atención', valor: (p) => fechaCorta(p.fecha_atencion), ancho: 16 },
    { titulo: 'Código', valor: (p) => p.codigo ?? '', ancho: 12 },
    { titulo: 'Empresa a cargo', valor: (p) => p.empresa_cargo ?? '', ancho: 40 },
    { titulo: 'Punto', valor: (p) => p.punto_atencion ?? '', ancho: 18 },
    { titulo: 'Solicitante', valor: (p) => p.solicitante ?? '', ancho: 24 },
    { titulo: 'Motivo', valor: (p) => p.motivo ?? '', ancho: 30 },
    { titulo: 'Importe', valor: (p) => num(p.total), ancho: 14 },
    { titulo: 'Estado', valor: (p) => p.estado ?? '', ancho: 14 },
];

/** Pestaña "Extras" de Reportes de comedor: consulta de pedidos extra por rango de fechas. */
const ReporteExtras: React.FC = () => {
    const { puntos } = useComedorPuntos();
    const [empresas, setEmpresas] = useState<any[]>([]);
    const hoy = hoyLima();

    const [fechaInicio, setFechaInicio] = useState(hoy);
    const [fechaFin, setFechaFin] = useState(hoy);
    const [punto, setPunto] = useState('');
    const [empresa, setEmpresa] = useState('');
    const [estado, setEstado] = useState('');
    const [busqueda, setBusqueda] = useState('');

    const [filas, setFilas] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [importeVigente, setImporteVigente] = useState(0);
    const [pagina, setPagina] = useState(1);
    const [tamano, setTamano] = useState(15);
    const [cargando, setCargando] = useState(false);
    const [consultado, setConsultado] = useState(false);
    const [exportando, setExportando] = useState<'excel' | 'pdf' | null>(null);
    const [detalle, setDetalle] = useState<any | null>(null);

    useEffect(() => {
        apiManager.maestro
            .listaEmpresas({})
            .then((r: any) => setEmpresas(r?.data || []))
            .catch(() => setEmpresas([]));
    }, []);

    const filtros = useCallback(
        (): FiltrosExtras => ({
            fecha_inicio: fechaInicio,
            fecha_fin: fechaFin,
            id_punto_atencion: punto || undefined,
            id_empresa_cargo: empresa || undefined,
            estado: estado || undefined,
            busqueda: busqueda.trim() || undefined,
        }),
        [fechaInicio, fechaFin, punto, empresa, estado, busqueda]
    );

    const consultar = useCallback(
        async (pag = 1, tam = tamano) => {
            if (!fechaInicio || !fechaFin) return notify('Indique el rango de fechas.', 'warning', 3000);
            if (fechaInicio > fechaFin) return notify('La fecha inicio no puede ser mayor que la fecha fin.', 'warning', 3000);
            setCargando(true);
            try {
                const resp = asegurarOk(await comedorApi.extras.listar({ ...filtros(), pagina: pag, tamano: tam }), 'No se pudo consultar los extras.');
                const f: any[] = Array.isArray(resp.data?.pedidos) ? resp.data.pedidos : [];
                setFilas(f);
                setTotal(num(resp.data?.total ?? f.length));
                const pen = (resp.data?.importes_por_moneda ?? []).find((m: any) => m.moneda === MONEDA);
                setImporteVigente(num(pen?.total_vigente));
                setPagina(pag);
                setConsultado(true);
            } catch (e: any) {
                notify(e?.message || 'No se pudo consultar los extras.', 'error', 4000);
            } finally {
                setCargando(false);
            }
        },
        [filtros, fechaInicio, fechaFin, tamano]
    );

    const limpiar = () => {
        setFechaInicio(hoy);
        setFechaFin(hoy);
        setPunto('');
        setEmpresa('');
        setEstado('');
        setBusqueda('');
        setFilas([]);
        setTotal(0);
        setImporteVigente(0);
        setPagina(1);
        setConsultado(false);
    };

    const verDetalle = async (p: any) => {
        try {
            const resp = asegurarOk(await comedorApi.extras.obtener(p.id), 'No se pudo cargar el pedido.');
            setDetalle(resp.data);
        } catch (e: any) {
            notify(e?.message || 'No se pudo cargar el pedido.', 'error', 4000);
        }
    };

    /** Trae TODOS los pedidos del filtro (el backend pagina), para exportar. */
    const traerTodo = async (): Promise<any[]> => {
        const acumulado: any[] = [];
        for (let pag = 1; pag <= 200; pag++) {
            const resp = asegurarOk(await comedorApi.extras.listar({ ...filtros(), pagina: pag, tamano: 100 }), 'No se pudo consultar los extras.');
            const f: any[] = Array.isArray(resp.data?.pedidos) ? resp.data.pedidos : [];
            if (f.length === 0) break;
            acumulado.push(...f);
            if (acumulado.length >= num(resp.data?.total)) break;
        }
        return acumulado;
    };

    const exportar = async (formato: 'excel' | 'pdf') => {
        setExportando(formato);
        try {
            const datos = await traerTodo();
            if (datos.length === 0) return notify('No hay pedidos para exportar.', 'info', 3000);
            const nombre = `comedor_extras_${fechaInicio}_${fechaFin}`;
            if (formato === 'excel') {
                const wb = new ExcelJS.Workbook();
                const ws = wb.addWorksheet('Extras');
                ws.columns = COLUMNAS_EXPORT.map((c) => ({ header: c.titulo, key: c.titulo, width: c.ancho }));
                datos.forEach((p) => ws.addRow(COLUMNAS_EXPORT.map((c) => c.valor(p))));
                ws.getRow(1).font = { bold: true };
                ws.getColumn(7).numFmt = '#,##0.00';
                const buffer = await wb.xlsx.writeBuffer();
                saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${nombre}.xlsx`);
            } else {
                const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
                const anchos = [24, 20, 70, 32, 40, 52, 22, 22];
                let y = 15;
                const cabecera = () => {
                    pdf.setFont('helvetica', 'bold');
                    pdf.setFontSize(8);
                    let x = 8;
                    COLUMNAS_EXPORT.forEach((c, i) => { pdf.text(c.titulo, x, y); x += anchos[i]; });
                    pdf.line(8, y + 1.5, 289, y + 1.5);
                    y += 6;
                    pdf.setFont('helvetica', 'normal');
                    pdf.setFontSize(7.5);
                };
                pdf.setFontSize(12);
                pdf.setFont('helvetica', 'bold');
                pdf.text(`Reporte de Extras  ${fechaInicio} al ${fechaFin}  (${datos.length} pedidos)`, 8, 9);
                cabecera();
                datos.forEach((p) => {
                    if (y > 200) { pdf.addPage(); y = 15; cabecera(); }
                    let x = 8;
                    COLUMNAS_EXPORT.forEach((c, i) => {
                        const v = c.valor(p);
                        const txt = typeof v === 'number' ? v.toFixed(2) : String(v);
                        pdf.text(pdf.splitTextToSize(txt, anchos[i] - 2)[0] ?? '', x, y);
                        x += anchos[i];
                    });
                    y += 5;
                });
                pdf.save(`${nombre}.pdf`);
            }
        } catch (e: any) {
            notify(e?.message || 'No se pudo exportar.', 'error', 4000);
        } finally {
            setExportando(null);
        }
    };

    const totalPaginas = Math.max(1, Math.ceil(total / tamano));
    const lbl = 'mb-1 block text-sm text-gray-700';

    return (
        <>
            <div className="mb-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-900">
                    <Filter size={18} className="text-blue-600" /> Filtros de búsqueda
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <div>
                        <label className={lbl}>Fecha inicio</label>
                        <div className="relative">
                            <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input type="date" className={`${inputCls} pl-9`} value={fechaInicio} max={fechaFin} onChange={(e) => setFechaInicio(e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <label className={lbl}>Fecha fin</label>
                        <div className="relative">
                            <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input type="date" className={`${inputCls} pl-9`} value={fechaFin} min={fechaInicio} onChange={(e) => setFechaFin(e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <label className={lbl}>Punto de atención</label>
                        <select className={inputCls} value={punto} onChange={(e) => setPunto(e.target.value)}>
                            <option value="">Todos</option>
                            {puntos.map((p) => <option key={p.id} value={p.id}>{p.nombre || p.codigo}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={lbl}>Empresa</label>
                        <select className={inputCls} value={empresa} onChange={(e) => setEmpresa(e.target.value)}>
                            <option value="">Todas</option>
                            {empresas.map((e) => <option key={e.id} value={e.id}>{e.razonSocial ?? e.nombre}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={lbl}>Estado</label>
                        <select className={inputCls} value={estado} onChange={(e) => setEstado(e.target.value)}>
                            <option value="">Todos</option>
                            <option value="REGISTRADO">Registrado</option>
                            <option value="ATENDIDO">Atendido</option>
                            <option value="ANULADO">Anulado</option>
                        </select>
                    </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                    <div className="relative min-w-[240px] flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            className={`${inputCls} pl-9`}
                            placeholder="Buscar por código, solicitante o motivo…"
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && consultar(1)}
                        />
                    </div>
                    <button type="button" onClick={() => consultar(1)} disabled={cargando} className="flex items-center gap-2 rounded bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
                        <Search size={16} /> {cargando ? 'Consultando…' : 'Consultar'}
                    </button>
                    <button type="button" onClick={limpiar} className="flex items-center gap-2 rounded border border-blue-300 px-5 py-2 text-sm text-blue-600 hover:bg-blue-50">
                        <RefreshCw size={16} /> Limpiar
                    </button>
                </div>
            </div>

            <div className="mb-5 grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50"><FileText size={24} className="text-blue-600" /></div>
                    <div>
                        <p className="text-sm text-gray-600">Total de pedidos</p>
                        <p className="text-3xl font-bold text-gray-900">{consultado ? total : '—'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50"><Coins size={24} className="text-blue-600" /></div>
                    <div>
                        <p className="text-sm text-gray-600">Importe no anulado · {MONEDA}</p>
                        <p className="text-3xl font-bold text-gray-900">{consultado ? dinero(importeVigente) : '—'}</p>
                        <p className="text-xs text-gray-500">Registrados y atendidos</p>
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                        <FileText size={18} className="text-blue-600" /> Listado de pedidos extras
                    </h3>
                    <div className="flex gap-2">
                        <button type="button" disabled={!!exportando || !consultado} onClick={() => exportar('excel')} className="flex items-center gap-2 rounded border border-green-600 px-4 py-2 text-sm text-green-700 hover:bg-green-50 disabled:opacity-50">
                            <FileSpreadsheet size={16} /> {exportando === 'excel' ? 'Exportando…' : 'Exportar a Excel'}
                        </button>
                        <button type="button" disabled={!!exportando || !consultado} onClick={() => exportar('pdf')} className="flex items-center gap-2 rounded border border-red-400 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50">
                            <FileText size={16} /> {exportando === 'pdf' ? 'Exportando…' : 'Exportar a PDF'}
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm">
                        <thead>
                            <tr className="border-y border-gray-200 bg-gray-50 text-gray-700">
                                <th className="px-3 py-2.5 font-semibold">Fecha atención</th>
                                <th className="px-3 py-2.5 font-semibold">Código</th>
                                <th className="px-3 py-2.5 font-semibold">Empresa a cargo</th>
                                <th className="px-3 py-2.5 font-semibold">Solicitante</th>
                                <th className="px-3 py-2.5 font-semibold">Motivo</th>
                                <th className="px-3 py-2.5 text-right font-semibold">Importe</th>
                                <th className="px-3 py-2.5 font-semibold">Estado</th>
                                <th className="px-3 py-2.5 text-center font-semibold">Detalle</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cargando && <tr><td colSpan={8} className="py-10 text-center text-gray-400">Consultando…</td></tr>}
                            {!cargando && filas.length === 0 && (
                                <tr><td colSpan={8} className="py-10 text-center text-gray-400">{consultado ? 'Sin pedidos para los filtros indicados.' : 'Presione Consultar para ver los pedidos.'}</td></tr>
                            )}
                            {!cargando &&
                                filas.map((p) => {
                                    const e = chipEstado(p.estado);
                                    return (
                                        <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                                            <td className="whitespace-nowrap px-3 py-2.5">{fechaCorta(p.fecha_atencion)}</td>
                                            <td className="whitespace-nowrap px-3 py-2.5 font-medium">{p.codigo}</td>
                                            <td className="px-3 py-2.5">{p.empresa_cargo ?? '—'}</td>
                                            <td className="px-3 py-2.5">{p.solicitante}</td>
                                            <td className="px-3 py-2.5">{p.motivo}</td>
                                            <td className="whitespace-nowrap px-3 py-2.5 text-right">{dinero(p.total)}</td>
                                            <td className="px-3 py-2.5"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${e.cls}`}>{e.label}</span></td>
                                            <td className="px-3 py-2.5 text-center">
                                                <button type="button" title="Ver detalle" onClick={() => verDetalle(p)} className="rounded p-1 text-blue-600 hover:bg-blue-50"><Eye size={18} /></button>
                                            </td>
                                        </tr>
                                    );
                                })}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
                    <span>Mostrando {filas.length === 0 ? 0 : (pagina - 1) * tamano + 1} a {(pagina - 1) * tamano + filas.length} de {total} pedidos</span>
                    <div className="flex items-center gap-2">
                        <span>Filas por página:</span>
                        <select className="rounded border border-gray-300 px-2 py-1" value={tamano} onChange={(e) => { const t = Number(e.target.value); setTamano(t); if (consultado) consultar(1, t); }}>
                            {TAMANOS.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <button className="rounded border px-3 py-1 disabled:opacity-40" disabled={pagina <= 1 || cargando} onClick={() => consultar(pagina - 1)}>Anterior</button>
                        <span className="rounded bg-blue-600 px-3 py-1 text-white">{pagina} / {totalPaginas}</span>
                        <button className="rounded border px-3 py-1 disabled:opacity-40" disabled={pagina >= totalPaginas || cargando} onClick={() => consultar(pagina + 1)}>Siguiente</button>
                    </div>
                </div>

                <div className="mt-4 flex items-center gap-2 rounded border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                    <Info size={16} /> El importe mostrado excluye anulados. La valorización incluye solo pedidos atendidos.
                </div>
            </div>

            {detalle && (
                <Modal
                    ancho="max-w-2xl"
                    titulo={`Detalle del pedido · ${detalle.codigo}`}
                    onClose={() => setDetalle(null)}
                    footer={<button type="button" className="rounded bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700" onClick={() => setDetalle(null)}>Cerrar</button>}
                >
                    <div className="mb-5 grid grid-cols-2 overflow-hidden rounded-lg border border-gray-200 text-sm">
                        {[
                            ['Fecha de atención', fechaCorta(detalle.fecha_atencion)],
                            ['Estado', <span key="e" className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${chipEstado(detalle.estado).cls}`}>{chipEstado(detalle.estado).label}</span>],
                            ['Punto de atención', detalle.punto_atencion],
                            ['Empresa a cargo', detalle.empresa_cargo],
                            ['Solicitante', detalle.solicitante],
                            ['Moneda', detalle.moneda],
                        ].map(([k, v], i) => (
                            <div key={i} className="border-b border-r border-gray-100 p-3 [&:nth-child(2n)]:border-r-0">
                                <p className="text-xs text-gray-500">{k}</p>
                                <div className="font-medium text-gray-900">{v ?? '—'}</div>
                            </div>
                        ))}
                        <div className="col-span-2 p-3">
                            <p className="text-xs text-gray-500">Motivo</p>
                            <p className="font-medium text-gray-900">{detalle.motivo ?? '—'}</p>
                        </div>
                    </div>

                    {detalle.estado === 'ANULADO' && (
                        <div className="mb-5 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                            Motivo de anulación: {detalle.motivo_anulacion ?? '—'}
                        </div>
                    )}

                    <h4 className="mb-2 font-semibold text-gray-900">Detalle de extras</h4>
                    <table className="w-full border-collapse overflow-hidden rounded-lg border border-gray-200 text-sm">
                        <thead>
                            <tr className="bg-gray-100 text-gray-700">
                                <th className="px-3 py-2 text-left font-semibold">Concepto</th>
                                <th className="px-3 py-2 text-center font-semibold">Cantidad</th>
                                <th className="px-3 py-2 text-right font-semibold">Precio unitario</th>
                                <th className="px-3 py-2 text-right font-semibold">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(detalle.detalle ?? []).map((l: any) => (
                                <tr key={l.id ?? l.orden} className="border-t border-gray-100">
                                    <td className="px-3 py-2">{l.concepto}</td>
                                    <td className="px-3 py-2 text-center">{num(l.cantidad)}</td>
                                    <td className="px-3 py-2 text-right">{dinero(l.precio_unitario)}</td>
                                    <td className="px-3 py-2 text-right">{dinero(l.importe)}</td>
                                </tr>
                            ))}
                            <tr className="border-t border-gray-200 bg-gray-50 font-bold">
                                <td className="px-3 py-2 text-right" colSpan={3}>TOTAL DEL PEDIDO</td>
                                <td className="px-3 py-2 text-right text-base">{dinero(detalle.total)}</td>
                            </tr>
                        </tbody>
                    </table>

                    <h4 className="mb-2 mt-5 font-semibold text-gray-900">Observaciones</h4>
                    <p className="rounded bg-gray-50 px-3 py-2 text-sm text-gray-700">{detalle.observaciones || 'Sin observaciones.'}</p>
                </Modal>
            )}
        </>
    );
};

export default ReporteExtras;
