import React, { useCallback, useEffect, useState } from 'react';
import notify from 'devextreme/ui/notify';
import { ChevronDown, Database, Monitor, Puzzle } from 'lucide-react';
import {
    Aviso, BalanzaHeader, Campo, Estacion, PesoEnVivo, Tarjeta, aEstacion, filasDe, guardarEstacionLocal, inputCls,
    leerEstacionLocal, mensajeError, soloLectura, useTrade, useTradeConexion, EstadoTrade, kg,
} from '../../components/Balanza/balanzaShared';
import { balanzaApi, asegurarOk, nuevoIdSolicitud } from '../../services/balanza/balanzaApi';
import { leerExtensionLocal } from '../../services/balanza/tradeBridge';

const NUEVA = 'nueva';

interface Form {
    codigo: string;
    nombre: string;
    sede: string;
    activa: boolean;
    extensionId: string;
    sesion: number;
}
// El ID de la extensión de este navegador (el último que conectó) se propone en estaciones nuevas.
const formVacio = (): Form => ({ codigo: '', nombre: '', sede: '', activa: true, extensionId: leerExtensionLocal(), sesion: 0 });
const aForm = (e: Estacion): Form => ({ codigo: e.codigo, nombre: e.nombre, sede: e.sede, activa: e.activa, extensionId: e.extensionId, sesion: e.sesion });

