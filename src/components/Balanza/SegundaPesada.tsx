import React, { useEffect, useRef, useState } from 'react';
import notify from 'devextreme/ui/notify';
import { Lock } from 'lucide-react';
import {
    BalanzaHeader, EstadoTrade, LecturaTrade, PesoEnVivo, Pesaje, Tarjeta, aPesaje, fechaHora, kg, mensajeError, useLecturaTrade,
} from './balanzaShared';
import { Captura } from './NuevoPesaje';
import { balanzaApi, asegurarOk, nuevoIdSolicitud } from '../../services/balanza/balanzaApi';

interface Props {
    pesaje: Pesaje;
    estacion: string;
    traderConectado: boolean;
    onToggleTrade: () => void;
    onCapturar: (l: LecturaTrade) => Promise<Captura | null>;
    onVolver: () => void;
    /** Termina la operación (guardó pendiente o finalizó) y vuelve al listado. */
    onTerminado: (mensaje: string) => void;
}

const Tabla: React.FC<{ filas: [string, string][] }> = ({ filas }) => (
    <dl className="overflow-hidden rounded-lg border border-gray-200 text-sm">
        {filas.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[40%_1fr] border-b border-gray-100 bg-gray-50/60 px-3 py-2 last:border-0">
                <dt className="text-gray-600">{k}</dt>
                <dd className="font-medium text-gray-900">{v || '—'}</dd>
            </div>
        ))}
    </dl>
);

// El detalle trae el estado vigente (versión incluida); no se pisan datos con vacíos.
const combinar = (base: Pesaje, det: Pesaje): Pesaje => {
    const util = Object.fromEntries(Object.entries(det).filter(([, v]) => v !== '' && v !== null && v !== undefined));
    return { ...base, ...util };
};

