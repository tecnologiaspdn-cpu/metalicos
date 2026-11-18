import { useCallback, useEffect, useMemo, useState } from 'react';
import { getUsuarioSesion } from './useFirmaDocumentos';
import { miFirmaApi, UsuarioRubrica } from '../services/miFirma/miFirmaApi';
import { apiManager } from '../services/api/ApiManager';
import { GuardarRubricaPayload, Rubrica } from '../types/MiFirma';

/**
 * Estado y acciones del módulo "Mi Firma" (Configuración de Rúbrica), contra
 * `firmas/rubrica/*` (ver src/services/miFirma/miFirmaApi.ts).
 */
export const useMiFirma = () => {
    const usuarioSesion = useMemo(() => getUsuarioSesion(), []);
    const usuario: UsuarioRubrica = useMemo(
        () => ({ id: usuarioSesion.idPersonal, nombres: usuarioSesion.nombres }),
        [usuarioSesion]
    );

    const [rubrica, setRubrica] = useState<Rubrica | null>(null);
    const [loading, setLoading] = useState(false);
    const [guardando, setGuardando] = useState(false);
    // Cargo/puesto del usuario logueado (para estampar "Nombre / Cargo / Fecha"
    // debajo de la rúbrica, igual que una firma manuscrita con sello). No viene
    // en `usuarioCookie`, así que se busca en el listado de personal de su empresa.
    const [cargo, setCargo] = useState<string | undefined>(undefined);

    const fetchCargo = useCallback(async () => {
        try {
            const resp = await apiManager.personal.getAll({ id_empresa: usuarioSesion.empresa_id });
            const lista: any[] = resp?.data || resp || [];
            const propio = lista.find((p) => Number(p?.id) === usuarioSesion.idPersonal);
            setCargo(propio?.puesto_nombre || undefined);
        } catch (e) {
            console.error('No se pudo obtener el cargo del usuario.', e);
            setCargo(undefined);
        }
    }, [usuarioSesion.empresa_id, usuarioSesion.idPersonal]);

    useEffect(() => {
        fetchCargo();
    }, [fetchCargo]);

    const fetchRubrica = useCallback(async () => {
        setLoading(true);
        try {
            setRubrica(await miFirmaApi.obtenerRubrica(usuario));
        } catch (e) {
            console.error('No se pudo obtener la rúbrica.', e);
            setRubrica(null);
        } finally {
            setLoading(false);
        }
    }, [usuario]);

    useEffect(() => {
        fetchRubrica();
    }, [fetchRubrica]);

    const guardarRubrica = useCallback(
        async (payload: GuardarRubricaPayload) => {
            setGuardando(true);
            try {
                const actualizada = await miFirmaApi.guardarRubrica(usuario, payload, !!rubrica);
                setRubrica(actualizada);
                return actualizada;
            } finally {
                setGuardando(false);
            }
        },
        [usuario, rubrica]
    );

    return { usuarioSesion, usuario, cargo, rubrica, loading, guardando, fetchRubrica, guardarRubrica };
};
