import React, { useCallback, useEffect, useMemo, useState } from 'react';
import notify from 'devextreme/ui/notify';
import { confirm } from 'devextreme/ui/dialog';
import { Ban, Eye, FileText, Info, Pencil, Plus, Search, Send, Trash2 } from 'lucide-react';
import {
    EstadoChip, GUARDIAS, LabHeader, Modal, Paginacion, RecepcionChip, campo, codigoEstado, inputCls, nombrePersona, useEmpresas, usePersonalEmpresa, useSesion,
} from '../../components/LaboratorioQuimico/LabShared';
import { hoyLima, pick } from '../../components/Comedor/comedorUtils';
import { nuevoIdSolicitud } from '../../services/comedor/comedorApi';
import { descargarPdfBlob } from '../../services/firmaDocumentos/firmaDocumentosApi';
import { abrirPdf, asegurarOk, CuerpoSolicitud, extraerListado, labQuimicoApi } from '../../services/labQuimico/labQuimicoApi';

const TAM_PAGINA = 15;
const ROL_ENVIA = 'Enviado por';
const ROL_AUTORIZA = 'Autorizado por';
// TODO(CONFIRMAR CON BACKEND): la colección solo usa los roles "Enviado por" y "Autorizado por".
// TODO(CONFIRMAR CON BACKEND): rol enviado para el responsable de laboratorio (antes "Representante de compañía").
const ROL_RESPONSABLE_LAB = 'Responsable de Laboratorio';
const AREA_LABORATORIO = 16;

interface MuestraForm {
    cantidad: string;
    codigo: string;
    analisis: number[];
    observaciones: string;
}

interface FormSolicitud {
    requiere_firma: boolean;
    id_empresa: string;
    fecha: string;
    guardia: string;
    id_autorizador: string;
    id_representante: string;
    id_tipo_muestra: string;
    detalle_tipo: string;
    indicaciones: string;
    sacos: string;
    muestras: MuestraForm[];
}

const muestraVacia = (): MuestraForm => ({ cantidad: '1', codigo: '', analisis: [], observaciones: '' });

