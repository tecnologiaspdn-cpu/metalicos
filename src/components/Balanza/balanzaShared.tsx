// Piezas compartidas del módulo Balanza (Comercialización): modelos, adaptadores
// de la API, lectura de TRADE y componentes de UI.
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import notify from 'devextreme/ui/notify';
import { OpcionesConexion, tradeBridge, tradeStore } from '../../services/balanza/tradeBridge';
import { inputCls } from '../Comedor/ComedorShared';
import { pick } from '../Comedor/comedorUtils';
import { filasDe } from '../Ti/TiShared';

export { inputCls, filasDe };

// ───────────────────────────── Modelos ─────────────────────────────
export type EstadoPesaje = 'PENDIENTE' | 'FINALIZADO' | 'ANULADO';

export interface Opcion {
    id: number | string;
    codigo: string;
    nombre: string;
}

export interface Estacion {
    id: number | string;
    version: number | string;
    codigo: string;
    nombre: string;
    sede: string;
    activa: boolean;
    extensionId: string;
    sesion: number;
    validada: boolean;
}

export interface Pesaje {
    id: number | string;
    version: number | string;
    ticket: string;
    operacion: string;
    estado: EstadoPesaje;
    placa: string;
    remolque: string;
    conductor: string;
    transportista: string;
    material: string;
    procedencia: string;
    propietario: string;
    lote: string;
    recepcion: string;
    observaciones: string;
    primeraKg: number | null;
    primeraFecha: string;
    taraKg: number | null;
    taraFecha: string;
    netoKg: number | null;
    fecha: string;
}

// ───────────────────────── Adaptadores (la API no está 100% tipada) ─────────────────────────
const num = (v: any): number | null => (v === undefined || v === null || v === '' || isNaN(Number(v)) ? null : Number(v));
const txt = (v: any): string => (v === undefined || v === null ? '' : String(v));

export const aOpcion = (r: any): Opcion => {
    if (typeof r === 'string') return { id: r, codigo: r, nombre: r };
    const codigo = txt(pick(r, ['codigo', 'placa', 'documento', 'operacion']));
    return {
        id: pick(r, ['id', 'id_empresa', 'codigo']) ?? codigo,
        codigo,
        nombre: txt(pick(r, ['nombre', 'razonSocial', 'razon_social', 'descripcion', 'etiqueta'])) || codigo,
    };
};

export const aEstacion = (r: any): Estacion => ({
    id: pick(r, ['id', 'id_estacion']),
    version: pick(r, ['version']) ?? 1,
    codigo: txt(pick(r, ['codigo'])),
    nombre: txt(pick(r, ['nombre'])),
    sede: txt(pick(r, ['sede'])),
    activa: r?.activa !== false && r?.activa !== 0,
    extensionId: txt(pick(r, ['extension_id', 'extensionId'])),
    sesion: num(pick(r, ['sesion'])) ?? 0,
    validada: !!pick(r, ['validada', 'configuracion_validada', 'validado']),
});

const estadoDe = (v: any): EstadoPesaje => {
    const e = txt(v).toUpperCase();
    return e === 'FINALIZADO' || e === 'ANULADO' ? e : 'PENDIENTE';
};

