import React, { useCallback, useEffect, useMemo, useState } from 'react';
import notify from 'devextreme/ui/notify';
import { confirm } from 'devextreme/ui/dialog';
import { QRCodeSVG } from 'qrcode.react';
import { Pencil, Plus, Power, QrCode, Save, Search, Users } from 'lucide-react';
import { ComedorHeader, EstadoBadge, Modal, inputCls } from '../../components/Comedor/ComedorShared';
import { estaActivo, formatearFechaHora, hoyLima, nombreCompleto, pick, soloFecha, usuarioActual } from '../../components/Comedor/comedorUtils';
import { asegurarOk, comedorApi } from '../../services/comedor/comedorApi';

const TAM_PAGINA = 10;

// TODO(CONFIRMAR CON BACKEND): valores aceptados por `tipo_documento` (la colección Postman solo lo envía como null).
const TIPOS_DOCUMENTO = [
    { value: 'DNI', label: 'DNI' },
    { value: 'CE', label: 'Carnet de extranjería' },
    { value: 'PASAPORTE', label: 'Pasaporte' },
];

interface FormInvitado {
    nombres: string;
    ape_pat: string;
    ape_mat: string;
    tipo_documento: string;
    numero_documento: string;
    empresa_referencia: string;
    vigente_desde: string;
    vigente_hasta: string;
}

const formVacio = (): FormInvitado => ({
    nombres: '',
    ape_pat: '',
    ape_mat: '',
    tipo_documento: '',
    numero_documento: '',
    empresa_referencia: '',
    vigente_desde: hoyLima(),
    vigente_hasta: hoyLima(),
});