const ConfigBalanza: React.FC = () => {
    const [estaciones, setEstaciones] = useState<Estacion[]>([]);
    const [seleccion, setSeleccion] = useState<string>(NUEVA);
    const [form, setForm] = useState<Form>(formVacio);
    const [asignar, setAsignar] = useState(true);
    const [verCampos, setVerCampos] = useState(false);
    const [ocupado, setOcupado] = useState(false);
    const [conectado, alternarTrade] = useTradeConexion({ extensionId: form.extensionId, sesion: form.sesion });
    const { lectura, cruda } = useTrade();

    const actual = estaciones.find((e) => String(e.id) === seleccion) ?? null;
    const nueva = seleccion === NUEVA;

    const cargar = useCallback(async (preferida?: string) => {
        try {
            const lista = filasDe(await balanzaApi.estaciones.listar()).map(aEstacion);
            setEstaciones(lista);
            const id = preferida ?? leerEstacionLocal();
            const elegida = lista.find((e) => String(e.id) === id) ?? lista[0];
            if (elegida) {
                setSeleccion(String(elegida.id));
                setForm(aForm(elegida));
            }
        } catch (e) {
            notify(mensajeError(e, 'No se pudo cargar las estaciones.'), 'error', 3500);
        }
    }, []);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const elegir = (id: string) => {
        setSeleccion(id);
        const e = estaciones.find((x) => String(x.id) === id);
        setForm(e ? aForm(e) : formVacio());
    };
    const cambiar = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }));

    const sinGuardar = !!actual && JSON.stringify(form) !== JSON.stringify(aForm(actual));
    const formValido = form.codigo.trim() && form.nombre.trim() && form.sede.trim() && form.extensionId.trim();

    const ejecutar = async (fn: () => Promise<void>, errorDefecto: string) => {
        setOcupado(true);
        try {
            await fn();
        } catch (e) {
            notify(mensajeError(e, errorDefecto), 'error', 4000);
        } finally {
            setOcupado(false);
        }
    };

    const guardar = () =>
        ejecutar(async () => {
            if (!formValido) return notify('Complete código, nombre, sede e ID de la extensión.', 'warning', 3000);
            const cuerpo = {
                codigo: form.codigo.trim(),
                nombre: form.nombre.trim(),
                sede: form.sede.trim(),
                activa: form.activa,
                prueba: false,
                extension_id: form.extensionId.trim(),
                sesion: form.sesion,
                capacidad_kg: 100000,
            };
            const r = actual
                ? await balanzaApi.estaciones.actualizar(actual.id, { ...cuerpo, version: actual.version })
                : await balanzaApi.estaciones.crear(cuerpo);
            asegurarOk(r, 'No se pudo guardar la estación.');
            const id = String(r?.data?.id ?? actual?.id ?? '');
            if (asignar && id) guardarEstacionLocal(id);
            await cargar(id);
            notify('Estación guardada. Falta validar la lectura de TRADE.', 'success', 3500);
        }, 'No se pudo guardar la estación.');

    // Una lectura real y estable de TRADE valida la configuración de la estación.
    const probar = () =>
        ejecutar(async () => {
            if (!actual) return;
            if (!conectado || lectura.peso == null) return notify('Conecte con TRADE para tomar la lectura de prueba.', 'warning', 3500);
            if (!lectura.estable) return notify('El peso no es estable. Espere la estabilización.', 'warning', 3000);
            if (lectura.peso <= 0) return notify('Coloque un peso en la balanza: la lectura de prueba debe ser mayor a 0 kg.', 'warning', 4000);
            // Se indica en qué paso falló, porque el backend a veces solo dice "revise campos".
            const paso = async <T,>(nombre: string, fn: () => Promise<T>): Promise<T> => {
                try {
                    return await fn();
                } catch (e) {
                    throw new Error(`${nombre}: ${mensajeError(e, 'error desconocido')}`);
                }
            };
            const cap = await paso('Registro de la lectura', async () =>
                asegurarOk(
                    await balanzaApi.capturar({
                        id_lectura: nuevoIdSolicitud(),
                        id_estacion: actual.id,
                        version_estacion: actual.version,
                        peso_kg: lectura.peso as number,
                        unidad: 'kg',
                        estable: true,
                        leido_en: new Date().toISOString(),
                        sesion: actual.sesion,
                        origen: 'TRADE',
                    }),
                    'No se pudo registrar la lectura de prueba.',
                ),
            );
            await paso('Validación de la estación', async () =>
                asegurarOk(await balanzaApi.estaciones.validar(actual.id, cap?.data?.id_captura, actual.version), 'No se pudo validar la estación.'),
            );
            await cargar(String(actual.id));
            notify('Conexión con TRADE verificada y estación validada.', 'success', 3500);
        }, 'No se pudo probar la conexión.');

    const validada = !!actual?.validada && !sinGuardar;
    const verif = validada ? 'Verificado' : 'Sin verificar';

    return (
        <>
            <BalanzaHeader
                migas={['Comercialización', 'Configuración de balanza']}
                titulo="Configuración de balanza"
                descripcion="Administra la estación y verifica la conexión con TRADE en esta PC."
                acciones={<span className="rounded-lg bg-green-50 px-3 py-1.5 text-sm text-green-700">🔒 Acceso autorizado</span>}
            />

            <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
                <div className="space-y-5">
                    <Tarjeta titulo="Estación de trabajo">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="md:col-span-2">
                                <Campo label="Estación">
                                    <select className={inputCls} value={seleccion} onChange={(e) => elegir(e.target.value)}>
                                        {estaciones.map((e) => <option key={String(e.id)} value={String(e.id)}>{e.nombre}</option>)}
                                        <option value={NUEVA}>+ Nueva estación</option>
                                    </select>
                                </Campo>
                            </div>
                            {nueva && <div className="md:col-span-2"><Campo label="Nombre" requerido><input className={inputCls} value={form.nombre} onChange={(e) => cambiar({ nombre: e.target.value })} /></Campo></div>}
                            <Campo label="Código" requerido><input className={nueva ? inputCls : soloLectura} value={form.codigo} readOnly={!nueva} onChange={(e) => cambiar({ codigo: e.target.value })} /></Campo>
                            <Campo label="Sede" requerido><input className={inputCls} value={form.sede} onChange={(e) => cambiar({ sede: e.target.value })} /></Campo>
                            <label className="flex items-center gap-3 text-sm font-medium text-gray-700">
                                Activa
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={form.activa}
                                    onClick={() => cambiar({ activa: !form.activa })}
                                    className={`relative h-6 w-11 rounded-full transition ${form.activa ? 'bg-blue-600' : 'bg-gray-300'}`}
                                >
                                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${form.activa ? 'left-[22px]' : 'left-0.5'}`} />
                                </button>
                            </label>
                        </div>
                    </Tarjeta>

                    <Tarjeta titulo="Conexión con TRADE">
                        <div className="space-y-4">
                            <Campo label="ID de la extensión PDN" requerido ayuda="Debe coincidir con el ID autorizado por el puente local.">
                                <input className={inputCls} placeholder="ID de la extensión instalada" value={form.extensionId} onChange={(e) => cambiar({ extensionId: e.target.value })} />
                            </Campo>
                            <Campo label="Sesión de TRADE">
                                <select className={inputCls} value={form.sesion} onChange={(e) => cambiar({ sesion: Number(e.target.value) })}>
                                    {[0, 1].map((s) => <option key={s} value={s}>TRADE · Sesión {s}</option>)}
                                </select>
                            </Campo>
                            <div className="grid items-center gap-3 md:grid-cols-[auto_1fr]">
                                <span className="text-sm font-medium text-gray-700">Origen de lectura</span>
                                <input className={soloLectura} value="TRADE en esta PC" readOnly />
                            </div>
                            <label className="flex items-center gap-2 text-sm text-gray-700">
                                <input type="checkbox" checked={asignar} onChange={(e) => setAsignar(e.target.checked)} className="h-4 w-4 accent-blue-600" />
                                Asignar esta estación a este navegador
                            </label>
                            <div>
                                <button type="button" disabled={!actual || sinGuardar || ocupado} onClick={probar} className="rounded border border-blue-600 bg-white px-5 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400">
                                    Probar conexión
                                </button>
                                <p className="mt-1 text-xs text-gray-500">
                                    {!actual ? 'Guarda la estación para probar la conexión.' : sinGuardar ? 'Guarda los cambios para probar la conexión.' : 'Toma una lectura estable de TRADE y valida la estación.'}
                                </p>
                            </div>
                        </div>
                    </Tarjeta>
                </div>

                <div className="space-y-5">
                    <Tarjeta titulo="Verificación en esta PC">
                        <ul className="divide-y divide-gray-100">
                            {[
                                // Extensión y puente responden al ping; TRADE, cuando entrega un peso.
                                { t: 'Extensión de Chrome', i: <Puzzle size={20} />, ok: conectado },
                                { t: 'Puente local', i: <Monitor size={20} />, ok: conectado },
                                { t: 'Software TRADE', i: <Database size={20} />, ok: conectado && lectura.peso != null },
                            ].map((x) => (
                                <li key={x.t} className="flex items-center justify-between py-3 text-sm">
                                    <span className="flex items-center gap-3 text-gray-800">{x.i} {x.t}</span>
                                    <span className={`rounded px-2.5 py-1 text-xs ${x.ok ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{x.ok ? 'Verificado' : 'Sin verificar'}</span>
                                </li>
                            ))}
                        </ul>
                        <div className="mt-3 flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Lectura de prueba</p>
                            <div className="flex items-center gap-2">
                                <EstadoTrade conectado={conectado} />
                                <button type="button" onClick={alternarTrade} className="rounded border border-blue-600 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50">
                                    {conectado ? 'Desconectar' : 'Conectar'}
                                </button>
                            </div>
                        </div>
                        <div className="mt-2">
                            <PesoEnVivo />
                        </div>
                        <p className="mt-2 text-sm text-gray-700">
                            Estabilidad: {conectado && lectura.peso != null ? `${lectura.estable ? 'Estable' : 'Inestable'} (${kg(lectura.peso)})` : 'Sin verificar'}
                        </p>
                        <Aviso>Instala la extensión y el puente en la computadora donde funciona TRADE.</Aviso>
                        {cruda != null && (
                            <details className="mt-3 text-xs text-gray-600">
                                <summary className="cursor-pointer">Respuesta cruda del puente</summary>
                                <pre className="mt-1 overflow-x-auto rounded bg-gray-100 p-2">{JSON.stringify(cruda, null, 2)}</pre>
                            </details>
                        )}
                    </Tarjeta>

                    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                        <button type="button" onClick={() => setVerCampos((v) => !v)} className="flex w-full items-center justify-between text-left">
                            <span className="text-lg font-bold text-[#0a1f5c]">Validación de campos de TRADE</span>
                            <ChevronDown size={18} className={`transition ${verCampos ? 'rotate-180' : ''}`} />
                        </button>
                        <p className="mt-1 text-sm text-gray-600">Confirmar peso, unidad y estabilidad antes de habilitar capturas.</p>
                        {verCampos && (
                            <ul className="mt-3 space-y-1 text-sm text-gray-700">
                                {['Peso', 'Unidad', 'Estabilidad'].map((c) => (
                                    <li key={c} className="flex justify-between rounded bg-gray-50 px-3 py-2"><span>{c}</span><span className="text-gray-500">{verif}</span></li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <div className="flex flex-wrap justify-end gap-3">
                        <button type="button" onClick={() => cargar(seleccion === NUEVA ? undefined : seleccion)} className="rounded border border-blue-600 bg-white px-6 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50">Cancelar</button>
                        <button type="button" disabled={ocupado || !formValido || (!nueva && !sinGuardar)} onClick={guardar} className="rounded bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400">
                            {ocupado ? 'Procesando…' : 'Guardar configuración'}
                        </button>
                    </div>
                    <p className="text-right text-xs text-gray-500">Guardar invalida la validación anterior: vuelve a probar la conexión.</p>
                </div>
            </div>
        </>
    );
};

export default ConfigBalanza;