const SegundaPesada: React.FC<Props> = ({ pesaje: inicial, estacion, traderConectado, onToggleTrade, onCapturar, onVolver, onTerminado }) => {
    const [pesaje, setPesaje] = useState<Pesaje>(inicial);
    const [captura, setCaptura] = useState<Captura | null>(null);
    const [trabajando, setTrabajando] = useState(false);
    // Idempotencia: la clave de "segunda pesada" cambia con cada captura nueva.
    const solSegunda = useRef(nuevoIdSolicitud());
    const solFinalizar = useRef(nuevoIdSolicitud());

    useEffect(() => {
        balanzaApi.pesajes
            .detalle(inicial.id)
            .then((r) => setPesaje((p) => combinar(p, aPesaje(r?.data))))
            .catch((e) => notify(mensajeError(e, 'No se pudo actualizar el detalle del pesaje.'), 'warning', 3500));
    }, [inicial.id]);

    const lectura = useLecturaTrade();

    const taraKg = captura?.peso ?? pesaje.taraKg;
    const taraFecha = captura?.fecha ?? pesaje.taraFecha;
    // Vista previa; el neto oficial lo calcula el backend al guardar la segunda pesada.
    const netoKg = captura && pesaje.primeraKg != null ? Math.abs(pesaje.primeraKg - captura.peso) : pesaje.netoKg;

    const capturar = async () => {
        const c = await onCapturar(lectura);
        if (c) {
            setCaptura(c);
            solSegunda.current = nuevoIdSolicitud();
        }
    };

    /** Guarda la segunda pesada si hay captura nueva; devuelve la versión vigente del pesaje. */
    const guardarSegunda = async (): Promise<number | string> => {
        if (!captura) return pesaje.version;
        const r = asegurarOk(
            await balanzaApi.pesajes.segundaPesada(pesaje.id, { id_solicitud: solSegunda.current, version: pesaje.version, id_captura: captura.idCaptura }),
            'No se pudo guardar la segunda pesada.',
        );
        const actualizado = aPesaje(r?.data);
        setPesaje((p) => combinar(p, actualizado));
        setCaptura(null);
        return actualizado.version;
    };

    const ejecutar = async (fn: () => Promise<void>, errorDefecto: string) => {
        setTrabajando(true);
        try {
            await fn();
        } catch (e) {
            notify(mensajeError(e, errorDefecto), 'error', 4000);
        } finally {
            setTrabajando(false);
        }
    };

    const guardarPendiente = () =>
        ejecutar(async () => {
            if (!captura) return notify('Capture la tara para guardar.', 'warning', 3000);
            await guardarSegunda();
            onTerminado('Segunda pesada guardada. El pesaje sigue pendiente de finalizar.');
        }, 'No se pudo guardar la segunda pesada.');

    const finalizar = () =>
        ejecutar(async () => {
            const version = await guardarSegunda();
            const r = asegurarOk(await balanzaApi.pesajes.finalizar(pesaje.id, { id_solicitud: solFinalizar.current, version }), 'No se pudo finalizar el pesaje.');
            const ticket = aPesaje(r?.data).ticket || pesaje.ticket;
            try {
                await balanzaApi.abrirTicketPdf(pesaje.id);
            } catch (e) {
                notify(mensajeError(e, 'Pesaje finalizado, pero no se pudo abrir el ticket.'), 'warning', 4000);
            }
            onTerminado(`Pesaje finalizado. Ticket ${ticket}.`);
        }, 'No se pudo finalizar el pesaje.');

    return (
        <>
            <BalanzaHeader
                migas={['Comercialización', 'Balanza', 'Segunda pesada']}
                volver={{ texto: 'Volver a pesajes', onClick: onVolver }}
                titulo="Segunda pesada · Tara"
                descripcion="Captura el peso del vehículo vacío para obtener el peso neto."
                acciones={
                    <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-5 py-3 shadow-sm">
                        <div>
                            <p className="text-xs text-gray-600">Ticket de balanza</p>
                            <p className="text-3xl font-bold text-[#0a1f5c]">{pesaje.ticket || '—'}</p>
                        </div>
                        <span className="rounded-lg bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-800">Pendiente de finalizar</span>
                    </div>
                }
            />

            <div className="grid gap-5 xl:grid-cols-[1fr_1.15fr]">
                <div className="space-y-5">
                    <Tarjeta titulo="Datos del pesaje">
                        <Tabla filas={[
                            ['Operación', pesaje.operacion],
                            ['Fecha operativa', pesaje.fecha.slice(0, 10)],
                            ...(pesaje.recepcion ? ([['Recepción vinculada', pesaje.recepcion]] as [string, string][]) : []),
                            ...(pesaje.material ? ([['Material', pesaje.material]] as [string, string][]) : []),
                            ...(pesaje.procedencia ? ([['Procedencia', pesaje.procedencia]] as [string, string][]) : []),
                            ...(pesaje.propietario ? ([['Propietario', pesaje.propietario]] as [string, string][]) : []),
                            ...(pesaje.lote ? ([['Lote', pesaje.lote]] as [string, string][]) : []),
                        ]} />
                    </Tarjeta>
                    <Tarjeta titulo="Transporte">
                        <Tabla filas={[
                            ['Vehículo', pesaje.placa],
                            ['Remolque', pesaje.remolque || 'No aplica'],
                            ['Conductor', pesaje.conductor],
                            ['Transportista', pesaje.transportista],
                        ]} />
                        {pesaje.observaciones && <p className="mt-3 text-sm text-gray-600"><b>Observaciones:</b> {pesaje.observaciones}</p>}
                    </Tarjeta>
                    <Tarjeta titulo="Primera pesada registrada">
                        <div className="relative rounded-xl bg-gray-50 p-4">
                            <Lock size={18} className="absolute right-4 top-4 text-gray-400" />
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Peso bruto</p>
                            <p className="text-4xl font-bold text-[#0a1f5c]">{kg(pesaje.primeraKg)}</p>
                            <p className="mt-1 text-xs text-gray-600">{fechaHora(pesaje.primeraFecha)}</p>
                        </div>
                    </Tarjeta>
                </div>

                <div className="space-y-5">
                    <Tarjeta titulo="Captura de tara">
                        <div className="mb-3 flex flex-wrap items-center justify-end gap-3 text-xs text-gray-600">
                            <span>{estacion}</span>
                            <EstadoTrade conectado={traderConectado} />
                            <button type="button" onClick={onToggleTrade} className="rounded border border-blue-600 bg-white px-3 py-1.5 font-medium text-blue-600 hover:bg-blue-50">
                                {traderConectado ? 'Desconectar' : 'Conectar'}
                            </button>
                        </div>
                        <PesoEnVivo />

                        <div className="mt-3 rounded-xl bg-gray-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Tara capturada</p>
                            <p className="my-1 text-3xl font-bold text-[#0a1f5c]">{taraKg != null ? kg(taraKg) : 'Pendiente'}</p>
                            {taraKg != null && taraFecha && <p className="text-xs text-gray-600">{fechaHora(taraFecha)}</p>}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                            <span>El peso capturado permanece fijo aunque cambie la lectura en vivo.</span>
                            <button type="button" onClick={capturar} className="rounded border border-blue-600 bg-white px-3 py-1.5 font-medium text-blue-600 hover:bg-blue-50">
                                {taraKg != null ? 'Volver a capturar tara' : 'Capturar tara'}
                            </button>
                        </div>

                        <div className="mt-3 rounded-xl bg-blue-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">Peso neto</p>
                            <p className="my-1 text-4xl font-bold text-[#0a1f5c]">{netoKg != null ? kg(netoKg) : 'Pendiente'}</p>
                            {taraKg != null && pesaje.primeraKg != null && <p className="text-xs text-gray-600">{kg(pesaje.primeraKg)} – {kg(taraKg)}</p>}
                        </div>
                    </Tarjeta>

                    <div className="flex flex-wrap justify-end gap-3">
                        <button type="button" disabled={!captura || trabajando} onClick={guardarPendiente} className="rounded border border-blue-600 bg-white px-6 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400">
                            Guardar pendiente
                        </button>
                        <button
                            type="button"
                            disabled={taraKg == null || trabajando}
                            onClick={finalizar}
                            className="rounded bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
                        >
                            {trabajando ? 'Procesando…' : 'Finalizar y emitir ticket'}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default SegundaPesada;