const Invitados: React.FC = () => {
    const [filas, setFilas] = useState<any[]>([]);
    const [cargando, setCargando] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [estado, setEstado] = useState<'todos' | '1' | '0'>('todos');
    const [pagina, setPagina] = useState(1);

    const [abierto, setAbierto] = useState(false);
    const [editando, setEditando] = useState<any | null>(null);
    const [form, setForm] = useState<FormInvitado>(formVacio());
    const [guardando, setGuardando] = useState(false);
    const [qrDe, setQrDe] = useState<any | null>(null);

    const cargar = useCallback(async () => {
        setCargando(true);
        try {
            const resp = asegurarOk(await comedorApi.invitados.listar(estado === 'todos' ? 'todos' : (Number(estado) as 0 | 1)), 'No se pudo cargar los invitados.');
            setFilas(Array.isArray(resp.data) ? resp.data : []);
        } catch (e: any) {
            notify(e?.message || 'No se pudo cargar los invitados.', 'error', 3500);
            setFilas([]);
        } finally {
            setCargando(false);
        }
    }, [estado]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const filtradas = useMemo(() => {
        const q = busqueda.trim().toLowerCase();
        if (!q) return filas;
        return filas.filter((f) => `${nombreCompleto(f)} ${f.empresa_referencia ?? ''} ${f.numero_documento ?? ''}`.toLowerCase().includes(q));
    }, [filas, busqueda]);

    useEffect(() => setPagina(1), [busqueda, estado]);
    const totalPaginas = Math.max(1, Math.ceil(filtradas.length / TAM_PAGINA));
    const visibles = filtradas.slice((pagina - 1) * TAM_PAGINA, pagina * TAM_PAGINA);

    const abrirNuevo = () => {
        setEditando(null);
        setForm(formVacio());
        setAbierto(true);
    };

    const abrirEditar = (f: any) => {
        setEditando(f);
        setForm({
            nombres: f.nombres ?? '',
            ape_pat: f.ape_pat ?? '',
            ape_mat: f.ape_mat ?? '',
            tipo_documento: f.tipo_documento ?? '',
            numero_documento: f.numero_documento ?? '',
            empresa_referencia: f.empresa_referencia ?? '',
            vigente_desde: soloFecha(f.vigente_desde) || hoyLima(),
            vigente_hasta: soloFecha(f.vigente_hasta) || hoyLima(),
        });
        setAbierto(true);
    };

    const guardar = async () => {
        if (!form.nombres.trim() || !form.ape_pat.trim() || !form.empresa_referencia.trim()) {
            return notify('Complete nombres, apellido paterno y empresa.', 'warning', 3000);
        }
        const numDoc = form.numero_documento.trim();
        if (form.tipo_documento && !numDoc) return notify('Ingrese el número de documento.', 'warning', 3000);
        if (numDoc && !form.tipo_documento) return notify('Seleccione el tipo de documento.', 'warning', 3000);
        if (form.tipo_documento === 'DNI' && !/^\d{8}$/.test(numDoc)) return notify('El DNI debe tener 8 dígitos.', 'warning', 3000);
        if (!form.vigente_desde || !form.vigente_hasta || form.vigente_desde > form.vigente_hasta) {
            return notify('La vigencia es inválida: "desde" no puede ser posterior a "hasta".', 'warning', 3500);
        }
        setGuardando(true);
        try {
            const cuerpo = {
                nombres: form.nombres.trim().toUpperCase(),
                ape_pat: form.ape_pat.trim().toUpperCase(),
                ape_mat: form.ape_mat.trim().toUpperCase() || null,
                tipo_documento: form.tipo_documento || null,
                numero_documento: numDoc ? numDoc.toUpperCase() : null,
                empresa_referencia: form.empresa_referencia.trim().toUpperCase(),
                vigente_desde: form.vigente_desde,
                vigente_hasta: form.vigente_hasta,
                usuario: usuarioActual(),
            };
            if (editando) {
                asegurarOk(await comedorApi.invitados.actualizar(editando.id, { ...cuerpo, version: editando.version }), 'No se pudo actualizar el invitado.');
            } else {
                asegurarOk(await comedorApi.invitados.crear(cuerpo), 'No se pudo crear el invitado.');
            }
            notify('Invitado guardado correctamente.', 'success', 2500);
            setAbierto(false);
            await cargar();
        } catch (e: any) {
            notify(e?.message || 'No se pudo guardar el invitado.', 'error', 4000);
        } finally {
            setGuardando(false);
        }
    };

    const alternarEstado = async (f: any) => {
        const activo = estaActivo(f);
        const ok = await confirm(`¿${activo ? 'Desactivar' : 'Activar'} a <b>${nombreCompleto(f)}</b>?`, activo ? 'Desactivar invitado' : 'Activar invitado');
        if (!ok) return;
        try {
            asegurarOk(
                await comedorApi.invitados.cambiarEstado(f.id, { estado: activo ? 0 : 1, version: f.version, usuario: usuarioActual() }),
                'No se pudo cambiar el estado.'
            );
            await cargar();
        } catch (e: any) {
            notify(e?.message || 'No se pudo cambiar el estado.', 'error', 4000);
        }
    };

    const set = (k: keyof FormInvitado) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
                <ComedorHeader
                    icono={<Users size={28} />}
                    subtitulo="Gestión de Invitados"
                    descripcion="Registre y administre los invitados temporales al comedor."
                    onAyuda={() => notify('Cada invitado tiene un QR y una vigencia. Fuera de la vigencia o inactivo, no podrá registrar consumos.', 'info', 5000)}
                    acciones={
                        <button type="button" onClick={abrirNuevo} className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                            <Plus size={16} /> Agregar Invitado
                        </button>
                    }
                />

                <div className="mb-4 flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="relative min-w-[240px] flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input className={`${inputCls} pl-9`} placeholder="Buscar por nombre, documento o empresa..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs text-gray-500">Estado</label>
                        <select className={inputCls} value={estado} onChange={(e) => setEstado(e.target.value as any)}>
                            <option value="todos">Todos</option>
                            <option value="1">Activos</option>
                            <option value="0">Inactivos</option>
                        </select>
                    </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 bg-gray-50 text-gray-700">
                                    <th className="px-4 py-3 font-semibold">N°</th>
                                    <th className="px-4 py-3 font-semibold">Nombres y Apellidos</th>
                                    <th className="px-4 py-3 font-semibold">Documento</th>
                                    <th className="px-4 py-3 font-semibold">Empresa</th>
                                    <th className="px-4 py-3 font-semibold">Vigencia</th>
                                    <th className="px-4 py-3 font-semibold">Fecha de Registro</th>
                                    <th className="px-4 py-3 text-center font-semibold">Estado</th>
                                    <th className="px-4 py-3 text-center font-semibold">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cargando && <tr><td colSpan={8} className="py-10 text-center text-gray-400">Cargando…</td></tr>}
                                {!cargando && visibles.length === 0 && <tr><td colSpan={8} className="py-10 text-center text-gray-400">Sin invitados.</td></tr>}
                                {!cargando &&
                                    visibles.map((f, i) => {
                                        const activo = estaActivo(f);
                                        return (
                                            <tr key={f.id} className="border-b border-gray-100 hover:bg-gray-50">
                                                <td className="px-4 py-3 text-gray-500">{(pagina - 1) * TAM_PAGINA + i + 1}</td>
                                                <td className="px-4 py-3 uppercase text-gray-900">{nombreCompleto(f)}</td>
                                                <td className="whitespace-nowrap px-4 py-3">
                                                    {f.numero_documento ? `${f.tipo_documento ?? ''} ${f.numero_documento}`.trim() : '—'}
                                                </td>
                                                <td className="px-4 py-3 uppercase">{f.empresa_referencia || '—'}</td>
                                                <td className="whitespace-nowrap px-4 py-3">
                                                    {soloFecha(f.vigente_desde) || '—'} → {soloFecha(f.vigente_hasta) || '—'}
                                                </td>
                                                <td className="whitespace-nowrap px-4 py-3">
                                                    {formatearFechaHora(pick(f, ['fecha_registro', 'fecha_creacion', 'created_at']))}
                                                </td>
                                                <td className="px-4 py-3 text-center"><EstadoBadge activo={activo} /></td>
                                                <td className="px-4 py-3">
                                                    <div className="flex justify-center gap-2">
                                                        <button type="button" title="Ver QR" disabled={!f.codigo_qr} onClick={() => setQrDe(f)} className="rounded border border-gray-300 p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                                                            <QrCode size={16} />
                                                        </button>
                                                        <button type="button" title="Editar" onClick={() => abrirEditar(f)} className="rounded border border-blue-300 p-2 text-blue-600 hover:bg-blue-50">
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
                </div>

                {abierto && (
                    <Modal
                        titulo={editando ? 'Editar Invitado' : 'Agregar Invitado'}
                        subtitulo="Ingrese la información del invitado temporal."
                        onClose={() => !guardando && setAbierto(false)}
                        footer={
                            <>
                                <button type="button" className="rounded border border-gray-300 px-5 py-2 text-sm hover:bg-gray-50" onClick={() => setAbierto(false)} disabled={guardando}>Cancelar</button>
                                <button type="button" className="flex items-center gap-2 rounded bg-blue-600 px-5 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60" onClick={guardar} disabled={guardando}>
                                    <Save size={16} /> {guardando ? 'Guardando…' : 'Guardar'}
                                </button>
                            </>
                        }
                    >
                        <div className="space-y-4">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">Nombres <span className="text-red-500">*</span></label>
                                <input className={inputCls} placeholder="Ej. Juan Carlos" value={form.nombres} onChange={set('nombres')} />
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-gray-700">Apellido Paterno <span className="text-red-500">*</span></label>
                                    <input className={inputCls} placeholder="Ej. García" value={form.ape_pat} onChange={set('ape_pat')} />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-gray-700">Apellido Materno</label>
                                    <input className={inputCls} placeholder="Ej. Torres" value={form.ape_mat} onChange={set('ape_mat')} />
                                </div>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-gray-700">Tipo de documento</label>
                                    <select
                                        className={inputCls}
                                        value={form.tipo_documento}
                                        onChange={(e) => setForm({ ...form, tipo_documento: e.target.value, numero_documento: e.target.value ? form.numero_documento : '' })}
                                    >
                                        <option value="">Sin documento</option>
                                        {TIPOS_DOCUMENTO.map((t) => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-gray-700">N° de documento</label>
                                    <input
                                        className={inputCls}
                                        placeholder={form.tipo_documento === 'DNI' ? '8 dígitos' : 'Ej. 12345678'}
                                        maxLength={form.tipo_documento === 'DNI' ? 8 : 20}
                                        disabled={!form.tipo_documento}
                                        value={form.numero_documento}
                                        onChange={set('numero_documento')}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">Empresa <span className="text-red-500">*</span></label>
                                <input className={inputCls} placeholder="Ej. Visita Proveedor / Contratista / Otro" value={form.empresa_referencia} onChange={set('empresa_referencia')} />
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-gray-700">Vigente desde <span className="text-red-500">*</span></label>
                                    <input type="date" className={inputCls} value={form.vigente_desde} onChange={set('vigente_desde')} />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-gray-700">Vigente hasta <span className="text-red-500">*</span></label>
                                    <input type="date" className={inputCls} value={form.vigente_hasta} min={form.vigente_desde} onChange={set('vigente_hasta')} />
                                </div>
                            </div>
                        </div>
                    </Modal>
                )}

                {qrDe && (
                    <Modal titulo="Código QR del invitado" subtitulo={nombreCompleto(qrDe)} onClose={() => setQrDe(null)}>
                        <div className="flex flex-col items-center gap-3">
                            <QRCodeSVG value={String(qrDe.codigo_qr)} size={220} level="H" />
                            <p className="break-all text-center text-xs text-gray-500">{qrDe.codigo_qr}</p>
                        </div>
                    </Modal>
                )}
            </div>
        </div>
    );
};

export default Invitados;
