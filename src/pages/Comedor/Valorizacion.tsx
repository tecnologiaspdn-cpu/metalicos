import React, { useEffect, useMemo, useState } from 'react';
import notify from 'devextreme/ui/notify';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import { Calculator, Calendar, ChefHat, ChevronDown, ChevronRight, Eye, FileSpreadsheet, FileText, Info, Search, Users, Utensils } from 'lucide-react';
import { ComedorHeader, Modal, inputCls } from '../../components/Comedor/ComedorShared';
import { pick, soloFecha } from '../../components/Comedor/comedorUtils';
import { useComedorPuntos } from '../../hooks/useComedorPuntos';
import { apiManager } from '../../services/api/ApiManager';
import { asegurarOk, comedorApi } from '../../services/comedor/comedorApi';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MONEDAS = [
    { value: 'PEN', label: 'PEN', simbolo: 'S/' },
    { value: 'USD', label: 'USD', simbolo: 'US$' },
];
const TAM_DETALLE = 10;
const LIMITE_CONCEPTOS = 8;
const alternar = (set: React.Dispatch<React.SetStateAction<Set<string>>>, k: string) =>
    set((prev) => {
        const n = new Set(prev);
        if (n.has(k)) n.delete(k);
        else n.add(k);
        return n;
    });
// TODO(CONFIRMAR CON BACKEND): solo se vio el valor GENERAL; el resto se infiere de los nombres de los bloques.
const ETIQUETA_BLOQUE: Record<string, string> = { GENERAL: 'General', DIETA: 'Dieta', INVITADO: 'Invitado', EXTRA: 'Extra' };

const num = (v: any) => Number(v) || 0;
const nombreEmpresaFila = (r: any): string => String(pick(r, ['empresa', 'empresa_cargo', 'empresa_registrada']) ?? '—');

type Bloque = 'generales' | 'dietas' | 'invitados';

interface FilaComida {
    id: string;
    empresa: string;
    cantD: number; impD: number;
    cantA: number; impA: number;
    cantC: number; impC: number;
    cantO: number; impO: number;
    cantT: number; impT: number;
}

const aFilaComida = (r: any): FilaComida => ({
    id: String(r.id_empresa ?? nombreEmpresaFila(r)),
    empresa: nombreEmpresaFila(r),
    cantD: num(r.cantidad_desayunos), impD: num(r.importe_desayunos),
    cantA: num(r.cantidad_almuerzos), impA: num(r.importe_almuerzos),
    cantC: num(r.cantidad_cenas), impC: num(r.importe_cenas),
    cantO: num(r.cantidad_otros), impO: num(r.importe_otros),
    cantT: num(r.cantidad_total), impT: num(r.importe_total),
});

const sumar = (filas: FilaComida[]): FilaComida =>
    filas.reduce(
        (a, f) => ({
            ...a,
            cantD: a.cantD + f.cantD, impD: a.impD + f.impD,
            cantA: a.cantA + f.cantA, impA: a.impA + f.impA,
            cantC: a.cantC + f.cantC, impC: a.impC + f.impC,
            cantO: a.cantO + f.cantO, impO: a.impO + f.impO,
            cantT: a.cantT + f.cantT, impT: a.impT + f.impT,
        }),
        { id: 'total', empresa: 'TOTAL', cantD: 0, impD: 0, cantA: 0, impA: 0, cantC: 0, impC: 0, cantO: 0, impO: 0, cantT: 0, impT: 0 }
    );

