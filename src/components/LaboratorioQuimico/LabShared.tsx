import React, { useEffect, useMemo, useState } from 'react';
import { apiManager } from '../../services/api/ApiManager';
import { getUsuarioSesion } from '../../hooks/useFirmaDocumentos';
import { pick } from '../Comedor/comedorUtils';

export { Modal, inputCls } from '../Comedor/ComedorShared';

export const LabHeader: React.FC<{ titulo: string; descripcion?: string; acciones?: React.ReactNode }> = ({ titulo, descripcion, acciones }) => (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
            <h1 className="text-3xl font-bold text-gray-900">{titulo}</h1>
            {descripcion && <p className="mt-1 text-gray-500">{descripcion}</p>}
        </div>
        {acciones}
    </div>
);

const normalizar = (v: any) => String(v ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');

// TODO(CONFIRMAR CON BACKEND): de los estados solo se vio `FIRMADA` (filtro) y `PENDIENTE` (recepción);
// el resto de códigos se infiere de los textos del diseño. Un código desconocido se muestra tal cual.
const ESTADOS: Record<string, { label: string; cls: string }> = {
    BORRADOR: { label: 'Borrador', cls: 'bg-amber-100 text-amber-800' },
    EN_FIRMA: { label: 'En firma', cls: 'bg-blue-100 text-blue-700' },
    PENDIENTE_FIRMA: { label: 'En firma', cls: 'bg-blue-100 text-blue-700' },
    FIRMADA: { label: 'Firmado', cls: 'bg-green-100 text-green-700' },
    FIRMADO: { label: 'Firmado', cls: 'bg-green-100 text-green-700' },
    // Envío directo (sin firma electrónica): confirmado por el test de Postman (`estado === "ENVIADA"`).
    ENVIADA: { label: 'Enviada', cls: 'bg-teal-100 text-teal-700' },
    ANULADA: { label: 'Anulada', cls: 'bg-red-100 text-red-700' },
    ANULADO: { label: 'Anulada', cls: 'bg-red-100 text-red-700' },
};

const RECEPCIONES: Record<string, { label: string; cls: string }> = {
    PENDIENTE: { label: 'Pendiente', cls: 'bg-gray-100 text-gray-700' },
    RECIBIDA: { label: 'Recibida', cls: 'bg-green-100 text-green-700' },
    RECIBIDO: { label: 'Recibida', cls: 'bg-green-100 text-green-700' },
};

export const codigoEstado = (v: any) => normalizar(v);

export const EstadoChip: React.FC<{ valor: any }> = ({ valor }) => {
    const e = ESTADOS[normalizar(valor)] ?? { label: String(valor ?? '—'), cls: 'bg-gray-100 text-gray-700' };
    return <span className={`inline-block whitespace-nowrap rounded px-2.5 py-1 text-xs font-medium ${e.cls}`}>{e.label}</span>;
};

export const RecepcionChip: React.FC<{ valor: any }> = ({ valor }) => {
    const e = RECEPCIONES[normalizar(valor)] ?? { label: String(valor ?? '—'), cls: 'bg-gray-100 text-gray-700' };
    return <span className={`inline-block whitespace-nowrap rounded px-2.5 py-1 text-xs font-medium ${e.cls}`}>{e.label}</span>;
};

/** Campos de una fila de listado/detalle de solicitud (los nombres exactos aún no están confirmados). */
export const campo = {
    codigo: (s: any) => pick(s, ['numero', 'codigo', 'nro_solicitud', 'numero_solicitud']) ?? s?.id,
    fecha: (s: any) => String(pick(s, ['fecha', 'fecha_solicitud']) ?? '').slice(0, 10).split('-').reverse().join('/'),
    empresa: (s: any) => pick(s, ['empresa', 'empresa_nombre', 'compania', 'nombre_empresa']) ?? '—',
    solicitante: (s: any) => pick(s, ['solicitante', 'remitente', 'enviado_por', 'usuario_registro']) ?? '—',
    muestras: (s: any) => pick(s, ['total_muestras', 'n_muestras', 'cantidad_muestras', 'muestras_total']) ?? (Array.isArray(s?.muestras) ? s.muestras.reduce((a: number, m: any) => a + (Number(m.cantidad) || 0), 0) : '—'),
    estado: (s: any) => pick(s, ['estado', 'estado_firma']),
    recepcion: (s: any) => pick(s, ['recepcion', 'estado_recepcion']) ?? 'PENDIENTE',
};

export const nombrePersona = (p: any): string =>
    pick(p, ['nombres_completos', 'nombre_completo']) ?? [p?.nombres, p?.ape_pat, p?.ape_mat].filter(Boolean).join(' ');

/** Personal de una empresa (para elegir autorizador / representante). */
export const usePersonalEmpresa = (idEmpresa: number | string | null) => {
    const [lista, setLista] = useState<any[]>([]);
    useEffect(() => {
        if (!idEmpresa) {
            setLista([]);
            return;
        }
        let vivo = true;
        apiManager.personal
            .getAll({ id_empresa: Number(idEmpresa) })
            .then((r: any) => vivo && setLista(Array.isArray(r?.data) ? r.data : Array.isArray(r) ? r : []))
            .catch(() => vivo && setLista([]));
        return () => {
            vivo = false;
        };
    }, [idEmpresa]);
    return lista;
};

export const useEmpresas = () => {
    const [empresas, setEmpresas] = useState<any[]>([]);
    useEffect(() => {
        apiManager.maestro
            .listaEmpresas({})
            .then((r: any) => setEmpresas(r?.data || []))
            .catch(() => setEmpresas([]));
    }, []);
    return empresas;
};

export const useSesion = () => useMemo(() => getUsuarioSesion(), []);

export const GUARDIAS = [
    { value: 'DIA', label: 'Día' },
    { value: 'NOCHE', label: 'Noche' },
];

/** Paginación simple reutilizada por ambas pantallas. */
export const Paginacion: React.FC<{ pagina: number; total: number; tamano: number; mostrados: number; onCambiar: (p: number) => void; cargando?: boolean; etiqueta: string }> = ({
    pagina, total, tamano, mostrados, onCambiar, cargando, etiqueta,
}) => {
    const totalPaginas = Math.max(1, Math.ceil(total / tamano));
    return (
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-gray-500">
            <span>
                Mostrando {mostrados === 0 ? 0 : (pagina - 1) * tamano + 1} a {(pagina - 1) * tamano + mostrados} de {total} {etiqueta}
            </span>
            <div className="flex gap-2">
                <button className="rounded border px-3 py-1 disabled:opacity-40" disabled={pagina <= 1 || cargando} onClick={() => onCambiar(pagina - 1)}>Anterior</button>
                <span className="rounded bg-blue-600 px-3 py-1 text-white">{pagina} / {totalPaginas}</span>
                <button className="rounded border px-3 py-1 disabled:opacity-40" disabled={pagina >= totalPaginas || cargando} onClick={() => onCambiar(pagina + 1)}>Siguiente</button>
            </div>
        </div>
    );
};
