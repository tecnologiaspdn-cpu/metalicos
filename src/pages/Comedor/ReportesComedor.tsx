import React, { useCallback, useEffect, useMemo, useState } from 'react';
import notify from 'devextreme/ui/notify';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import { Calendar, FileSpreadsheet, FileText, Filter, Moon, RefreshCw, Search, Sun, Sunset, Users } from 'lucide-react';
import { ComedorHeader, inputCls } from '../../components/Comedor/ComedorShared';
import ReporteExtras from '../../components/Comedor/ReporteExtras';
import { formatearFechaHora, hoyLima, nombreCompleto, normalizarListado, pick } from '../../components/Comedor/comedorUtils';
import { formatearPrecio, simboloMoneda } from '../../components/Comedor/dietasLogic';
import { useComedorPuntos } from '../../hooks/useComedorPuntos';
import { apiManager } from '../../services/api/ApiManager';
import { asegurarOk, comedorApi, FiltrosReporte } from '../../services/comedor/comedorApi';

const TAMANOS = [10, 15, 25, 50];

interface FilaReporte {
    fecha: string;
    servicio: string;
    documento: string;
    nombres: string;
    empresa: string;
    area: string;
    /** Precio aplicado ya formateado ("S/ 11.50"); para Excel se usa `precioNum`. */
    precio: string;
    precioNum: number | null;
    moneda: string;
}

const aFila = (r: any): FilaReporte => {
    const c = r?.comensal ?? r?.trabajador ?? r?.invitado ?? r;
    const bruto = pick(r, ['precio_aplicado']);
    const precioNum = bruto !== undefined && isFinite(Number(bruto)) ? Number(bruto) : null;
    const moneda = String(pick(r, ['moneda']) ?? 'PEN');
    return {
        fecha: formatearFechaHora(pick(r, ['fecha_hora_registro', 'fecha_hora', 'fecha_consumo', 'fecha_registro', 'fecha'])),
        servicio: String(pick(r, ['tipo_servicio', 'tipo_servicio_nombre', 'servicio', 'nombre_servicio']) ?? '—'),
        documento: String(pick(c, ['dni', 'numero_documento', 'documento']) ?? pick(r, ['dni', 'numero_documento']) ?? '—'),
        nombres: nombreCompleto(c) || '—',
        empresa: String(pick(r, ['empresa_comensal', 'empresa', 'empresa_nombre', 'empresa_referencia']) ?? pick(c, ['empresa', 'empresa_nombre', 'empresa_referencia']) ?? '—'),
        area: String(pick(r, ['area', 'area_nombre']) ?? pick(c, ['area', 'area_nombre']) ?? '—'),
        precio: precioNum === null ? '—' : formatearPrecio(precioNum, moneda),
        precioNum,
        moneda,
    };
};

const COLUMNAS: { titulo: string; clave: keyof FilaReporte; ancho: number }[] = [
    { titulo: 'Fecha y Hora', clave: 'fecha', ancho: 24 },
    { titulo: 'Tipo de Comida', clave: 'servicio', ancho: 18 },
    { titulo: 'DNI', clave: 'documento', ancho: 14 },
    { titulo: 'Nombres y Apellidos', clave: 'nombres', ancho: 36 },
    { titulo: 'Empresa', clave: 'empresa', ancho: 34 },
    { titulo: 'Área', clave: 'area', ancho: 22 },
    { titulo: 'Precio Aplicado', clave: 'precio', ancho: 16 },
];

const chipServicio = (s: string) => {
    const n = s.toLowerCase();
    if (n.includes('desayuno')) return 'bg-green-100 text-green-700';
    if (n.includes('almuerzo')) return 'bg-amber-100 text-amber-700';
    if (n.includes('cena')) return 'bg-purple-100 text-purple-700';
    return 'bg-gray-100 text-gray-700';
};

