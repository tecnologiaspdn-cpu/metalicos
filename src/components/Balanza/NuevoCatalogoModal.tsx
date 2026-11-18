import React, { useState } from 'react';
import notify from 'devextreme/ui/notify';
import { Modal } from '../Comedor/ComedorShared';
import { Campo, inputCls, mensajeError } from './balanzaShared';
import { asegurarOk, balanzaApi } from '../../services/balanza/balanzaApi';

/** Registro existente de un catálogo (para editar). */
export interface FilaCatalogo {
    id: number | string;
    codigo: string;
    nombre: string;
    licencia: string;
    activo: boolean;
    /** Conductor vinculado a personal: no se edita el nombre y se conserva `id_personal`. */
    idPersonal: number | string | null;
    version: number | string;
}

interface Props {
    tipo: 'VEHICULO' | 'CONDUCTOR';
    /** Si viene, el modal edita ese registro; si no, crea uno nuevo. */
    fila?: FilaCatalogo;
    onClose: () => void;
    /** Tras crear o actualizar. `id` puede faltar si la API no lo devuelve (el padre lo busca por código). */
    onGuardado: (r: { id?: number | string; codigo: string }) => void;
}

const NuevoCatalogoModal: React.FC<Props> = ({ tipo, fila, onClose, onGuardado }) => {
    const esVehiculo = tipo === 'VEHICULO';
    const editando = !!fila;
    const esPersonal = !!fila && fila.idPersonal != null;
    const [codigo, setCodigo] = useState(fila?.codigo ?? '');
    const [nombre, setNombre] = useState(fila?.nombre ?? '');
    const [licencia, setLicencia] = useState(fila?.licencia ?? '');
    const [activo, setActivo] = useState(fila?.activo ?? true);
    const [guardando, setGuardando] = useState(false);

    const guardar = async () => {
        const cod = codigo.trim().toUpperCase();
        if (!cod) return notify(esVehiculo ? 'Ingrese la placa.' : 'Ingrese el documento del conductor.', 'warning', 3000);
        if (!esVehiculo && !esPersonal && !nombre.trim()) return notify('Ingrese el nombre del conductor.', 'warning', 3000);
        if (!esVehiculo && !licencia.trim()) return notify('Ingrese la licencia del conductor.', 'warning', 3000);
        setGuardando(true);
        try {
            let id: number | string | undefined = fila?.id;
            if (fila) {
                const r = asegurarOk(
                    await balanzaApi.catalogo.actualizar(tipo, fila.id, {
                        codigo: cod,
                        ...(esPersonal ? {} : { nombre: nombre.trim() || (esVehiculo ? `Vehiculo ${cod}` : '') }),
                        ...(esVehiculo ? {} : { id_personal: fila.idPersonal, licencia: licencia.trim().toUpperCase() }),
                        activo,
                        version: fila.version,
                    }),
                    'No se pudo actualizar el registro.',
                );
                id = r?.data?.id ?? id;
                notify('Registro actualizado.', 'success', 3000);
            } else {
                const r = asegurarOk(
                    await balanzaApi.catalogo.crear(tipo, {
                        codigo: cod,
                        nombre: esVehiculo ? `Vehiculo ${cod}` : nombre.trim(),
                        ...(esVehiculo ? {} : { licencia: licencia.trim().toUpperCase() }),
                        activo: true,
                    }),
                    esVehiculo ? 'No se pudo crear el vehículo.' : 'No se pudo crear el conductor.',
                );
                id = r?.data?.id;
                notify(esVehiculo ? `Vehículo ${cod} creado.` : 'Conductor creado.', 'success', 3000);
            }
            onGuardado({ id, codigo: cod });
        } catch (e) {
            notify(mensajeError(e, 'No se pudo guardar.'), 'error', 4000);
        } finally {
            setGuardando(false);
        }
    };

    const titulo = editando ? (esVehiculo ? 'Editar vehículo' : 'Editar conductor') : esVehiculo ? 'Nuevo vehículo' : 'Nuevo conductor externo';
    const subtitulo = esPersonal
        ? 'Conductor vinculado a personal: el nombre se toma del personal.'
        : esVehiculo
          ? 'Catálogo de vehículos de la balanza.'
          : 'Conductor que no pertenece al personal de la empresa.';

    return (
        <Modal
            titulo={titulo}
            subtitulo={subtitulo}
            onClose={onClose}
            footer={
                <>
                    <button type="button" onClick={onClose} className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancelar</button>
                    <button type="button" onClick={guardar} disabled={guardando} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300">
                        {guardando ? 'Guardando…' : 'Guardar'}
                    </button>
                </>
            }
        >
            <div className="space-y-4">
                <Campo label={esVehiculo ? 'Placa' : 'Documento (DNI)'} requerido>
                    <input className={inputCls} autoFocus value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder={esVehiculo ? 'ABC-123' : '12345678'} />
                </Campo>
                {esVehiculo && editando && (
                    <Campo label="Nombre">
                        <input className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} />
                    </Campo>
                )}
                {!esVehiculo && !esPersonal && (
                    <Campo label="Nombre completo" requerido>
                        <input className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} />
                    </Campo>
                )}
                {!esVehiculo && (
                    <Campo label="Licencia de conducir" requerido>
                        <input className={inputCls} value={licencia} onChange={(e) => setLicencia(e.target.value)} placeholder="Q12345678" />
                    </Campo>
                )}
                {editando && (
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} className="h-4 w-4 accent-blue-600" />
                        Activo
                    </label>
                )}
            </div>
        </Modal>
    );
};

export default NuevoCatalogoModal;