export const aPesaje = (r: any): Pesaje => ({
    id: pick(r, ['id', 'id_pesaje']),
    version: pick(r, ['version']) ?? 1,
    ticket: txt(pick(r, ['ticket', 'numero_ticket', 'nro_ticket', 'codigo_ticket', 'codigo'])),
    operacion: txt(pick(r, ['operacion', 'operacion_nombre', 'nombre_operacion'])),
    estado: estadoDe(r?.estado),
    placa: txt(pick(r, ['placa', 'vehiculo', 'vehiculo_codigo', 'codigo_vehiculo', 'vehiculo_placa'])),
    remolque: txt(pick(r, ['remolque', 'remolque_codigo', 'placa_remolque'])),
    conductor: txt(pick(r, ['conductor', 'conductor_nombre', 'nombre_conductor'])),
    transportista: txt(pick(r, ['transportista', 'transportista_nombre', 'nombre_transportista'])),
    material: txt(pick(r, ['material', 'material_nombre'])),
    procedencia: txt(pick(r, ['procedencia', 'procedencia_nombre'])),
    propietario: txt(pick(r, ['propietario', 'propietario_nombre'])),
    lote: txt(pick(r, ['lote', 'codigo_lote'])),
    recepcion: txt(pick(r, ['recepcion', 'codigo_recepcion', 'id_recepcion'])),
    observaciones: txt(pick(r, ['observaciones'])),
    primeraKg: num(pick(r, ['primera_pesada_kg', 'peso_primera_kg', 'peso_primera', 'bruto_kg', 'peso_bruto_kg'])),
    primeraFecha: txt(pick(r, ['primera_pesada_en', 'fecha_primera_pesada', 'primera_fecha', 'fecha_primera'])),
    taraKg: num(pick(r, ['segunda_pesada_kg', 'peso_segunda_kg', 'peso_segunda', 'tara_kg', 'peso_tara_kg'])),
    taraFecha: txt(pick(r, ['segunda_pesada_en', 'fecha_segunda_pesada', 'segunda_fecha', 'fecha_segunda'])),
    netoKg: num(pick(r, ['neto_kg', 'peso_neto_kg', 'neto'])),
    fecha: txt(pick(r, ['fecha_operativa', 'fecha'])),
});

/** Respuesta del listado: filas, y conteos por estado si el backend los envía. */
export const conteosDe = (resp: any): Partial<Record<EstadoPesaje, number>> => {
    const c = resp?.data?.conteos ?? resp?.data?.contadores ?? resp?.data?.totales ?? resp?.conteos;
    if (!c) return {};
    const g = (k: string) => num(pick(c, [k, k.toLowerCase(), `${k.toLowerCase()}s`, `${k.toLowerCase()}es`])) ?? undefined;
    return { PENDIENTE: g('PENDIENTE'), FINALIZADO: g('FINALIZADO'), ANULADO: g('ANULADO') };
};

export const TIPOS_PRIMERA = [
    { valor: 'BRUTO', etiqueta: 'Bruto · Vehículo cargado' },
    { valor: 'TARA', etiqueta: 'Tara · Vehículo vacío' },
];

// ───────────────────────────── Formato ─────────────────────────────
export const kg = (n: number | null | undefined, sep = ' ') =>
    n == null ? '—' : `${Math.round(n).toLocaleString('es-PE').replace(/[  ,]/g, sep)} kg`;

export { formatearFechaHora as fechaHora } from '../Comedor/comedorUtils';

// ───────────────────────────── Estación asignada a este navegador ─────────────────────────────
const CLAVE_ESTACION = 'balanzaEstacionId';
export const leerEstacionLocal = (): string => {
    try {
        return localStorage.getItem(CLAVE_ESTACION) || '';
    } catch {
        return '';
    }
};
export const guardarEstacionLocal = (id: number | string | null) => {
    try {
        id == null ? localStorage.removeItem(CLAVE_ESTACION) : localStorage.setItem(CLAVE_ESTACION, String(id));
    } catch {
        /* sin almacenamiento */
    }
};

// ───────────────────────────── Lectura de TRADE ─────────────────────────────
// El peso llega de TRADE por la extensión de Chrome (ver services/balanza/tradeBridge.ts).
export type { LecturaTrade, OpcionesConexion } from '../../services/balanza/tradeBridge';

/** Estado reactivo de la conexión con TRADE (singleton: el puerto de la extensión es único). */
export const useTrade = () => useSyncExternalStore(tradeStore.suscribir, tradeStore.estado);

/** Última lectura recibida; `peso` es null si no hay conexión o TRADE no devuelve peso. */
export const useLecturaTrade = () => useTrade().lectura;

/**
 * Conecta/desconecta con TRADE. Usar solo a nivel de página: al desmontarse cierra el puerto,
 * porque la extensión admite una única pestaña conectada.
 */
export const useTradeConexion = (opciones?: OpcionesConexion): [boolean, () => Promise<void>] => {
    const { conectado, conectando } = useTrade();
    const ref = useRef(opciones);
    ref.current = opciones;
    useEffect(() => () => tradeBridge.desconectar(), []);
    const alternar = async () => {
        if (conectando) return;
        if (conectado) return tradeBridge.desconectar();
        await tradeBridge.conectar(ref.current);
        const { error } = tradeStore.estado();
        if (error) notify(error, 'error', 6000);
    };
    return [conectado, alternar];
};

