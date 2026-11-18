import React, { useEffect, useState } from 'react';
import notify from 'devextreme/ui/notify';
import { Scale } from 'lucide-react';
import {
    Aviso, BalanzaHeader, Campo, EstadoTrade, LecturaTrade, Opcion, PesoEnVivo, TIPOS_PRIMERA, Tarjeta, aOpcion, filasDe,
    inputCls, kg, mensajeError, useLecturaTrade,
} from './balanzaShared';
import NuevoCatalogoModal from './NuevoCatalogoModal';
import { balanzaApi, nuevoIdSolicitud } from '../../services/balanza/balanzaApi';
import { hoyLima } from '../Comedor/comedorUtils';

export interface Captura {
    idCaptura: string;
    peso: number;
    fecha: string;
}

interface Props {
    estacion: string;
    traderConectado: boolean;
    onToggleTrade: () => void;
    /** Registra la lectura en la API (POST /capturas); devuelve null si no se pudo. */
    onCapturar: (l: LecturaTrade) => Promise<Captura | null>;
    onVolver: () => void;
    onGuardado: (ticket: string) => void;
}

const NuevoPesaje: React.FC<Props> = ({ estacion, traderConectado, onToggleTrade, onCapturar, onVolver, onGuardado }) => {
    const [operaciones, setOperaciones] = useState<Opcion[]>([]);
    const [vehiculos, setVehiculos] = useState<Opcion[]>([]);
    const [conductores, setConductores] = useState<Opcion[]>([]);
    const [transportistas, setTransportistas] = useState<Opcion[]>([]);

    const [operacion, setOperacion] = useState('');
    const [vehiculo, setVehiculo] = useState('');
    const [conductor, setConductor] = useState('');
    const [transportista, setTransportista] = useState('');
    const [observaciones, setObservaciones] = useState('');
    const [tipoPrimera, setTipoPrimera] = useState(TIPOS_PRIMERA[0].valor);
    const [captura, setCaptura] = useState<Captura | null>(null);
    const [guardando, setGuardando] = useState(false);
    // Un UUID por intento: reintentar el mismo guardado no duplica el pesaje.
    const [idSolicitud] = useState(nuevoIdSolicitud);

    useEffect(() => {
        const cargar = async (p: Promise<any>, set: (o: Opcion[]) => void) => {
            try {
                set(filasDe(await p).map(aOpcion));
            } catch (e) {
                notify(mensajeError(e, 'No se pudo cargar un catálogo.'), 'error', 3500);
            }
        };
        cargar(balanzaApi.operaciones(), (o) => {
            setOperaciones(o);
            setOperacion((v) => v || String(o[0]?.codigo ?? ''));
        });
        cargar(balanzaApi.catalogo.listar('VEHICULO'), setVehiculos);
        cargar(balanzaApi.catalogo.listar('CONDUCTOR'), setConductores);
        cargar(balanzaApi.transportistas(), setTransportistas);
    }, []);

    const lectura = useLecturaTrade();

    const [nuevo, setNuevo] = useState<'VEHICULO' | 'CONDUCTOR' | null>(null);
    // Recarga el catálogo y deja seleccionado el registro recién creado (por id, o por código si la API no lo devuelve).
    const alCrear = async (r: { id?: number | string; codigo: string }) => {
        const tipo = nuevo!;
        setNuevo(null);
        try {
            const lista = filasDe(await balanzaApi.catalogo.listar(tipo)).map(aOpcion);
            const creado = lista.find((o) => (r.id != null && String(o.id) === String(r.id)) || o.codigo.toUpperCase() === r.codigo);
            (tipo === 'VEHICULO' ? setVehiculos : setConductores)(lista);
            if (creado) (tipo === 'VEHICULO' ? setVehiculo : setConductor)(String(creado.id));
        } catch (e) {
            notify(mensajeError(e, 'Se creó el registro, pero no se pudo recargar el catálogo.'), 'warning', 4000);
        }
    };

    const capturar = async () => {
        const c = await onCapturar(lectura);
        if (c) setCaptura(c);
    };

    const guardar = async () => {
        if (!operacion || !vehiculo || !conductor || !transportista) return notify('Complete operación, placa, conductor y transportista.', 'warning', 3000);
        if (!captura) return notify('Capture la primera pesada para guardar.', 'warning', 3000);
        setGuardando(true);
        try {
            const r = await balanzaApi.pesajes.crear({
                id_solicitud: idSolicitud,
                id_captura: captura.idCaptura,
                operacion,
                tipo_primera: tipoPrimera,
                fecha_operativa: hoyLima(),
                id_vehiculo: vehiculo,
                id_conductor: conductor,
                id_transportista: transportista,
                observaciones: observaciones.trim() || undefined,
            });
            if (r?.code !== undefined && (r.code < 200 || r.code >= 300)) throw new Error(r.message || 'No se pudo guardar el pesaje.');
            onGuardado(String(r?.data?.ticket ?? r?.data?.numero_ticket ?? ''));
        } catch (e) {
            notify(mensajeError(e, 'No se pudo guardar el pesaje.'), 'error', 4000);
        } finally {
            setGuardando(false);
        }
    };

    return (
        <>
            <BalanzaHeader
                migas={['Comercialización', 'Balanza', 'Nuevo pesaje']}
                volver={{ texto: 'Volver a pesajes', onClick: onVolver }}
                titulo="Nuevo pesaje"
                descripcion="Registra el ingreso y captura la primera pesada."
                acciones={<span className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-700">Ticket pendiente de asignar</span>}
            />

            <div className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
                <div className="space-y-5">
                    <Tarjeta titulo="1. Datos de la operación">
                        <Campo label="Tipo de operación" requerido>
                            <select className={inputCls} value={operacion} onChange={(e) => setOperacion(e.target.value)}>
                                {operaciones.map((o) => <option key={o.codigo} value={o.codigo}>{o.nombre}</option>)}
                            </select>
                        </Campo>
                        <Aviso>El ticket se asigna al guardar la primera pesada.</Aviso>
                    </Tarjeta>

                    <Tarjeta titulo="2. Transporte">
                        <div className="grid gap-4 md:grid-cols-2">
                            <Campo label="Placa del vehículo" requerido>
                                <div className="flex gap-2">
                                    <select className={inputCls} value={vehiculo} onChange={(e) => setVehiculo(e.target.value)}>
                                        <option value="">Seleccione…</option>
                                        {vehiculos.map((v) => <option key={String(v.id)} value={String(v.id)}>{v.codigo || v.nombre}</option>)}
                                    </select>
                                    <button type="button" onClick={() => setNuevo('VEHICULO')} title="Agregar vehículo" aria-label="Agregar vehículo" className="shrink-0 rounded border border-blue-600 px-3 text-lg font-medium leading-none text-blue-600 hover:bg-blue-50">+</button>
                                </div>
                            </Campo>
                            <Campo label="Conductor" requerido>
                                <div className="flex gap-2">
                                    <select className={inputCls} value={conductor} onChange={(e) => setConductor(e.target.value)}>
                                        <option value="">Seleccione…</option>
                                        {conductores.map((c) => <option key={String(c.id)} value={String(c.id)}>{c.nombre || c.codigo}</option>)}
                                    </select>
                                    <button type="button" onClick={() => setNuevo('CONDUCTOR')} title="Agregar conductor" aria-label="Agregar conductor" className="shrink-0 rounded border border-blue-600 px-3 text-lg font-medium leading-none text-blue-600 hover:bg-blue-50">+</button>
                                </div>
                            </Campo>
                            <div className="md:col-span-2">
                                <Campo label="Transportista" requerido>
                                    <select className={inputCls} value={transportista} onChange={(e) => setTransportista(e.target.value)}>
                                        <option value="">Seleccione…</option>
                                        {transportistas.map((t) => <option key={String(t.id)} value={String(t.id)}>{t.nombre}</option>)}
                                    </select>
                                </Campo>
                            </div>
                            <div className="md:col-span-2">
                                <Campo label="Observaciones">
                                    <textarea className={inputCls} rows={2} placeholder="Agregar una observación…" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
                                </Campo>
                            </div>
                        </div>
                    </Tarjeta>
                </div>

                <div className="space-y-5">
                    <Tarjeta titulo="3. Primera pesada">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                            <span className="font-medium text-gray-800">Estación: {estacion || 'sin asignar'}</span>
                            <div className="flex items-center gap-3">
                                <EstadoTrade conectado={traderConectado} />
                                <button type="button" onClick={onToggleTrade} className="rounded border border-blue-600 bg-white px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50">
                                    {traderConectado ? 'Desconectar' : 'Conectar'}
                                </button>
                            </div>
                        </div>
                        <PesoEnVivo grande />
                        <div className="mt-4">
                            <Campo label="Tipo de pesada">
                                <select className={inputCls} value={tipoPrimera} onChange={(e) => setTipoPrimera(e.target.value)}>
                                    {TIPOS_PRIMERA.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
                                </select>
                            </Campo>
                        </div>
                        <button type="button" onClick={capturar} className="mt-3 flex w-full items-center justify-center gap-2 rounded bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700">
                            <Scale size={18} /> Capturar primera pesada
                        </button>
                        <div className="mt-3 rounded-xl bg-gray-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Peso capturado</p>
                            <p className="my-1 text-4xl font-bold text-[#0a1f5c]">{captura ? kg(captura.peso) : 'Pendiente'}</p>
                            <p className="text-xs text-gray-500">La lectura se fija al capturar.</p>
                        </div>
                        <Aviso>El neto se calcula después de la segunda pesada.</Aviso>
                    </Tarjeta>

                    <div className="flex flex-wrap items-center justify-end gap-3">
                        <button type="button" onClick={onVolver} className="rounded border border-blue-600 bg-white px-6 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50">Cancelar</button>
                        <button type="button" onClick={guardar} disabled={!captura || guardando} className="rounded bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400">
                            {guardando ? 'Guardando…' : 'Guardar y dejar pendiente'}
                        </button>
                    </div>
                    {!captura && <p className="text-right text-xs text-gray-500">Captura la primera pesada para guardar.</p>}
                </div>
            </div>
            {nuevo && <NuevoCatalogoModal tipo={nuevo} onClose={() => setNuevo(null)} onGuardado={alCrear} />}
        </>
    );
};

export default NuevoPesaje;
