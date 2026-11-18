import React, { useCallback, useEffect, useState } from 'react';
import notify from 'devextreme/ui/notify';
import PesajesLista from '../../components/Balanza/PesajesLista';
import NuevoPesaje, { Captura } from '../../components/Balanza/NuevoPesaje';
import SegundaPesada from '../../components/Balanza/SegundaPesada';
import { Modal, inputCls } from '../../components/Comedor/ComedorShared';
import {
    Estacion, EstadoPesaje, LecturaTrade, Pesaje, aEstacion, aPesaje, conteosDe, filasDe, leerEstacionLocal, mensajeError, useTradeConexion,
} from '../../components/Balanza/balanzaShared';
import { balanzaApi, asegurarOk, nuevoIdSolicitud } from '../../services/balanza/balanzaApi';
import { leerExtensionLocal } from '../../services/balanza/tradeBridge';

type Vista = { tipo: 'lista' } | { tipo: 'nuevo' } | { tipo: 'segunda'; pesaje: Pesaje };

const Balanza: React.FC = () => {
    const [vista, setVista] = useState<Vista>({ tipo: 'lista' });
    const [estado, setEstado] = useState<EstadoPesaje>('PENDIENTE');
    const [pesajes, setPesajes] = useState<Pesaje[]>([]);
    const [pendientes, setPendientes] = useState<number | undefined>();
    const [cargando, setCargando] = useState(false);
    const [estacion, setEstacion] = useState<Estacion | null>(null);
    const [conectado, alternarTrade] = useTradeConexion({ extensionId: leerExtensionLocal() || estacion?.extensionId, sesion: estacion?.sesion });
    const [anulando, setAnulando] = useState<Pesaje | null>(null);
    const [motivo, setMotivo] = useState('');

    const cargarPesajes = useCallback(async (e: EstadoPesaje) => {
        setCargando(true);
        try {
            const r = await balanzaApi.pesajes.listar({ estado: e, pagina: 1, tamano: 50 });
            const filas = filasDe(r).map(aPesaje);
            setPesajes(filas);
            const c = conteosDe(r);
            setPendientes(c.PENDIENTE ?? (e === 'PENDIENTE' ? filas.length : undefined));
        } catch (err) {
            setPesajes([]);
            notify(mensajeError(err, 'No se pudo cargar los pesajes.'), 'error', 3500);
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => {
        if (vista.tipo === 'lista') cargarPesajes(estado);
    }, [vista.tipo, estado, cargarPesajes]);

    // Estación asignada a este navegador (Configuración de balanza); si no hay, la primera activa y validada.
    useEffect(() => {
        balanzaApi.estaciones
            .listar()
            .then((r) => {
                const todas = filasDe(r).map(aEstacion);
                const local = leerEstacionLocal();
                setEstacion(todas.find((x) => String(x.id) === local) ?? todas.find((x) => x.activa && x.validada) ?? null);
            })
            .catch((e) => notify(mensajeError(e, 'No se pudo cargar la estación.'), 'warning', 3500));
    }, []);

    const capturar = async (l: LecturaTrade): Promise<Captura | null> => {
        if (!estacion) return notify('Asigne una estación en Configuración de balanza.', 'warning', 3500), null;
        if (!estacion.activa || !estacion.validada) return notify('La estación no está activa y validada. Revise Configuración de balanza.', 'warning', 3500), null;
        if (!conectado || l.peso == null) return notify('Conecte con TRADE para capturar la pesada.', 'warning', 3000), null;
        if (!l.estable) return notify('El peso no es estable. Espere la estabilización.', 'warning', 3000), null;
        if (l.peso <= 0) return notify('El peso debe ser mayor a 0 kg.', 'warning', 3000), null;
        const fecha = new Date().toISOString();
        try {
            const r = asegurarOk(
                await balanzaApi.capturar({
                    id_lectura: nuevoIdSolicitud(),
                    id_estacion: estacion.id,
                    version_estacion: estacion.version,
                    peso_kg: l.peso,
                    unidad: 'kg',
                    estable: true,
                    leido_en: fecha,
                    sesion: estacion.sesion,
                    origen: 'TRADE',
                }),
                'No se pudo registrar la captura.',
            );
            const idCaptura = r?.data?.id_captura;
            if (!idCaptura) throw new Error('La API no devolvió el identificador de la captura.');
            return { idCaptura, peso: l.peso, fecha };
        } catch (e) {
            notify(mensajeError(e, 'No se pudo registrar la captura.'), 'error', 4000);
            return null;
        }
    };

    const volver = () => setVista({ tipo: 'lista' });
    const terminado = (mensaje: string) => {
        notify(mensaje, 'success', 3500);
        volver();
    };

    const anular = async () => {
        if (!anulando) return;
        if (!motivo.trim()) return notify('Indique el motivo de la anulación.', 'warning', 3000);
        try {
            asegurarOk(await balanzaApi.pesajes.anular(anulando.id, { id_solicitud: nuevoIdSolicitud(), version: anulando.version, motivo: motivo.trim() }), 'No se pudo anular el pesaje.');
            notify(`Pesaje ${anulando.ticket} anulado.`, 'success', 3000);
            setAnulando(null);
            setMotivo('');
            cargarPesajes(estado);
        } catch (e) {
            notify(mensajeError(e, 'No se pudo anular el pesaje.'), 'error', 4000);
        }
    };

    const nombreEstacion = estacion?.nombre ?? '';

    return (
        <>
            {vista.tipo === 'nuevo' && (
                <NuevoPesaje estacion={nombreEstacion} traderConectado={conectado} onToggleTrade={alternarTrade} onCapturar={capturar} onVolver={volver} onGuardado={(t) => terminado(t ? `Pesaje guardado. Ticket ${t}.` : 'Pesaje guardado.')} />
            )}
            {vista.tipo === 'segunda' && (
                <SegundaPesada pesaje={vista.pesaje} estacion={nombreEstacion} traderConectado={conectado} onToggleTrade={alternarTrade} onCapturar={capturar} onVolver={volver} onTerminado={terminado} />
            )}
            {vista.tipo === 'lista' && (
                <PesajesLista
                    estado={estado}
                    onEstado={setEstado}
                    pesajes={pesajes}
                    cargando={cargando}
                    pendientes={pendientes}
                    traderConectado={conectado}
                    onConectar={alternarTrade}
                    onNuevo={() => setVista({ tipo: 'nuevo' })}
                    onContinuar={(pesaje) => setVista({ tipo: 'segunda', pesaje })}
                    onAnular={(p) => setAnulando(p)}
                    onTicket={(p) => balanzaApi.abrirTicketPdf(p.id).catch((e) => notify(mensajeError(e, 'No se pudo abrir el ticket.'), 'error', 3500))}
                />
            )}
            {anulando && (
                <Modal
                    titulo={`Anular pesaje ${anulando.ticket}`}
                    subtitulo="Esta acción no se puede deshacer."
                    onClose={() => setAnulando(null)}
                    footer={
                        <>
                            <button type="button" onClick={() => setAnulando(null)} className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancelar</button>
                            <button type="button" onClick={anular} className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Anular pesaje</button>
                        </>
                    }
                >
                    <label className="block text-sm font-medium text-gray-700">
                        Motivo <span className="text-red-500">*</span>
                        <textarea className={`${inputCls} mt-1`} rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                    </label>
                </Modal>
            )}
        </>
    );
};

export default Balanza;
