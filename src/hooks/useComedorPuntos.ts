import { useCallback, useEffect, useState } from 'react';
import { comedorApi } from '../services/comedor/comedorApi';

const LS_PUNTO = 'comedor_punto_atencion';

export interface PuntoAtencion {
    id: number;
    codigo?: string;
    nombre?: string;
    [k: string]: any;
}

/** Puntos de atención activos + el seleccionado (se recuerda por equipo en localStorage). */
export const useComedorPuntos = () => {
    const [puntos, setPuntos] = useState<PuntoAtencion[]>([]);
    const [idPunto, setIdPuntoState] = useState<number | null>(null);
    const [cargando, setCargando] = useState(true);

    const cargar = useCallback(async () => {
        setCargando(true);
        try {
            const resp = await comedorApi.puntos.listar(1);
            const lista: PuntoAtencion[] = Array.isArray(resp?.data) ? resp.data : [];
            setPuntos(lista);
            const guardado = Number(localStorage.getItem(LS_PUNTO));
            setIdPuntoState((actual) => {
                const candidato = actual ?? (guardado || null);
                return lista.some((p) => p.id === candidato) ? candidato : lista[0]?.id ?? null;
            });
        } catch (e) {
            console.error('No se pudieron cargar los puntos de atención.', e);
            setPuntos([]);
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const setIdPunto = (id: number | null) => {
        setIdPuntoState(id);
        try {
            if (id) localStorage.setItem(LS_PUNTO, String(id));
        } catch {
            /* sin persistencia */
        }
    };

    return { puntos, idPunto, setIdPunto, cargando, recargar: cargar };
};