const SolicitudMuestra: React.FC = () => {
    const sesion = useSesion();
    const empresas = useEmpresas();
    const [tiposMuestra, setTiposMuestra] = useState<any[]>([]);
    const [tiposAnalisis, setTiposAnalisis] = useState<any[]>([]);

    // Filtros del listado
    const [busqueda, setBusqueda] = useState('');
    const [empresaFiltro, setEmpresaFiltro] = useState('');
    const [estadoFiltro, setEstadoFiltro] = useState('');
    const [desde, setDesde] = useState('');
    const [hasta, setHasta] = useState('');
    const [soloMias, setSoloMias] = useState(false);

    const [filas, setFilas] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [pagina, setPagina] = useState(1);
    const [cargando, setCargando] = useState(true);

    // Modal de solicitud
    const [abierto, setAbierto] = useState(false);
    const [editando, setEditando] = useState<any | null>(null);
    const [soloLectura, setSoloLectura] = useState(false);
    const [clave, setClave] = useState(nuevoIdSolicitud());
    const [form, setForm] = useState<FormSolicitud | null>(null);
    const [guardando, setGuardando] = useState(false);

    const [anulando, setAnulando] = useState<any | null>(null);
    const [motivoAnulacion, setMotivoAnulacion] = useState('');

    const personal = usePersonalEmpresa(form?.id_empresa || null);
    // El laboratorio es de la empresa del usuario (no de la compañía que envía la muestra): solo su área de laboratorio.
    const personalEmpresaPropia = usePersonalEmpresa(sesion.empresa_id || null);
    const personalLaboratorio = useMemo(
        () => personalEmpresaPropia.filter((p) => Number(p.area ?? p.id_area) === AREA_LABORATORIO),
        [personalEmpresaPropia]
    );

    useEffect(() => {
        const habilitados = (r: any) => (Array.isArray(r?.data) ? r.data.filter((t: any) => t.estado === undefined || t.estado === 1) : []);
        Promise.all([labQuimicoApi.tiposMuestra(), labQuimicoApi.tiposAnalisis()])
            .then(([tm, ta]) => {
                setTiposMuestra(habilitados(asegurarOk(tm, 'No se pudo cargar los tipos de muestra.')));
                setTiposAnalisis(habilitados(asegurarOk(ta, 'No se pudo cargar los tipos de análisis.')));
            })
            .catch((e: any) => notify(e?.message || 'No se pudo cargar los catálogos del laboratorio.', 'error', 6000));
    }, []);

    const cargar = useCallback(
        async (pag = 1) => {
            if (desde && hasta && desde > hasta) return notify('"Desde" no puede ser posterior a "Hasta".', 'warning', 3000);
            setCargando(true);
            try {
                const resp = asegurarOk(
                    await labQuimicoApi.listar({
                        pagina: pag,
                        tamano: TAM_PAGINA,
                        solo_mias: soloMias,
                        busqueda: busqueda.trim() || undefined,
                        id_empresa: empresaFiltro || undefined,
                        estado: estadoFiltro || undefined,
                        fecha_inicio: desde || undefined,
                        fecha_fin: hasta || undefined,
                    }),
                    'No se pudo cargar las solicitudes.'
                );
                const { filas: f, total: t } = extraerListado(resp.data);
                setFilas(f);
                setTotal(t);
                setPagina(pag);
            } catch (e: any) {
                notify(e?.message || 'No se pudo cargar las solicitudes.', 'error', 4000);
                setFilas([]);
                setTotal(0);
            } finally {
                setCargando(false);
            }
        },
        [busqueda, empresaFiltro, estadoFiltro, desde, hasta, soloMias]
    );

    // Recarga al cambiar filtros de selección; la búsqueda por texto se aplica con Enter.
    useEffect(() => {
        cargar(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [empresaFiltro, estadoFiltro, desde, hasta, soloMias]);

    // ── Formulario ───────────────────────────────────────────────────────────
    const formDesde = (d: any): FormSolicitud => {
        const resp: any[] = Array.isArray(d.responsables) ? d.responsables : [];
        const deRol = (parte: string) => resp.find((r) => String(r.rol ?? '').toLowerCase().includes(parte))?.id_personal;
        return {
            requiere_firma: d.requiere_firma !== false,
            id_empresa: String(d.id_empresa ?? ''),
            fecha: String(d.fecha ?? '').slice(0, 10) || hoyLima(),
            guardia: String(d.guardia ?? 'DIA').toUpperCase(),
            id_autorizador: String(deRol('autoriz') ?? ''),
            id_representante: String(deRol('laborat') ?? deRol('represent') ?? ''),
            id_tipo_muestra: String(d.id_tipo_muestra ?? ''),
            detalle_tipo: d.detalle_tipo_muestra ?? '',
            indicaciones: d.indicaciones ?? '',
            sacos: String(d.sacos ?? ''),
            muestras: (Array.isArray(d.muestras) ? d.muestras : []).map((m: any) => ({
                cantidad: String(m.cantidad ?? ''),
                codigo: m.codigo ?? '',
                analisis: Array.isArray(m.analisis_ids) ? m.analisis_ids.map(Number) : (Array.isArray(m.analisis) ? m.analisis : []).map((a: any) => Number(a?.id ?? a)),
                observaciones: m.observaciones ?? '',
            })),
        };
    };

    const abrirNueva = () => {
        setEditando(null);
        setSoloLectura(false);
        setClave(nuevoIdSolicitud());
        setForm({
            requiere_firma: true,
            id_empresa: sesion.empresa_id ? String(sesion.empresa_id) : '',
            fecha: hoyLima(),
            guardia: 'DIA',
            id_autorizador: '',
            id_representante: '',
            id_tipo_muestra: '',
            detalle_tipo: '',
            indicaciones: '',
            sacos: '',
            muestras: [muestraVacia()],
        });
        setAbierto(true);
    };

    const abrirExistente = async (fila: any, lectura: boolean) => {
        try {
            const d = asegurarOk(await labQuimicoApi.obtener(fila.id), 'No se pudo cargar la solicitud.').data;
            setEditando(d);
            setSoloLectura(lectura);
            setClave(d.clave ?? nuevoIdSolicitud());
            setForm(formDesde(d));
            setAbierto(true);
        } catch (e: any) {
            notify(e?.message || 'No se pudo cargar la solicitud.', 'error', 4000);
        }
    };

    const setCampo = (k: keyof Omit<FormSolicitud, 'muestras'>) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
        setForm((f) => (f ? { ...f, [k]: e.target.value } : f));

    const setMuestra = (i: number, parcial: Partial<MuestraForm>) =>
        setForm((f) => (f ? { ...f, muestras: f.muestras.map((m, j) => (j === i ? { ...m, ...parcial } : m)) } : f));

    const alternarAnalisis = (i: number, id: number) =>
        setForm((f) => {
            if (!f) return f;
            return {
                ...f,
                muestras: f.muestras.map((m, j) =>
                    j !== i ? m : { ...m, analisis: m.analisis.includes(id) ? m.analisis.filter((a) => a !== id) : [...m.analisis, id] }
                ),
            };
        });

    const totalMuestras = form ? form.muestras.reduce((a, m) => a + (Number(m.cantidad) || 0), 0) : 0;
    const tipoSeleccionado = tiposMuestra.find((t) => String(t.id) === form?.id_tipo_muestra);

    /** Guarda el borrador (crea o actualiza) y devuelve la solicitud resultante, o null si falló la validación/guardado. */
    const guardarBorrador = async (): Promise<any | null> => {
        if (!form) return null;
        if (!form.id_empresa || !form.fecha || !form.guardia) { notify('Complete compañía, fecha y guardia.', 'warning', 3000); return null; }
        if (!sesion.idPersonal) { notify('No se pudo identificar al usuario que envía.', 'warning', 3000); return null; }
        if (!form.id_autorizador || !form.id_representante) { notify('Seleccione quién autoriza y el responsable de laboratorio.', 'warning', 3000); return null; }
        if (!form.id_tipo_muestra) { notify('Seleccione el tipo de muestra.', 'warning', 3000); return null; }
        if (tipoSeleccionado?.requiere_detalle && !form.detalle_tipo.trim()) { notify('Especifique el tipo de muestra.', 'warning', 3000); return null; }
        if (!(Number(form.sacos) > 0)) { notify('Indique el N° de sacos.', 'warning', 3000); return null; }
        if (form.muestras.length === 0) { notify('Agregue al menos una muestra.', 'warning', 3000); return null; }
        for (const m of form.muestras) {
            if (!m.codigo.trim()) { notify('Todas las muestras requieren código.', 'warning', 3000); return null; }
            if (!(Number(m.cantidad) > 0)) { notify('La cantidad de cada muestra debe ser mayor a 0.', 'warning', 3000); return null; }
            if (m.analisis.length === 0) { notify(`Seleccione al menos un análisis para ${m.codigo}.`, 'warning', 3000); return null; }
        }
        const cuerpo: CuerpoSolicitud = {
            clave,
            id_empresa: Number(form.id_empresa),
            fecha: form.fecha,
            guardia: form.guardia,
            id_tipo_muestra: Number(form.id_tipo_muestra),
            indicaciones: form.indicaciones.trim(),
            sacos: Number(form.sacos),
            firma_secuencial: true,
            requiere_firma: form.requiere_firma,
            muestras: form.muestras.map((m) => ({ codigo: m.codigo.trim(), cantidad: Number(m.cantidad), analisis_ids: m.analisis, observaciones: m.observaciones.trim() || null })),
            responsables: [
                { id_personal: sesion.idPersonal, rol: ROL_ENVIA },
                { id_personal: Number(form.id_autorizador), rol: ROL_AUTORIZA },
                { id_personal: Number(form.id_representante), rol: ROL_RESPONSABLE_LAB },
            ],
            ...(tipoSeleccionado?.requiere_detalle ? { detalle_tipo_muestra: form.detalle_tipo.trim() } : {}),
        };
        const resp = editando
            ? await labQuimicoApi.actualizar(editando.id, { ...cuerpo, version: editando.version })
            : await labQuimicoApi.crear(cuerpo);
        return asegurarOk(resp, 'No se pudo guardar la solicitud.').data;
    };

    const guardar = async (enviar: boolean) => {
        setGuardando(true);
        let guardada: any = null;
        try {
            guardada = await guardarBorrador();
            if (!guardada) return;
            if (enviar && form?.requiere_firma === false) {
                asegurarOk(await labQuimicoApi.enviarDirecto(guardada.id, guardada.version), 'No se pudo enviar al laboratorio.');
                notify('Solicitud enviada al laboratorio; queda pendiente de recepción.', 'success', 3500);
            } else if (enviar) {
                asegurarOk(await labQuimicoApi.enviarFirma(guardada.id, guardada.version), 'No se pudo enviar a firma electrónica.');
                notify('Solicitud enviada para firma.', 'success', 3000);
            } else {
                notify('Borrador guardado.', 'success', 2500);
            }
            setAbierto(false);
            await cargar(editando ? pagina : 1);
        } catch (e: any) {
            notify(e?.message || 'No se pudo completar la operación.', 'error', 5000);
            // El borrador ya quedó guardado aunque falle el envío: se refresca el listado.
            if (guardada) {
                setAbierto(false);
                await cargar(1);
            }
        } finally {
            setGuardando(false);
        }
    };

    const enviarDesdeLista = async (fila: any) => {
        try {
            const d = asegurarOk(await labQuimicoApi.obtener(fila.id), 'No se pudo cargar la solicitud.').data;
            const directo = d.requiere_firma === false;
            const pregunta = directo
                ? `¿Enviar la solicitud <b>${campo.codigo(fila)}</b> directamente al laboratorio, sin firma electrónica? Ya no podrá editarse.`
                : `¿Enviar la solicitud <b>${campo.codigo(fila)}</b> a firma electrónica? Ya no podrá editarse.`;
            if (!(await confirm(pregunta, directo ? 'Enviar al laboratorio' : 'Enviar para firmar'))) return;
            if (directo) {
                asegurarOk(await labQuimicoApi.enviarDirecto(d.id, d.version), 'No se pudo enviar al laboratorio.');
                notify('Solicitud enviada al laboratorio; queda pendiente de recepción.', 'success', 3500);
            } else {
                asegurarOk(await labQuimicoApi.enviarFirma(d.id, d.version), 'No se pudo enviar a firma electrónica.');
                notify('Solicitud enviada para firma.', 'success', 3000);
            }
            await cargar(pagina);
        } catch (e: any) {
            notify(e?.message || 'No se pudo enviar la solicitud.', 'error', 5000);
        }
    };

    const verPdf = async (fila: any) => {
        try {
            if (codigoEstado(campo.estado(fila)) === 'BORRADOR') return abrirPdf(await labQuimicoApi.pdfSolicitud(fila.id));
            const d = asegurarOk(await labQuimicoApi.obtener(fila.id), 'No se pudo cargar la solicitud.').data;
            abrirPdf(d.url_ultimo_documento ? await descargarPdfBlob(d.url_ultimo_documento) : await labQuimicoApi.pdfSolicitud(fila.id));
        } catch (e: any) {
            notify(e?.message || 'No se pudo abrir el PDF.', 'error', 4000);
        }
    };

    const anular = async () => {
        if (!anulando) return;
        if (!motivoAnulacion.trim()) return notify('Indique el motivo de la anulación.', 'warning', 3000);
        setGuardando(true);
        try {
            const d = asegurarOk(await labQuimicoApi.obtener(anulando.id), 'No se pudo cargar la solicitud.').data;
            asegurarOk(await labQuimicoApi.anular(d.id, { version: d.version, motivo: motivoAnulacion.trim() }), 'No se pudo anular la solicitud.');
            notify('Solicitud anulada.', 'success', 2500);
            setAnulando(null);
            setMotivoAnulacion('');
            await cargar(pagina);
        } catch (e: any) {
            notify(e?.message || 'No se pudo anular la solicitud.', 'error', 4000);
        } finally {
            setGuardando(false);
        }
    };

    const puedeEditar = (f: any) => codigoEstado(campo.estado(f)) === 'BORRADOR' && f.puede_editar !== false;
    const puedeAnular = (f: any) =>
        ['BORRADOR', 'EN_FIRMA', 'PENDIENTE_FIRMA', 'ENVIADA'].includes(codigoEstado(campo.estado(f))) && codigoEstado(campo.recepcion(f)) === 'PENDIENTE' && f.puede_anular !== false;

    const lbl = 'mb-1 block text-xs font-medium text-gray-600';
    const iconoBtn = 'rounded border p-2';
    const numeroSolicitud = editando ? campo.codigo(editando) : 'Automático';
    const empresasOpc = useMemo(() => empresas.map((e) => ({ id: e.id, nombre: e.razonSocial ?? e.nombre })), [empresas]);

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
                <LabHeader
                    titulo="Solicitudes de análisis"
                    acciones={
                        <button type="button" onClick={abrirNueva} className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                            <Plus size={16} /> Nueva solicitud
                        </button>
                    }
                />

                <div className="mb-4 flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <form
                        className="min-w-[220px] flex-1"
                        onSubmit={(e) => {
                            e.preventDefault();
                            cargar(1);
                        }}
                    >
                        <label className={lbl}>Buscar N° o solicitante</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input className={`${inputCls} pl-9`} placeholder="Ej. SA-2026-001, nombre…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                        </div>
                    </form>
                    <div>
                        <label className={lbl}>Empresa</label>
                        <select className={inputCls} value={empresaFiltro} onChange={(e) => setEmpresaFiltro(e.target.value)}>
                            <option value="">Todas</option>
                            {empresasOpc.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={lbl}>Estado</label>
                        <select className={inputCls} value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)}>
                            <option value="">Todos</option>
                            <option value="BORRADOR">Borrador</option>
                            <option value="EN_FIRMA">En firma</option>
                            <option value="FIRMADA">Firmado</option>
                            <option value="ENVIADA">Enviada (sin firma)</option>
                            <option value="ANULADA">Anulada</option>
                        </select>
                    </div>
                    <div>
                        <label className={lbl}>Desde</label>
                        <input type="date" className={inputCls} value={desde} onChange={(e) => setDesde(e.target.value)} />
                    </div>
                    <div>
                        <label className={lbl}>Hasta</label>
                        <input type="date" className={inputCls} value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} />
                    </div>
                    <label className="mb-2 flex items-center gap-2 text-sm text-gray-700">
                        <input type="checkbox" checked={soloMias} onChange={(e) => setSoloMias(e.target.checked)} /> Solo mis solicitudes
                    </label>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 bg-gray-50 text-gray-700">
                                    <th className="px-4 py-3 font-semibold">N°</th>
                                    <th className="px-4 py-3 font-semibold">Fecha</th>
                                    <th className="px-4 py-3 font-semibold">Compañía</th>
                                    <th className="px-4 py-3 font-semibold">Solicitante</th>
                                    <th className="px-4 py-3 text-center font-semibold">Muestras</th>
                                    <th className="px-4 py-3 font-semibold">Firma</th>
                                    <th className="px-4 py-3 font-semibold">Recepción</th>
                                    <th className="px-4 py-3 text-center font-semibold">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cargando && <tr><td colSpan={8} className="py-10 text-center text-gray-400">Cargando…</td></tr>}
                                {!cargando && filas.length === 0 && <tr><td colSpan={8} className="py-10 text-center text-gray-400">Sin solicitudes.</td></tr>}
                                {!cargando &&
                                    filas.map((f) => (
                                        <tr key={f.id} className="border-b border-gray-100 hover:bg-gray-50">
                                            <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-800">{campo.codigo(f)}</td>
                                            <td className="whitespace-nowrap px-4 py-3">{campo.fecha(f)}</td>
                                            <td className="px-4 py-3">{campo.empresa(f)}</td>
                                            <td className="px-4 py-3">{campo.solicitante(f)}</td>
                                            <td className="px-4 py-3 text-center">{campo.muestras(f)}</td>
                                            <td className="px-4 py-3"><EstadoChip valor={campo.estado(f)} /></td>
                                            <td className="px-4 py-3"><RecepcionChip valor={campo.recepcion(f)} /></td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap justify-center gap-2">
                                                    <button type="button" title="Ver solicitud" onClick={() => abrirExistente(f, true)} className={`${iconoBtn} border-blue-300 text-blue-600 hover:bg-blue-50`}><Eye size={16} /></button>
                                                    <button type="button" title="Ver PDF" onClick={() => verPdf(f)} className={`${iconoBtn} border-gray-300 text-gray-600 hover:bg-gray-50`}><FileText size={16} /></button>
                                                    <button type="button" title="Editar" disabled={!puedeEditar(f)} onClick={() => abrirExistente(f, false)} className={`${iconoBtn} border-blue-300 text-blue-600 hover:bg-blue-50 disabled:border-gray-200 disabled:text-gray-300 disabled:hover:bg-transparent`}><Pencil size={16} /></button>
                                                    <button type="button" title="Anular" disabled={!puedeAnular(f)} onClick={() => { setAnulando(f); setMotivoAnulacion(''); }} className={`${iconoBtn} border-red-300 text-red-600 hover:bg-red-50 disabled:border-gray-200 disabled:text-gray-300 disabled:hover:bg-transparent`}><Ban size={16} /></button>
                                                    {codigoEstado(campo.estado(f)) === 'BORRADOR' && (
                                                        <button type="button" onClick={() => enviarDesdeLista(f)} className="flex w-full items-center justify-center gap-2 rounded border border-blue-400 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50">
                                                            <Send size={14} /> {f.requiere_firma === false ? 'Enviar al laboratorio' : 'Enviar para firmar'}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                    <Paginacion pagina={pagina} total={total} tamano={TAM_PAGINA} mostrados={filas.length} onCambiar={cargar} cargando={cargando} etiqueta="solicitudes" />
                </div>
                <p className="mt-3 flex items-center gap-2 text-xs text-gray-500"><Info size={14} /> Editar y anular: solo el creador, según estado.</p>

                {abierto && form && (
                    <Modal
                        ancho="max-w-5xl"
                        titulo={soloLectura ? `Solicitud de análisis · ${numeroSolicitud}` : editando ? `Editar solicitud · ${numeroSolicitud}` : 'Nueva solicitud de análisis'}
                        onClose={() => !guardando && setAbierto(false)}
                        footer={
                            soloLectura ? (
                                <button type="button" className="rounded bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700" onClick={() => setAbierto(false)}>Cerrar</button>
                            ) : (
                                <div className="flex w-full flex-wrap items-center justify-between gap-3">
                                    <span className="flex items-center gap-2 text-xs text-blue-700"><Info size={14} /> {form.requiere_firma ? 'Firma electrónica: revisar PDF y responsables antes de enviar.' : 'Quedará pendiente de recepción.'}</span>
                                    <div className="flex gap-3">
                                        <button type="button" className="rounded border border-gray-300 px-5 py-2 text-sm hover:bg-gray-50" disabled={guardando} onClick={() => setAbierto(false)}>Cancelar</button>
                                        <button type="button" className="rounded border border-blue-500 px-5 py-2 text-sm text-blue-700 hover:bg-blue-50 disabled:opacity-60" disabled={guardando} onClick={() => guardar(false)}>Guardar borrador</button>
                                        <button type="button" className="rounded bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60" disabled={guardando} onClick={() => guardar(true)}>
                                            {guardando ? 'Guardando…' : form.requiere_firma ? 'Guardar y enviar para firmar' : 'Guardar y enviar al laboratorio'}
                                        </button>
                                    </div>
                                </div>
                            )
                        }
                    >
                        <fieldset disabled={soloLectura} className="space-y-6">
                            <section>
                                <h4 className="mb-3 font-semibold text-gray-900">1 · Datos generales</h4>
                                <div className="grid gap-4 sm:grid-cols-4">
                                    <div>
                                        <label className={lbl}>N° de solicitud</label>
                                        <input className={`${inputCls} bg-gray-100`} value={numeroSolicitud} disabled />
                                    </div>
                                    <div>
                                        <label className={lbl}>Compañía <span className="text-red-500">*</span></label>
                                        <select className={inputCls} value={form.id_empresa} onChange={(e) => setForm({ ...form, id_empresa: e.target.value, id_autorizador: '', id_representante: '' })}>
                                            <option value="">Seleccione…</option>
                                            {empresasOpc.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={lbl}>Fecha <span className="text-red-500">*</span></label>
                                        <input type="date" className={inputCls} value={form.fecha} onChange={setCampo('fecha')} />
                                    </div>
                                    <div>
                                        <label className={lbl}>Guardia <span className="text-red-500">*</span></label>
                                        <select className={inputCls} value={form.guardia} onChange={setCampo('guardia')}>
                                            {GUARDIAS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </section>

                            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                                <input type="checkbox" className="mt-1 h-5 w-5" checked={form.requiere_firma} onChange={(e) => setForm({ ...form, requiere_firma: e.target.checked })} />
                                <span>
                                    <span className="block font-semibold text-gray-900">Requiere firma electrónica</span>
                                    <span className="block text-sm text-blue-700">
                                        {form.requiere_firma ? 'Los responsables firmarán antes de recibir las muestras.' : 'Se enviará directamente al laboratorio, sin firma electrónica.'}
                                    </span>
                                </span>
                            </label>

                            <section>
                                <h4 className="mb-3 font-semibold text-gray-900">2 · Responsables</h4>
                                <div className="grid gap-4 sm:grid-cols-3">
                                    <div>
                                        <label className={lbl}>Enviado por <span className="text-red-500">*</span></label>
                                        <input className={`${inputCls} bg-gray-100`} disabled value={editando ? pick(editando, ['enviado_por', 'solicitante', 'remitente']) ?? sesion.nombres : sesion.nombres} />
                                        <p className="mt-1 text-xs text-blue-600">{form.requiere_firma ? 'Firmará este documento' : 'Referencia informativa; no acredita autorización'}</p>
                                    </div>
                                    <div>
                                        <label className={lbl}>Autorizado por <span className="text-red-500">*</span></label>
                                        <select className={inputCls} value={form.id_autorizador} onChange={setCampo('id_autorizador')}>
                                            <option value="">Seleccione…</option>
                                            {personal.map((p) => <option key={p.id} value={p.id}>{nombrePersona(p)}</option>)}
                                        </select>
                                        <p className="mt-1 text-xs text-blue-600">{form.requiere_firma ? 'Firmará este documento' : 'Referencia informativa; no acredita autorización'}</p>
                                    </div>
                                    <div>
                                        <label className={lbl}>Responsable de Laboratorio <span className="text-red-500">*</span></label>
                                        <select className={inputCls} value={form.id_representante} onChange={setCampo('id_representante')}>
                                            <option value="">Seleccione…</option>
                                            {personalLaboratorio.map((p) => <option key={p.id} value={p.id}>{nombrePersona(p)}</option>)}
                                        </select>
                                        <p className="mt-1 text-xs text-blue-600">{form.requiere_firma ? 'Firmará este documento' : 'Referencia informativa; no acredita autorización'}</p>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <h4 className="mb-3 font-semibold text-gray-900">3 · Muestras</h4>
                                <label className={lbl}>Tipo de muestra <span className="text-red-500">*</span></label>
                                {tiposMuestra.length === 0 && <p className="mb-2 text-sm text-red-600">No se pudieron cargar los tipos de muestra. Si el aviso indica sesión inválida, cierre sesión e ingrese de nuevo.</p>}
                                <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                                    {tiposMuestra.map((t) => (
                                        <label key={t.id} className="flex items-center gap-2">
                                            <input type="radio" name="tipo_muestra" checked={form.id_tipo_muestra === String(t.id)} onChange={() => setForm({ ...form, id_tipo_muestra: String(t.id), detalle_tipo: '' })} />
                                            {t.nombre}
                                        </label>
                                    ))}
                                    {tipoSeleccionado?.requiere_detalle && (
                                        <input className={`${inputCls} max-w-[220px]`} placeholder="Especificar…" value={form.detalle_tipo} onChange={setCampo('detalle_tipo')} />
                                    )}
                                </div>
                                <div className="grid gap-4 sm:grid-cols-[1fr_140px_160px]">
                                    <div>
                                        <label className={lbl}>Indicaciones adicionales</label>
                                        <textarea rows={3} className={inputCls} placeholder="Ej. Condiciones de muestreo, origen, prioridad, etc." value={form.indicaciones} onChange={setCampo('indicaciones')} />
                                    </div>
                                    <div>
                                        <label className={lbl}>N° de sacos <span className="text-red-500">*</span></label>
                                        <input type="number" min={1} className={inputCls} value={form.sacos} onChange={setCampo('sacos')} />
                                    </div>
                                    <div>
                                        <label className={lbl}>N° total de muestras <span className="text-red-500">*</span></label>
                                        <input className={`${inputCls} bg-gray-100`} disabled value={totalMuestras} />
                                    </div>
                                </div>
                            </section>

                            <section>
                                <div className="mb-3 flex items-center justify-between">
                                    <h4 className="font-semibold text-gray-900">4 · Detalle de análisis solicitado</h4>
                                    {!soloLectura && (
                                        <button type="button" onClick={() => setForm({ ...form, muestras: [...form.muestras, muestraVacia()] })} className="flex items-center gap-2 rounded border border-blue-500 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-50">
                                            <Plus size={14} /> Agregar muestra
                                        </button>
                                    )}
                                </div>
                                <div className="overflow-x-auto rounded-lg border border-gray-200">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-gray-50 text-xs text-gray-600">
                                                <th className="w-20 px-2 py-2 text-left font-medium">Cant.</th>
                                                <th className="w-36 px-2 py-2 text-left font-medium">Código de muestra</th>
                                                {tiposAnalisis.map((a) => <th key={a.id} className="px-2 py-2 text-center font-medium" title={a.nombre}>{a.codigo}</th>)}
                                                <th className="min-w-[140px] px-2 py-2 text-left font-medium">Observaciones</th>
                                                {!soloLectura && <th className="w-10" />}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {form.muestras.map((m, i) => (
                                                <tr key={i} className="border-t border-gray-100">
                                                    <td className="px-2 py-1.5"><input type="number" min={1} className={inputCls} value={m.cantidad} onChange={(e) => setMuestra(i, { cantidad: e.target.value })} /></td>
                                                    <td className="px-2 py-1.5"><input className={inputCls} value={m.codigo} onChange={(e) => setMuestra(i, { codigo: e.target.value })} /></td>
                                                    {tiposAnalisis.map((a) => (
                                                        <td key={a.id} className="px-2 py-1.5 text-center">
                                                            <input type="checkbox" checked={m.analisis.includes(a.id)} onChange={() => alternarAnalisis(i, a.id)} />
                                                        </td>
                                                    ))}
                                                    <td className="px-2 py-1.5"><input className={inputCls} value={m.observaciones} onChange={(e) => setMuestra(i, { observaciones: e.target.value })} /></td>
                                                    {!soloLectura && (
                                                        <td className="px-2 py-1.5">
                                                            <button type="button" title="Quitar muestra" disabled={form.muestras.length === 1} onClick={() => setForm({ ...form, muestras: form.muestras.filter((_, j) => j !== i) })} className="rounded p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-30"><Trash2 size={16} /></button>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </section>

                            <section>
                                <h4 className="mb-3 font-semibold text-gray-900">5 · Recepción de muestras</h4>
                                <div className="flex items-center gap-2 rounded border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                                    <Info size={16} /> Se completa al recibir las muestras.
                                </div>
                            </section>
                        </fieldset>
                    </Modal>
                )}

                {anulando && (
                    <Modal
                        titulo="Anular solicitud"
                        subtitulo={`${campo.codigo(anulando)} · ${campo.solicitante(anulando)}`}
                        onClose={() => !guardando && setAnulando(null)}
                        footer={
                            <>
                                <button type="button" className="rounded border border-gray-300 px-5 py-2 text-sm hover:bg-gray-50" disabled={guardando} onClick={() => setAnulando(null)}>Cancelar</button>
                                <button type="button" className="rounded bg-red-600 px-5 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-60" disabled={guardando} onClick={anular}>{guardando ? 'Anulando…' : 'Anular solicitud'}</button>
                            </>
                        }
                    >
                        <label className={lbl}>Motivo de la anulación <span className="text-red-500">*</span></label>
                        <textarea rows={3} className={inputCls} value={motivoAnulacion} onChange={(e) => setMotivoAnulacion(e.target.value)} />
                    </Modal>
                )}
            </div>
        </div>
    );
};

export default SolicitudMuestra;