const Valorizacion: React.FC = () => {
    const { puntos } = useComedorPuntos();
    const [empresas, setEmpresas] = useState<any[]>([]);
    const ahora = new Date();
    const [mes, setMes] = useState(ahora.getMonth() + 1);
    const [anio, setAnio] = useState(ahora.getFullYear());
    const [empresa, setEmpresa] = useState('');
    const [punto, setPunto] = useState('');
    const [moneda, setMoneda] = useState('PEN');

    const [datos, setDatos] = useState<any | null>(null);
    const [cargando, setCargando] = useState(false);
    const [exportando, setExportando] = useState<'excel' | 'pdf' | null>(null);
    // Filtros con los que se consultó (para que exportar y el detalle usen lo mostrado, no lo editado después).
    const [aplicado, setAplicado] = useState<{ mes: number; anio: number; empresa: string; punto: string; moneda: string } | null>(null);

    // Extras: filas de empresa plegables (el detalle por concepto puede ser muy largo).
    const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
    const [verTodas, setVerTodas] = useState<Set<string>>(new Set());
    const [busquedaExtras, setBusquedaExtras] = useState('');

    const [detalleDe, setDetalleDe] = useState<{ id: string; nombre: string } | null>(null);
    const [detalle, setDetalle] = useState<any | null>(null);
    const [pagDetalle, setPagDetalle] = useState(1);
    const [cargandoDetalle, setCargandoDetalle] = useState(false);

    const simbolo = MONEDAS.find((m) => m.value === (aplicado?.moneda ?? moneda))?.simbolo ?? 'S/';
    const dinero = (n: number) => `${simbolo} ${num(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    useEffect(() => {
        apiManager.maestro
            .listaEmpresas({})
            .then((r: any) => setEmpresas(r?.data || []))
            .catch(() => setEmpresas([]));
    }, []);

    const consultar = async () => {
        setCargando(true);
        try {
            const resp = asegurarOk(
                await comedorApi.valorizacionMensual({
                    anio,
                    mes,
                    id_empresa: empresa || undefined,
                    id_punto_atencion: punto || undefined,
                    moneda,
                    pagina: 1,
                    tamano: 1,
                }),
                'No se pudo consultar la valorización.'
            );
            setDatos(resp.data);
            setAplicado({ mes, anio, empresa, punto, moneda });
        } catch (e: any) {
            notify(e?.message || 'No se pudo consultar la valorización.', 'error', 4000);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        consultar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filasBloque = (b: Bloque): FilaComida[] => {
        const origen = b === 'generales' ? datos?.comidas_generales : b === 'dietas' ? datos?.dietas_autorizadas : datos?.invitados;
        return (Array.isArray(origen?.empresas) ? origen.empresas : []).map(aFilaComida);
    };
    const generales = useMemo(() => filasBloque('generales'), [datos]); // eslint-disable-line react-hooks/exhaustive-deps
    const dietas = useMemo(() => filasBloque('dietas'), [datos]); // eslint-disable-line react-hooks/exhaustive-deps
    const invitados = useMemo(() => filasBloque('invitados'), [datos]); // eslint-disable-line react-hooks/exhaustive-deps
    const conceptos: any[] = Array.isArray(datos?.extras?.conceptos) ? datos.extras.conceptos : [];
    const consolidado: any[] = Array.isArray(datos?.consolidado_empresas) ? datos.consolidado_empresas : [];
    const totales = (Array.isArray(datos?.totales_por_moneda) ? datos.totales_por_moneda : []).find((t: any) => t.moneda === (aplicado?.moneda ?? moneda));

    const abrirDetalle = async (fila: any) => {
        setDetalleDe({ id: String(fila.id_empresa ?? ''), nombre: nombreEmpresaFila(fila) });
        await cargarDetalle(String(fila.id_empresa ?? ''), 1);
    };

    const cargarDetalle = async (idEmpresa: string, pag: number) => {
        if (!aplicado) return;
        setCargandoDetalle(true);
        try {
            const resp = asegurarOk(
                await comedorApi.valorizacionMensual({
                    anio: aplicado.anio,
                    mes: aplicado.mes,
                    id_empresa: idEmpresa || undefined,
                    id_punto_atencion: aplicado.punto || undefined,
                    moneda: aplicado.moneda,
                    pagina: pag,
                    tamano: TAM_DETALLE,
                }),
                'No se pudo cargar el detalle.'
            );
            setDetalle(resp.data?.detalle ?? null);
            setPagDetalle(pag);
        } catch (e: any) {
            notify(e?.message || 'No se pudo cargar el detalle.', 'error', 4000);
        } finally {
            setCargandoDetalle(false);
        }
    };

    // ── Exportación ──────────────────────────────────────────────────────────
    const titulo = aplicado ? `Valorización mensual ${MESES[aplicado.mes - 1]} ${aplicado.anio} (${aplicado.moneda})` : 'Valorización mensual';
    const nombreArchivo = aplicado ? `comedor_valorizacion_${aplicado.anio}-${String(aplicado.mes).padStart(2, '0')}_${aplicado.moneda}` : 'comedor_valorizacion';

    const cabecerasComida = ['Empresa', 'Desay. cant.', 'Desay. importe', 'Almu. cant.', 'Almu. importe', 'Cenas cant.', 'Cenas importe', 'Otros cant.', 'Otros importe', 'Total cant.', 'Total importe'];
    const aFilaPlana = (f: FilaComida) => [f.empresa, f.cantD, f.impD, f.cantA, f.impA, f.cantC, f.impC, f.cantO, f.impO, f.cantT, f.impT];

    const bloquesExport = () => {
        const b: { nombre: string; cabeceras: string[]; filas: (string | number)[][] }[] = [];
        const comida = (nombre: string, filas: FilaComida[]) => {
            if (filas.length === 0) return;
            b.push({ nombre, cabeceras: cabecerasComida, filas: [...filas.map(aFilaPlana), aFilaPlana(sumar(filas))] });
        };
        comida('Comidas generales', generales);
        comida('Dietas autorizadas', dietas);
        comida('Invitados', invitados);
        if (conceptos.length) {
            b.push({
                nombre: 'Extras',
                cabeceras: ['Empresa', 'Concepto', 'Cantidad', 'P. unitario', 'Importe'],
                filas: [
                    ...conceptos.map((c) => [nombreEmpresaFila(c), String(c.concepto ?? ''), num(c.cantidad), num(c.precio_unitario), num(c.importe)]),
                    ['TOTAL EXTRAS', '', '', '', conceptos.reduce((a, c) => a + num(c.importe), 0)],
                ],
            });
        }
        b.push({
            nombre: 'Resumen consolidado',
            cabeceras: ['Empresa', 'Comidas generales', 'Dietas', 'Invitados', 'Extras', 'Total mensual'],
            filas: [
                ...consolidado.map((c) => [nombreEmpresaFila(c), num(c.comidas_generales), num(c.dietas), num(c.invitados), num(c.extras), num(c.total_mensual)]),
                ['TOTAL GENERAL', num(totales?.comidas_generales), num(totales?.dietas), num(totales?.invitados), num(totales?.extras), num(totales?.total_general)],
            ],
        });
        return b;
    };

    const exportar = async (formato: 'excel' | 'pdf') => {
        if (!datos) return notify('Consulte primero la valorización.', 'info', 3000);
        setExportando(formato);
        try {
            const bloques = bloquesExport();
            if (formato === 'excel') {
                const wb = new ExcelJS.Workbook();
                bloques.forEach((b) => {
                    const ws = wb.addWorksheet(b.nombre.slice(0, 31));
                    ws.addRow([titulo]).font = { bold: true, size: 13 };
                    ws.addRow([]);
                    const cab = ws.addRow(b.cabeceras);
                    cab.font = { bold: true };
                    b.filas.forEach((f) => ws.addRow(f));
                    ws.getRow(ws.rowCount).font = { bold: true };
                    ws.columns.forEach((c, i) => {
                        c.width = i === 0 ? 38 : 16;
                        if (i > 0) c.numFmt = '#,##0.00';
                    });
                });
                const buffer = await wb.xlsx.writeBuffer();
                saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${nombreArchivo}.xlsx`);
            } else {
                const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
                let y = 12;
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(13);
                pdf.text(`Comedor - ${titulo}`, 8, y);
                y += 8;
                bloques.forEach((b) => {
                    const ancho = 281 / b.cabeceras.length;
                    if (y + 14 > 200) { pdf.addPage(); y = 12; }
                    pdf.setFontSize(10);
                    pdf.setFont('helvetica', 'bold');
                    pdf.text(b.nombre, 8, y);
                    y += 5;
                    pdf.setFontSize(7);
                    b.cabeceras.forEach((h, i) => pdf.text(h, 8 + i * ancho, y));
                    pdf.line(8, y + 1.5, 289, y + 1.5);
                    y += 5;
                    b.filas.forEach((f, k) => {
                        if (y > 200) { pdf.addPage(); y = 12; }
                        pdf.setFont('helvetica', k === b.filas.length - 1 ? 'bold' : 'normal');
                        f.forEach((v, i) => {
                            const txt = typeof v === 'number' ? v.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(v);
                            pdf.text(pdf.splitTextToSize(txt, ancho - 2)[0] ?? '', 8 + i * ancho, y);
                        });
                        y += 4.5;
                    });
                    y += 6;
                });
                // Firmas de conformidad al pie (en hoja nueva si no queda espacio).
                if (y > 165) { pdf.addPage(); y = 20; }
                const yFirma = Math.max(y + 22, 170);
                pdf.setLineWidth(0.3);
                pdf.setFontSize(9);
                pdf.setFont('helvetica', 'bold');
                [
                    { x: 20, texto: 'Firma Representante Polimetálicos' },
                    { x: 180, texto: 'Firma Representante YRC GOURMET GROUP' },
                ].forEach(({ x, texto }) => {
                    pdf.line(x, yFirma, x + 90, yFirma);
                    pdf.text(texto, x + 45, yFirma + 5, { align: 'center' });
                });
                pdf.save(`${nombreArchivo}.pdf`);
            }
        } catch (e: any) {
            notify(e?.message || 'No se pudo exportar.', 'error', 4000);
        } finally {
            setExportando(null);
        }
    };

    // ── Presentación ─────────────────────────────────────────────────────────
    const anios = Array.from({ length: 6 }, (_, i) => ahora.getFullYear() - i);

    const tarjetas = [
        { titulo: 'Comidas generales', valor: num(totales?.comidas_generales), icono: <Utensils size={26} className="text-blue-600" />, cls: 'bg-blue-50 border-blue-200' },
        { titulo: 'Dietas autorizadas', valor: num(totales?.dietas), icono: <Users size={26} className="text-purple-600" />, cls: 'bg-purple-50 border-purple-200' },
        ...(num(totales?.invitados) > 0 ? [{ titulo: 'Invitados', valor: num(totales?.invitados), icono: <Users size={26} className="text-amber-600" />, cls: 'bg-amber-50 border-amber-200' }] : []),
        { titulo: 'Extras', valor: num(totales?.extras), icono: <ChefHat size={26} className="text-green-600" />, cls: 'bg-green-50 border-green-200' },
        { titulo: 'TOTAL DEL MES', valor: num(totales?.total_general), icono: <Calculator size={26} className="text-blue-700" />, cls: 'bg-blue-50 border-blue-200', fuerte: true },
    ];

    const th = 'border border-gray-200 px-3 py-2 font-semibold';
    const td = 'border border-gray-100 px-3 py-2';

    const TablaComidas: React.FC<{ n: number; color: string; titulo: string; sub: string; filas: FilaComida[] }> = ({ n, color, titulo: t, sub, filas }) => {
        const tot = sumar(filas);
        return (
            <section className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-3">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg font-bold ${color}`}>{n}</span>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">{t}</h3>
                        <p className="text-sm text-gray-500">{sub}</p>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="bg-gray-100 text-gray-700">
                                <th rowSpan={2} className={`${th} text-left`}>Empresa</th>
                                <th colSpan={2} className={`${th} text-center`}>Desayunos</th>
                                <th colSpan={2} className={`${th} text-center`}>Almuerzos</th>
                                <th colSpan={2} className={`${th} text-center`}>Cenas</th>
                                <th colSpan={2} className={`${th} text-center`}>Otros</th>
                                <th rowSpan={2} className={`${th} text-center`}>Total</th>
                            </tr>
                            <tr className="bg-gray-100 text-xs text-gray-700">
                                {[0, 1, 2, 3].map((i) => (
                                    <React.Fragment key={i}>
                                        <th className={`${th} text-center`}>Cant.</th>
                                        <th className={`${th} text-center`}>Importe</th>
                                    </React.Fragment>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filas.length === 0 && <tr><td colSpan={10} className="py-6 text-center text-gray-400">Sin consumos en el período.</td></tr>}
                            {filas.map((f) => (
                                <tr key={f.id} className="hover:bg-gray-50">
                                    <td className={td}>{f.empresa}</td>
                                    <td className={`${td} text-center`}>{f.cantD}</td><td className={`${td} text-right`}>{dinero(f.impD)}</td>
                                    <td className={`${td} text-center`}>{f.cantA}</td><td className={`${td} text-right`}>{dinero(f.impA)}</td>
                                    <td className={`${td} text-center`}>{f.cantC}</td><td className={`${td} text-right`}>{dinero(f.impC)}</td>
                                    <td className={`${td} text-center`}>{f.cantO}</td><td className={`${td} text-right`}>{dinero(f.impO)}</td>
                                    <td className={`${td} text-right`}>{dinero(f.impT)}</td>
                                </tr>
                            ))}
                            {filas.length > 0 && (
                                <tr className="bg-blue-50 font-bold text-gray-900">
                                    <td className={td}>TOTAL</td>
                                    <td className={`${td} text-center`}>{tot.cantD}</td><td className={`${td} text-right`}>{dinero(tot.impD)}</td>
                                    <td className={`${td} text-center`}>{tot.cantA}</td><td className={`${td} text-right`}>{dinero(tot.impA)}</td>
                                    <td className={`${td} text-center`}>{tot.cantC}</td><td className={`${td} text-right`}>{dinero(tot.impC)}</td>
                                    <td className={`${td} text-center`}>{tot.cantO}</td><td className={`${td} text-right`}>{dinero(tot.impO)}</td>
                                    <td className={`${td} text-right`}>{dinero(tot.impT)}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        );
    };

    const totalExtras = conceptos.reduce((a, c) => a + num(c.importe), 0);

    // Resumen por empresa (data.extras.empresas) + sus conceptos (data.extras.conceptos, enlazados por id_empresa).
    const extrasVista = useMemo(() => {
        const claveDe = (r: any) => String(r.id_empresa ?? nombreEmpresaFila(r));
        const resumen: any[] = Array.isArray(datos?.extras?.empresas) ? datos.extras.empresas : [];
        const grupos = new Map<string, { clave: string; empresa: string; importe: number; items: any[] }>();
        resumen.forEach((e) => grupos.set(claveDe(e), { clave: claveDe(e), empresa: nombreEmpresaFila(e), importe: num(e.importe_total), items: [] }));
        conceptos.forEach((c) => {
            const k = claveDe(c);
            let g = grupos.get(k);
            if (!g) {
                // Si el backend no trajo el resumen de esa empresa, se arma desde los conceptos.
                g = { clave: k, empresa: nombreEmpresaFila(c), importe: 0, items: [] };
                grupos.set(k, g);
            }
            g.items.push(c);
            if (resumen.length === 0) g.importe += num(c.importe);
        });
        const q = busquedaExtras.trim().toLowerCase();
        return Array.from(grupos.values())
            .map((g) => (!q || g.empresa.toLowerCase().includes(q) ? g : { ...g, items: g.items.filter((c) => String(c.concepto ?? '').toLowerCase().includes(q)) }))
            .filter((g) => !q || g.items.length > 0 || g.empresa.toLowerCase().includes(q));
    }, [datos, conceptos, busquedaExtras]);
    const totalPagDetalle = Math.max(1, Math.ceil(num(detalle?.total) / TAM_DETALLE));
    const registrosDetalle: any[] = Array.isArray(detalle?.registros) ? detalle.registros : [];

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
                <ComedorHeader
                    icono={<Calculator size={28} />}
                    subtitulo="Valorización mensual"
                    descripcion="Importes del mes por empresa: comidas, dietas, invitados y extras atendidos."
                    onAyuda={() => notify('Cada consumo se suma una sola vez: tarifa general, dieta o invitado. Los extras atendidos se agregan por separado, a la empresa a cargo del pedido.', 'info', 7000)}
                    acciones={
                        <>
                            <button type="button" disabled={!datos || exportando !== null} onClick={() => exportar('excel')} className="flex items-center gap-2 rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50">
                                <FileSpreadsheet size={16} /> {exportando === 'excel' ? 'Exportando…' : 'Exportar Excel'}
                            </button>
                            <button type="button" disabled={!datos || exportando !== null} onClick={() => exportar('pdf')} className="flex items-center gap-2 rounded border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
                                <FileText size={16} /> {exportando === 'pdf' ? 'Exportando…' : 'Exportar PDF'}
                            </button>
                        </>
                    }
                />

                <div className="mb-4 flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div>
                        <label className="mb-1 block text-xs text-gray-600">Mes:</label>
                        <div className="relative">
                            <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <select className={`${inputCls} pl-9`} value={mes} onChange={(e) => setMes(Number(e.target.value))}>
                                {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs text-gray-600">Año:</label>
                        <select className={inputCls} value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
                            {anios.map((a) => <option key={a} value={a}>{a}</option>)}
                        </select>
                    </div>
                    <div className="min-w-[200px] flex-1">
                        <label className="mb-1 block text-xs text-gray-600">Empresa:</label>
                        <select className={inputCls} value={empresa} onChange={(e) => setEmpresa(e.target.value)}>
                            <option value="">Todas</option>
                            {empresas.map((e) => <option key={e.id} value={e.id}>{e.razonSocial ?? e.nombre}</option>)}
                        </select>
                    </div>
                    <div className="min-w-[180px] flex-1">
                        <label className="mb-1 block text-xs text-gray-600">Punto de atención:</label>
                        <select className={inputCls} value={punto} onChange={(e) => setPunto(e.target.value)}>
                            <option value="">Todos</option>
                            {puntos.map((p) => <option key={p.id} value={p.id}>{p.nombre ?? p.codigo}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs text-gray-600">Moneda:</label>
                        <select className={inputCls} value={moneda} onChange={(e) => setMoneda(e.target.value)}>
                            {MONEDAS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                    </div>
                    <button type="button" onClick={consultar} disabled={cargando} className="flex items-center gap-2 rounded bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
                        <Search size={16} /> {cargando ? 'Consultando…' : 'Consultar'}
                    </button>
                </div>

                {!datos && !cargando && <p className="py-10 text-center text-gray-400">Seleccione el período y pulse Consultar.</p>}
                {cargando && !datos && <p className="py-10 text-center text-gray-400">Cargando…</p>}

                {datos && (
                    <div className={cargando ? 'opacity-60' : ''}>
                        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            {tarjetas.map((t) => (
                                <div key={t.titulo} className={`flex items-center gap-4 rounded-xl border p-4 ${t.cls}`}>
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/70">{t.icono}</div>
                                    <div>
                                        <div className={`text-sm ${t.fuerte ? 'font-bold uppercase' : ''} text-gray-700`}>{t.titulo}</div>
                                        <div className="text-2xl font-bold text-gray-900">{dinero(t.valor)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <TablaComidas n={1} color="bg-blue-100 text-blue-700" titulo="Comidas generales por empresa" sub="Solo consumos con tarifa general; excluye dietas autorizadas e invitados." filas={generales} />
                        <TablaComidas n={2} color="bg-purple-100 text-purple-700" titulo="Dietas autorizadas por empresa" sub="Valorizadas al precio especial aplicado en cada consumo." filas={dietas} />
                        {invitados.length > 0 && (
                            <TablaComidas n={3} color="bg-amber-100 text-amber-700" titulo="Invitados por empresa" sub="Consumos de invitados temporales." filas={invitados} />
                        )}

                        <section className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                            <div className="mb-3 flex items-center gap-3">
                                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 text-lg font-bold text-green-700">{invitados.length > 0 ? 4 : 3}</span>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">Extras por empresa</h3>
                                    <p className="text-sm text-gray-500">Solo pedidos atendidos · Empresa a cargo del pedido</p>
                                </div>
                            </div>
                            {conceptos.length === 0 ? (
                                <p className="py-6 text-center text-sm text-gray-400">Sin extras atendidos en el período.</p>
                            ) : (
                                <>
                                    <div className="mb-3 flex flex-wrap items-center gap-3">
                                        <div className="relative min-w-[220px] flex-1">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                            <input className={`${inputCls} pl-9`} placeholder="Buscar empresa o concepto…" value={busquedaExtras} onChange={(e) => setBusquedaExtras(e.target.value)} />
                                        </div>
                                        <button type="button" className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setAbiertas(new Set(extrasVista.map((g) => g.clave)))}>Expandir todo</button>
                                        <button type="button" className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setAbiertas(new Set())}>Contraer todo</button>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full border-collapse text-sm">
                                            <thead>
                                                <tr className="bg-gray-100 text-gray-700">
                                                    <th className={`${th} text-left`}>Empresa</th>
                                                    <th className={`${th} text-center`}>Conceptos</th>
                                                    <th className={`${th} text-right`}>Importe</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {extrasVista.length === 0 && <tr><td colSpan={3} className="py-6 text-center text-gray-400">Sin coincidencias.</td></tr>}
                                                {extrasVista.map((g) => {
                                                    const abierta = abiertas.has(g.clave) || busquedaExtras.trim() !== '';
                                                    const todas = verTodas.has(g.clave);
                                                    const visibles = todas ? g.items : g.items.slice(0, LIMITE_CONCEPTOS);
                                                    return (
                                                        <React.Fragment key={g.clave}>
                                                            <tr className="cursor-pointer bg-gray-50 hover:bg-gray-100" onClick={() => alternar(setAbiertas, g.clave)}>
                                                                <td className={`${td} font-semibold`}>
                                                                    <span className="flex items-center gap-2">
                                                                        {abierta ? <ChevronDown size={16} /> : <ChevronRight size={16} />} {g.empresa}
                                                                    </span>
                                                                </td>
                                                                <td className={`${td} text-center`}>{g.items.length}</td>
                                                                <td className={`${td} text-right font-semibold`}>{dinero(g.importe)}</td>
                                                            </tr>
                                                            {abierta && (
                                                                <tr>
                                                                    <td colSpan={3} className="border border-gray-100 bg-white p-0">
                                                                        <table className="w-full border-collapse text-sm">
                                                                            <thead>
                                                                                <tr className="text-xs text-gray-500">
                                                                                    <th className="py-2 pl-9 pr-3 text-left font-medium">Concepto</th>
                                                                                    <th className="px-3 py-2 text-center font-medium">Cantidad</th>
                                                                                    <th className="px-3 py-2 text-right font-medium">P. unitario</th>
                                                                                    <th className="px-3 py-2 text-right font-medium">Importe</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {visibles.map((c, i) => (
                                                                                    <tr key={i} className="border-t border-gray-100">
                                                                                        <td className="py-1.5 pl-9 pr-3">{c.concepto}</td>
                                                                                        <td className="px-3 py-1.5 text-center">{num(c.cantidad)}</td>
                                                                                        <td className="px-3 py-1.5 text-right">{dinero(num(c.precio_unitario))}</td>
                                                                                        <td className="px-3 py-1.5 text-right">{dinero(num(c.importe))}</td>
                                                                                    </tr>
                                                                                ))}
                                                                                {g.items.length > LIMITE_CONCEPTOS && (
                                                                                    <tr className="border-t border-gray-100">
                                                                                        <td colSpan={4} className="py-1.5 pl-9">
                                                                                            <button type="button" className="text-sm text-blue-600 hover:underline" onClick={() => alternar(setVerTodas, g.clave)}>
                                                                                                {todas ? 'Ver menos' : `Ver los ${g.items.length} conceptos`}
                                                                                            </button>
                                                                                        </td>
                                                                                    </tr>
                                                                                )}
                                                                            </tbody>
                                                                        </table>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                })}
                                                <tr className="bg-blue-50 font-bold text-gray-900">
                                                    <td className={td} colSpan={2}>TOTAL EXTRAS</td>
                                                    <td className={`${td} text-right`}>{dinero(totalExtras)}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </section>

                        <section className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                            <div className="mb-3 flex items-center gap-3">
                                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-lg font-bold text-blue-700">{invitados.length > 0 ? 5 : 4}</span>
                                <h3 className="text-lg font-bold text-gray-900">Resumen consolidado por empresa</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-sm">
                                    <thead>
                                        <tr className="bg-gray-100 text-gray-700">
                                            <th className={`${th} text-left`}>Empresa</th>
                                            <th className={`${th} text-center`}>Comidas generales</th>
                                            <th className={`${th} text-center`}>Dietas</th>
                                            <th className={`${th} text-center`}>Invitados</th>
                                            <th className={`${th} text-center`}>Extras</th>
                                            <th className={`${th} text-center`}>Total mensual</th>
                                            <th className={`${th} text-center`}>Detalle</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {consolidado.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-gray-400">Sin movimientos en el período.</td></tr>}
                                        {consolidado.map((c, i) => (
                                            <tr key={i} className="hover:bg-gray-50">
                                                <td className={td}>{nombreEmpresaFila(c)}</td>
                                                <td className={`${td} text-right`}>{dinero(num(c.comidas_generales))}</td>
                                                <td className={`${td} text-right`}>{dinero(num(c.dietas))}</td>
                                                <td className={`${td} text-right`}>{dinero(num(c.invitados))}</td>
                                                <td className={`${td} text-right`}>{dinero(num(c.extras))}</td>
                                                <td className={`${td} text-right font-semibold`}>{dinero(num(c.total_mensual))}</td>
                                                <td className={`${td} text-center`}>
                                                    {/* Sin id_empresa (p. ej. invitados) no hay filtro posible para el detalle. */}
                                                    <button
                                                        type="button"
                                                        title={c.id_empresa ? 'Ver detalle' : 'Sin empresa asignada: no tiene detalle por empresa'}
                                                        disabled={!c.id_empresa}
                                                        onClick={() => abrirDetalle(c)}
                                                        className="rounded p-1 text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
                                                    >
                                                        <Eye size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {consolidado.length > 0 && (
                                            <tr className="bg-blue-50 font-bold text-gray-900">
                                                <td className={td}>TOTAL GENERAL</td>
                                                <td className={`${td} text-right`}>{dinero(num(totales?.comidas_generales))}</td>
                                                <td className={`${td} text-right`}>{dinero(num(totales?.dietas))}</td>
                                                <td className={`${td} text-right`}>{dinero(num(totales?.invitados))}</td>
                                                <td className={`${td} text-right`}>{dinero(num(totales?.extras))}</td>
                                                <td className={`${td} text-right`}>{dinero(num(totales?.total_general))}</td>
                                                <td className={td} />
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mt-3 flex items-center gap-2 rounded border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                                <Info size={16} /> Cada consumo se suma una sola vez: tarifa general, dieta o invitado. Los extras se agregan por separado. No incluye impuestos ni conversión de moneda.
                            </div>
                            {num(totales?.importe_sin_empresa_asignada) > 0 && (
                                <div className="mt-2 flex items-center gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                    <Info size={16} /> {dinero(num(totales.importe_sin_empresa_asignada))} corresponden a invitados sin empresa asignada; no se pueden detallar por empresa.
                                </div>
                            )}
                        </section>
                    </div>
                )}

                {detalleDe && (
                    <Modal
                        ancho="max-w-4xl"
                        titulo={`Detalle · ${detalleDe.nombre}`}
                        subtitulo={aplicado ? `${MESES[aplicado.mes - 1]} ${aplicado.anio}` : undefined}
                        onClose={() => { setDetalleDe(null); setDetalle(null); }}
                        footer={
                            <div className="flex w-full items-center justify-between text-sm text-gray-500">
                                <span>{num(detalle?.total)} movimientos</span>
                                <div className="flex gap-2">
                                    <button className="rounded border px-3 py-1 disabled:opacity-40" disabled={pagDetalle <= 1 || cargandoDetalle} onClick={() => cargarDetalle(detalleDe.id, pagDetalle - 1)}>Anterior</button>
                                    <span className="rounded bg-blue-600 px-3 py-1 text-white">{pagDetalle}</span>
                                    <button className="rounded border px-3 py-1 disabled:opacity-40" disabled={pagDetalle >= totalPagDetalle || cargandoDetalle} onClick={() => cargarDetalle(detalleDe.id, pagDetalle + 1)}>Siguiente</button>
                                </div>
                            </div>
                        }
                    >
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="bg-gray-100 text-gray-700">
                                        <th className={`${th} text-left`}>Fecha</th>
                                        <th className={`${th} text-left`}>Bloque</th>
                                        <th className={`${th} text-left`}>Código</th>
                                        <th className={`${th} text-left`}>Concepto</th>
                                        <th className={`${th} text-left`}>Punto</th>
                                        <th className={`${th} text-center`}>Cant.</th>
                                        <th className={`${th} text-right`}>P. unit.</th>
                                        <th className={`${th} text-right`}>Importe</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cargandoDetalle && <tr><td colSpan={8} className="py-8 text-center text-gray-400">Cargando…</td></tr>}
                                    {!cargandoDetalle && registrosDetalle.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-gray-400">Sin movimientos.</td></tr>}
                                    {!cargandoDetalle &&
                                        registrosDetalle.map((r, i) => (
                                            <tr key={`${r.bloque}-${r.id_registro}-${r.id_detalle ?? i}`} className="hover:bg-gray-50">
                                                <td className={`${td} whitespace-nowrap`}>{soloFecha(r.fecha).split('-').reverse().join('/')}</td>
                                                <td className={td}>{ETIQUETA_BLOQUE[r.bloque] ?? r.bloque ?? '—'}</td>
                                                <td className={`${td} whitespace-nowrap`}>{r.codigo ?? '—'}</td>
                                                <td className={td}>{r.concepto ?? '—'}</td>
                                                <td className={td}>{r.punto_atencion ?? '—'}</td>
                                                <td className={`${td} text-center`}>{num(r.cantidad)}</td>
                                                <td className={`${td} text-right`}>{dinero(num(r.precio_unitario))}</td>
                                                <td className={`${td} text-right`}>{dinero(num(r.importe))}</td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </Modal>
                )}
            </div>
        </div>
    );
};

export default Valorizacion;