const ReportesComedor: React.FC = () => {
    const [pestana, setPestana] = useState<'comensales' | 'extras'>('comensales');
    const { puntos, idPunto } = useComedorPuntos();
    const [empresas, setEmpresas] = useState<any[]>([]);
    const hoy = hoyLima();

    const [fechaInicio, setFechaInicio] = useState(hoy);
    const [fechaFin, setFechaFin] = useState(hoy);
    const [puntoFiltro, setPuntoFiltro] = useState<string>('');
    const [empresaFiltro, setEmpresaFiltro] = useState<string>('');
    const [tipoComensal, setTipoComensal] = useState<string>('');
    const [estado, setEstado] = useState<string>('1');

    const [filas, setFilas] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    // Totales por servicio de TODO el filtro (no solo de la página visible).
    const [resumen, setResumen] = useState<{ servicio: string; total: number }[]>([]);
    const [pagina, setPagina] = useState(1);
    const [tamano, setTamano] = useState(15);
    const [cargando, setCargando] = useState(false);
    const [exportando, setExportando] = useState<'excel' | 'pdf' | null>(null);
    const [consultado, setConsultado] = useState(false);

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

    const filtros = useCallback(
        (): FiltrosReporte => ({
            fecha_inicio: fechaInicio,
            fecha_fin: fechaFin,
            id_punto_atencion: puntoFiltro || undefined,
            id_empresa_comensal: empresaFiltro || undefined,
            tipo_comensal: tipoComensal || undefined,
            estado: estado || 'todos',
        }),
        [fechaInicio, fechaFin, puntoFiltro, empresaFiltro, tipoComensal, estado]
    );

    const consultar = useCallback(
        async (pag = 1, tam = tamano) => {
            if (!fechaInicio || !fechaFin) return notify('Indique el rango de fechas.', 'warning', 3000);
            if (fechaInicio > fechaFin) return notify('La fecha inicio no puede ser mayor que la fecha fin.', 'warning', 3000);
            setCargando(true);
            try {
                const resp = asegurarOk(await comedorApi.reporteConsumos({ ...filtros(), pagina: pag, tamano: tam }), 'No se pudo consultar el reporte.');
                const { filas: f, total: t } = normalizarListado(resp.data);
                setFilas(f);
                setTotal(t);
                setResumen(Array.isArray(resp.data?.resumen_servicios) ? resp.data.resumen_servicios : []);
                setPagina(pag);
                setConsultado(true);
            } catch (e: any) {
                notify(e?.message || 'No se pudo consultar el reporte.', 'error', 4000);
            } finally {
                setCargando(false);
            }
        },
        [filtros, fechaInicio, fechaFin, tamano]
    );

    const limpiar = () => {
        setFechaInicio(hoy);
        setFechaFin(hoy);
        setPuntoFiltro(idPunto ? String(idPunto) : '');
        setEmpresaFiltro('');
        setTipoComensal('');
        setEstado('1');
        setFilas([]);
        setTotal(0);
        setResumen([]);
        setPagina(1);
        setConsultado(false);
    };

    const filasVista = useMemo(() => filas.map(aFila), [filas]);
    const totalPaginas = Math.max(1, Math.ceil(total / tamano));
    const conteo = (clave: string) =>
        resumen.filter((r) => r.servicio?.toLowerCase().includes(clave)).reduce((s, r) => s + Number(r.total || 0), 0);

    /** Trae TODAS las filas del filtro actual (el backend pagina), para exportar. */
    const traerTodo = async (): Promise<FilaReporte[]> => {
        const acumulado: any[] = [];
        const LOTE = 100;
        for (let pag = 1; pag <= 200; pag++) {
            const resp = asegurarOk(await comedorApi.reporteConsumos({ ...filtros(), pagina: pag, tamano: LOTE }), 'No se pudo consultar el reporte.');
            const { filas: f, total: t } = normalizarListado(resp.data);
            if (f.length === 0) break;
            acumulado.push(...f);
            if (acumulado.length >= t) break;
        }
        return acumulado.map(aFila);
    };

    const exportar = async (formato: 'excel' | 'pdf') => {
        setExportando(formato);
        try {
            const datos = await traerTodo();
            if (datos.length === 0) return notify('No hay registros para exportar.', 'info', 3000);
            const nombre = `comedor_comensales_${fechaInicio}_${fechaFin}`;

            if (formato === 'excel') {
                const wb = new ExcelJS.Workbook();
                const ws = wb.addWorksheet('Comensales');
                ws.columns = [{ header: 'N°', key: 'n', width: 6 }, ...COLUMNAS.map((c) => ({ header: c.titulo, key: c.clave, width: c.ancho }))];
                datos.forEach((d, i) => {
                    // En Excel el precio va como número (sumable) con el símbolo de su moneda.
                    const fila = ws.addRow({ n: i + 1, ...d, precio: d.precioNum ?? '' });
                    if (d.precioNum !== null) fila.getCell('precio').numFmt = `"${simboloMoneda(d.moneda)}" #,##0.00`;
                });
                ws.getRow(1).font = { bold: true };
                const buffer = await wb.xlsx.writeBuffer();
                saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${nombre}.xlsx`);
            } else {
                const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
                const anchos = [10, 34, 26, 20, 66, 58, 38, 26];
                const encabezados = ['N°', ...COLUMNAS.map((c) => c.titulo)];
                let y = 15;
                const cabecera = () => {
                    pdf.setFont('helvetica', 'bold');
                    pdf.setFontSize(8);
                    let x = 8;
                    encabezados.forEach((h, i) => {
                        pdf.text(h, x, y);
                        x += anchos[i];
                    });
                    pdf.line(8, y + 1.5, 289, y + 1.5);
                    y += 6;
                    pdf.setFont('helvetica', 'normal');
                };
                pdf.setFontSize(12);
                pdf.setFont('helvetica', 'bold');
                pdf.text(`Reporte de Comensales  ${fechaInicio} al ${fechaFin}  (${datos.length} registros)`, 8, 9);
                cabecera();
                pdf.setFontSize(7.5);
                datos.forEach((d, i) => {
                    if (y > 200) {
                        pdf.addPage();
                        y = 15;
                        cabecera();
                        pdf.setFontSize(7.5);
                    }
                    let x = 8;
                    [String(i + 1), ...COLUMNAS.map((c) => String(d[c.clave] ?? ''))].forEach((v, k) => {
                        pdf.text(pdf.splitTextToSize(v, anchos[k] - 2)[0] ?? '', x, y);
                        x += anchos[k];
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

    const tarjetas = [
        { titulo: 'Total de registros', valor: total, icono: <Users size={26} className="text-blue-600" />, cls: 'bg-blue-50 border-blue-200' },
        { titulo: 'Desayuno', valor: conteo('desayuno'), icono: <Sun size={26} className="text-green-600" />, cls: 'bg-green-50 border-green-200' },
        { titulo: 'Almuerzo', valor: conteo('almuerzo'), icono: <Sunset size={26} className="text-amber-500" />, cls: 'bg-amber-50 border-amber-200' },
        { titulo: 'Cena', valor: conteo('cena'), icono: <Moon size={26} className="text-purple-600" />, cls: 'bg-purple-50 border-purple-200' },
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
                <ComedorHeader
                    subtitulo="Reporte de Comensales"
                    descripcion="Consulta el registro de comensales por rango de fechas y otros filtros."
                    onAyuda={() => notify('Elija el rango de fechas y presione Consultar. Exportar incluye todos los registros del filtro, no solo la página visible.', 'info', 5000)}
                />

                <div className="mb-5 flex gap-2 rounded-lg bg-gray-100 p-1 sm:w-fit">
                    {([['comensales', 'Comensales'], ['extras', 'Extras']] as const).map(([k, etiqueta]) => (
                        <button
                            key={k}
                            type="button"
                            onClick={() => setPestana(k)}
                            className={`rounded px-8 py-2 text-sm font-medium ${pestana === k ? 'bg-blue-600 text-white shadow' : 'text-gray-700 hover:bg-gray-200'}`}
                        >
                            {etiqueta}
                        </button>
                    ))}
                </div>

                {pestana === 'extras' ? (
                    <ReporteExtras />
                ) : (
                <>
                <div className="mb-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-900">
                        <Filter size={18} className="text-blue-600" /> Filtros de búsqueda
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
                        <div>
                            <label className="mb-1 block text-sm text-gray-700">Fecha inicio</label>
                            <div className="relative">
                                <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input type="date" className={`${inputCls} pl-9`} value={fechaInicio} max={fechaFin} onChange={(e) => setFechaInicio(e.target.value)} />
                            </div>
                        </div>
                        <div>
                            <label className="mb-1 block text-sm text-gray-700">Fecha fin</label>
                            <div className="relative">
                                <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input type="date" className={`${inputCls} pl-9`} value={fechaFin} min={fechaInicio} onChange={(e) => setFechaFin(e.target.value)} />
                            </div>
                        </div>
                        <div>
                            <label className="mb-1 block text-sm text-gray-700">Punto de atención</label>
                            <select className={inputCls} value={puntoFiltro} onChange={(e) => setPuntoFiltro(e.target.value)}>
                                <option value="">Todos</option>
                                {puntos.map((p) => <option key={p.id} value={p.id}>{p.nombre || p.codigo}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-sm text-gray-700">Empresa</label>
                            <select className={inputCls} value={empresaFiltro} onChange={(e) => setEmpresaFiltro(e.target.value)}>
                                <option value="">Todas</option>
                                {empresas.map((e) => <option key={e.id} value={e.id}>{e.razonSocial ?? e.nombre}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-sm text-gray-700">Comensal</label>
                            <select className={inputCls} value={tipoComensal} onChange={(e) => setTipoComensal(e.target.value)}>
                                <option value="">Todos</option>
                                <option value="INVITADO">Invitados</option>
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-sm text-gray-700">Estado</label>
                            <select className={inputCls} value={estado} onChange={(e) => setEstado(e.target.value)}>
                                <option value="1">Vigentes</option>
                                <option value="0">Anulados</option>
                                <option value="todos">Todos</option>
                            </select>
                        </div>
                    </div>
                    <div className="mt-4 flex justify-end gap-3">
                        <button type="button" onClick={() => consultar(1)} disabled={cargando} className="flex items-center gap-2 rounded bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
                            <Search size={16} /> {cargando ? 'Consultando…' : 'Consultar'}
                        </button>
                        <button type="button" onClick={limpiar} className="flex items-center gap-2 rounded border border-blue-300 px-5 py-2 text-sm text-blue-600 hover:bg-blue-50">
                            <RefreshCw size={16} /> Limpiar
                        </button>
                    </div>
                </div>

                <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {tarjetas.map((t) => (
                        <div key={t.titulo} className={`flex items-center gap-4 rounded-xl border p-4 ${t.cls}`}>
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/70">{t.icono}</div>
                            <div>
                                <p className="text-sm text-gray-600">{t.titulo}</p>
                                <p className="text-3xl font-bold text-gray-900">{consultado ? t.valor : '—'}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                            <FileText size={18} className="text-blue-600" /> Listado de Comensales
                        </h3>
                        <div className="flex gap-2">
                            <button type="button" disabled={!!exportando || !consultado} onClick={() => exportar('excel')} className="flex items-center gap-2 rounded bg-green-700 px-4 py-2 text-sm text-white hover:bg-green-800 disabled:opacity-50">
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
                                    <th className="px-3 py-2.5 font-semibold">N°</th>
                                    {COLUMNAS.map((c) => <th key={c.clave} className="px-3 py-2.5 font-semibold">{c.titulo}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {cargando && <tr><td colSpan={8} className="py-10 text-center text-gray-400">Consultando…</td></tr>}
                                {!cargando && filasVista.length === 0 && (
                                    <tr><td colSpan={8} className="py-10 text-center text-gray-400">{consultado ? 'Sin registros para los filtros indicados.' : 'Presione Consultar para ver los registros.'}</td></tr>
                                )}
                                {!cargando &&
                                    filasVista.map((f, i) => (
                                        <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                                            <td className="px-3 py-2.5 text-gray-500">{(pagina - 1) * tamano + i + 1}</td>
                                            <td className="whitespace-nowrap px-3 py-2.5">{f.fecha}</td>
                                            <td className="px-3 py-2.5"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${chipServicio(f.servicio)}`}>{f.servicio}</span></td>
                                            <td className="px-3 py-2.5">{f.documento}</td>
                                            <td className="px-3 py-2.5 uppercase">{f.nombres}</td>
                                            <td className="px-3 py-2.5 uppercase">{f.empresa}</td>
                                            <td className="px-3 py-2.5 uppercase">{f.area}</td>
                                            <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{f.precio}</td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
                        <span>
                            Mostrando {filas.length === 0 ? 0 : (pagina - 1) * tamano + 1} a {(pagina - 1) * tamano + filas.length} de {total} registros
                        </span>
                        <div className="flex items-center gap-2">
                            <select className="rounded border border-gray-300 px-2 py-1" value={tamano} onChange={(e) => { const t = Number(e.target.value); setTamano(t); if (consultado) consultar(1, t); }}>
                                {TAMANOS.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <span>registros por página</span>
                            <button className="rounded border px-3 py-1 disabled:opacity-40" disabled={pagina <= 1 || cargando} onClick={() => consultar(pagina - 1)}>Anterior</button>
                            <span className="rounded bg-blue-600 px-3 py-1 text-white">{pagina} / {totalPaginas}</span>
                            <button className="rounded border px-3 py-1 disabled:opacity-40" disabled={pagina >= totalPaginas || cargando} onClick={() => consultar(pagina + 1)}>Siguiente</button>
                        </div>
                    </div>
                </div>
                </>
                )}
            </div>
        </div>
    );
};

export default ReportesComedor;
