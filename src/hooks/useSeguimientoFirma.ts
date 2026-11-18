import { useCallback, useEffect, useState } from 'react';
import { seguimientoFirmaApi } from '../services/seguimientoFirma/seguimientoFirmaApi';
import { SeguimientoDocumento } from '../types/SeguimientoFirma';

/** Estado y acciones del módulo "Seguimiento Firma" (auditoría de todos los documentos). */
export const useSeguimientoFirma = () => {
    const [documentos, setDocumentos] = useState<SeguimientoDocumento[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchDocumentos = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setDocumentos(await seguimientoFirmaApi.listar());
        } catch (e: any) {
            setDocumentos([]);
            setError(e?.message || 'No se pudo obtener el seguimiento de documentos.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDocumentos();
    }, [fetchDocumentos]);

    return { documentos, loading, error, fetchDocumentos };
};