// ───────────────────────────── UI ─────────────────────────────

export const BalanzaHeader: React.FC<{
    titulo: string;
    descripcion: string;
    migas: string[];
    volver?: { texto: string; onClick: () => void };
    acciones?: React.ReactNode;
}> = ({ titulo, descripcion, migas, volver, acciones }) => (
    <div className="mb-5">
        <nav className="mb-2 text-sm text-gray-500">
            {migas.map((m, i) => (
                <span key={m}>
                    {i > 0 && <span className="mx-1.5">/</span>}
                    <span className={i === migas.length - 1 ? 'font-medium text-gray-800' : ''}>{m}</span>
                </span>
            ))}
        </nav>
        {volver && (
            <button type="button" onClick={volver.onClick} className="mb-1 text-sm text-blue-600 hover:underline">
                ← {volver.texto}
            </button>
        )}
        <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
                <h1 className="text-3xl font-bold text-[#0a1f5c]">{titulo}</h1>
                <p className="mt-0.5 text-sm text-gray-500">{descripcion}</p>
            </div>
            {acciones}
        </div>
    </div>
);

export const Tarjeta: React.FC<{ titulo: React.ReactNode; children: React.ReactNode; className?: string }> = ({ titulo, children, className = '' }) => (
    <section className={`rounded-xl border border-gray-200 bg-white p-5 shadow-sm ${className}`}>
        <h2 className="mb-4 text-lg font-bold text-[#0a1f5c]">{titulo}</h2>
        {children}
    </section>
);

export const Campo: React.FC<{ label: string; requerido?: boolean; children: React.ReactNode; ayuda?: string }> = ({ label, requerido, children, ayuda }) => (
    <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">
            {label} {requerido && <span className="text-red-500">*</span>}
        </span>
        {children}
        {ayuda && <span className="mt-1 block text-xs text-gray-500">{ayuda}</span>}
    </label>
);

export const soloLectura = `${inputCls} !bg-gray-100 text-gray-500`;

export const Aviso: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="mt-3 flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
        <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">i</span>
        <span>{children}</span>
    </div>
);

export const EstadoTrade: React.FC<{ conectado: boolean }> = ({ conectado }) => (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${conectado ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
        <span className={`h-2 w-2 rounded-full ${conectado ? 'bg-green-500' : 'bg-gray-400'}`} />
        {conectado ? 'TRADE conectado' : 'TRADE desconectado'}
    </span>
);

export const PesoEnVivo: React.FC<{ grande?: boolean }> = ({ grande }) => {
    const { conectado, conectando, error, lectura } = useTrade();
    const [ahora, setAhora] = useState(Date.now());
    useEffect(() => {
        if (!conectado) return;
        const t = setInterval(() => setAhora(Date.now()), 250);
        return () => clearInterval(t);
    }, [conectado]);
    const hayPeso = conectado && lectura.peso != null;
    const hace = ((ahora - lectura.leidoEn) / 1000).toFixed(1).replace('.', ',');
    return (
        <div className="rounded-xl bg-green-50 p-4">
            <div className="flex items-start justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">Peso en vivo</p>
                {hayPeso && (
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${lectura.estable ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        <span className={`h-2 w-2 rounded-full ${lectura.estable ? 'bg-green-500' : 'bg-amber-500'}`} />
                        {lectura.estable ? 'Estable' : 'Inestable'}
                    </span>
                )}
            </div>
            <p className={`my-1 font-bold text-[#0a1f5c] ${grande ? 'text-6xl' : 'text-4xl'}`}>{hayPeso ? kg(lectura.peso) : '— kg'}</p>
            <p className={`text-xs ${error ? 'text-red-600' : 'text-gray-600'}`}>
                {conectando ? 'Conectando con TRADE…' : error ? error : hayPeso ? `Lectura recibida hace ${hace} s.` : conectado ? 'Esperando lectura…' : 'Sin conexión con TRADE.'}
            </p>
        </div>
    );
};

/** Estados de una carga asíncrona, para no repetir try/catch en cada vista. */
export const mensajeError = (e: any, defecto: string) => (e instanceof Error && e.message ? e.message : defecto);
