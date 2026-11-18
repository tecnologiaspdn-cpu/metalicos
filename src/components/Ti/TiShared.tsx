import React, { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { nombreCompleto, pick } from '../Comedor/comedorUtils';
import { tiApi } from '../../services/ti/tiApi';

export { inputCls } from '../Comedor/ComedorShared';
import { inputCls } from '../Comedor/ComedorShared';

export const CONDICIONES = ['NUEVO', 'USADO'];
export const ESTADOS_OPERATIVOS = ['OPERATIVO', 'EN_REPARACION', 'INOPERATIVO'];

export const etiqueta = (v?: string | null) => {
    if (!v) return '—';
    const s = String(v).replace(/_/g, ' ').toLowerCase();
    return s.charAt(0).toUpperCase() + s.slice(1);
};

// ── Accesores tolerantes (el backend no está 100% tipado en la colección) ──
export const personaId = (p: any) => pick(p, ['id_personal', 'idPersonal', 'id']);
export const personaNombre = (p: any): string =>
    pick(p, ['nombre_completo', 'nombres_completos', 'nombre', 'colaborador', 'personal']) ?? nombreCompleto(p);
export const personaDni = (p: any): string => pick(p, ['dni', 'numero_documento', 'nro_documento', 'documento']) ?? '';
export const personaArea = (p: any): string => pick(p, ['area', 'nombre_area', 'area_nombre']) ?? '';
export const personaEmpresa = (p: any): string => pick(p, ['empresa', 'nombre_empresa', 'razon_social']) ?? '';
export const personaCorreo = (p: any): string => pick(p, ['correo', 'email', 'correo_electronico']) ?? '';
export const personaCantidad = (p: any): number =>
    Number(pick(p, ['cantidad_equipos', 'total_equipos', 'equipos_asignados', 'cantidad']) ?? 0);

export const activoTipo = (a: any): string => pick(a, ['tipo', 'tipo_activo', 'nombre_tipo', 'tipo_nombre']) ?? '';
export const activoResponsable = (a: any): string =>
    pick(a, ['responsable', 'responsable_nombre', 'nombre_responsable', 'personal_responsable', 'nombre_personal']) ?? '';
export const activoEquipo = (a: any): string => [activoTipo(a), a?.marca, a?.modelo].filter(Boolean).join(' ') || a?.descripcion || '—';

export const TiHeader: React.FC<{ titulo: string; descripcion: string; acciones?: React.ReactNode }> = ({ titulo, descripcion, acciones }) => (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
            <h1 className="text-3xl font-bold text-[#0a1f5c]">{titulo}</h1>
            <p className="mt-0.5 text-sm text-gray-500">{descripcion}</p>
        </div>
        {acciones}
    </div>
);

interface TiModalProps {
    titulo: string;
    onClose: () => void;
    children: React.ReactNode;
    footer?: React.ReactNode;
    ancho?: 'md' | 'lg' | 'xl';
}

const ANCHOS = { md: 'max-w-lg', lg: 'max-w-3xl', xl: 'max-w-5xl' };

export const TiModal: React.FC<TiModalProps> = ({ titulo, onClose, children, footer, ancho = 'lg' }) => (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
        <div className={`w-full ${ANCHOS[ancho]} rounded-xl bg-white shadow-2xl`} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="flex items-start justify-between border-b border-gray-100 p-5">
                <h3 className="text-xl font-bold text-[#0a1f5c]">{titulo}</h3>
                <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700" aria-label="Cerrar">
                    <X size={20} />
                </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
            {footer && <div className="flex justify-end gap-3 border-t border-gray-100 p-4">{footer}</div>}
        </div>
    </div>
);

const BADGE_COLORES: Record<string, string> = {
    OPERATIVO: 'bg-green-100 text-green-700',
    EN_REPARACION: 'bg-orange-100 text-orange-700',
    INOPERATIVO: 'bg-red-100 text-red-700',
    NUEVO: 'bg-blue-100 text-blue-700',
    USADO: 'bg-gray-100 text-gray-700',
    PENDIENTE: 'bg-amber-100 text-amber-700',
    ACEPTADA: 'bg-green-100 text-green-700',
    CANCELADA: 'bg-red-100 text-red-700',
    ACTIVO: 'bg-green-100 text-green-700',
    INACTIVO: 'bg-red-100 text-red-700',
};

export const Badge: React.FC<{ valor?: string | null }> = ({ valor }) => {
    const k = String(valor ?? '').toUpperCase();
    return (
        <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_COLORES[k] ?? 'bg-gray-100 text-gray-700'}`}>
            {etiqueta(valor)}
        </span>
    );
};

export const Paginacion: React.FC<{ pagina: number; total: number; tam: number; onChange: (p: number) => void; unidad?: string }> = ({
    pagina,
    total,
    tam,
    onChange,
    unidad = 'registros',
}) => {
    const paginas = Math.max(1, Math.ceil(total / tam));
    return (
        <div className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm text-gray-500">
            <span>
                Mostrando {total === 0 ? 0 : (pagina - 1) * tam + 1} a {Math.min(pagina * tam, total)} de {total} {unidad}
            </span>
            <div className="flex gap-2">
                <button className="rounded border px-3 py-1 disabled:opacity-40" disabled={pagina <= 1} onClick={() => onChange(pagina - 1)}>Anterior</button>
                <span className="rounded bg-blue-600 px-3 py-1 text-white">{pagina}</span>
                <button className="rounded border px-3 py-1 disabled:opacity-40" disabled={pagina >= paginas} onClick={() => onChange(pagina + 1)}>Siguiente</button>
            </div>
        </div>
    );
};

/** Filas de una respuesta { data: [...] } o { data: { items: [...] } }. */
export const filasDe = (resp: any): any[] => {
    const d = resp?.data;
    if (Array.isArray(d)) return d;
    const f = d?.items ?? d?.registros ?? d?.rows ?? d?.resultados ?? d?.equipos ?? d?.activos;
    return Array.isArray(f) ? f : [];
};

/** Buscador de personas (DNI o nombre) contra `GET /activos/personal?busqueda=`. */
export const PersonalPicker: React.FC<{
    valor: any | null;
    onChange: (p: any | null) => void;
    placeholder?: string;
    deshabilitado?: boolean;
}> = ({ valor, onChange, placeholder = 'DNI o nombre…', deshabilitado }) => {
    const [texto, setTexto] = useState('');
    const [resultados, setResultados] = useState<any[]>([]);
    const [abierto, setAbierto] = useState(false);
    const [buscando, setBuscando] = useState(false);
    const caja = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const q = texto.trim();
        if (q.length < 3) {
            setResultados([]);
            return;
        }
        let vigente = true;
        const t = setTimeout(async () => {
            setBuscando(true);
            try {
                const r = await tiApi.personal.listar({ busqueda: q });
                if (vigente) setResultados(filasDe(r).slice(0, 8));
            } catch {
                if (vigente) setResultados([]);
            } finally {
                if (vigente) setBuscando(false);
            }
        }, 350);
        return () => {
            vigente = false;
            clearTimeout(t);
        };
    }, [texto]);

    useEffect(() => {
        const cerrar = (e: MouseEvent) => {
            if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
        };
        document.addEventListener('mousedown', cerrar);
        return () => document.removeEventListener('mousedown', cerrar);
    }, []);

    if (valor) {
        return (
            <div className={`${inputCls} flex items-center justify-between`}>
                <span className="truncate">
                    {personaNombre(valor)}
                    {personaDni(valor) && ` · DNI ${personaDni(valor)}`}
                </span>
                {!deshabilitado && (
                    <button type="button" onClick={() => onChange(null)} className="ml-2 text-gray-400 hover:text-gray-700" aria-label="Quitar">
                        <X size={16} />
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="relative" ref={caja}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
                className={`${inputCls} pl-9`}
                placeholder={placeholder}
                value={texto}
                disabled={deshabilitado}
                onChange={(e) => {
                    setTexto(e.target.value);
                    setAbierto(true);
                }}
                onFocus={() => setAbierto(true)}
            />
            {abierto && texto.trim().length >= 3 && (
                <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded border border-gray-200 bg-white shadow-lg">
                    {buscando && <li className="px-3 py-2 text-sm text-gray-400">Buscando…</li>}
                    {!buscando && resultados.length === 0 && <li className="px-3 py-2 text-sm text-gray-400">Sin resultados.</li>}
                    {resultados.map((p, i) => (
                        <li key={personaId(p) ?? i}>
                            <button
                                type="button"
                                className="block w-full px-3 py-2 text-left text-sm hover:bg-blue-50"
                                onClick={() => {
                                    onChange(p);
                                    setTexto('');
                                    setAbierto(false);
                                }}
                            >
                                <span className="font-medium text-gray-900">{personaNombre(p)}</span>
                                <span className="ml-2 text-gray-500">{personaDni(p)}</span>
                                {personaArea(p) && <span className="ml-2 text-xs text-gray-400">{personaArea(p)}</span>}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};
