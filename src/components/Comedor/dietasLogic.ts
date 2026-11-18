// Lógica pura de "Dietas autorizadas" (sin React) para poder probarla de forma aislada.
import { pick, soloFecha } from './comedorUtils';

export const SERVICIOS_DIETA = ['DESAYUNO', 'ALMUERZO', 'CENA'] as const;
export type ServicioDieta = (typeof SERVICIOS_DIETA)[number];

export interface LineaComida {
    aplicar: boolean;
    /** Texto del input; vacío = sin precio. */
    precio: string;
}

export interface FormDieta {
    id_punto_atencion: string;
    moneda: string;
    vigente_desde: string;
    vigente_hasta: string;
    observacion: string;
    /** Clave: id_tipo_servicio. */
    comidas: Record<number, LineaComida>;
}

/** Solo DESAYUNO, ALMUERZO y CENA admiten dieta (el resto de tipos de servicio se ignora). */
export const tiposDeDieta = (tipos: any[]): { id: number; nombre: ServicioDieta }[] =>
    SERVICIOS_DIETA.map((n) => {
        const t = tipos.find((x) => String(x?.nombre ?? x?.codigo ?? '').trim().toUpperCase() === n);
        return t ? { id: Number(t.id), nombre: n } : null;
    }).filter(Boolean) as { id: number; nombre: ServicioDieta }[];

/** Devuelve el mensaje de error del primer problema, o null si el formulario es válido. */
export const validarDieta = (f: FormDieta, idPersonal: number | null): string | null => {
    if (!idPersonal) return 'Busque y seleccione al personal por DNI.';
    if (!f.id_punto_atencion) return 'Seleccione el punto de atención.';
    if (!f.moneda) return 'Seleccione la moneda.';
    if (!f.vigente_desde) return 'Indique la fecha "Vigente desde".';
    if (f.vigente_hasta && f.vigente_hasta < f.vigente_desde) return '"Vigente hasta" no puede ser anterior a "Vigente desde".';
    const marcadas = Object.values(f.comidas).filter((c) => c.aplicar);
    if (marcadas.length === 0) return 'Seleccione al menos una comida autorizada.';
    for (const c of marcadas) {
        const p = Number(c.precio);
        if (c.precio.trim() === '' || !isFinite(p) || p < 0) return 'Ingrese un precio especial válido (0 o mayor) en cada comida seleccionada.';
    }
    return null;
};

export const armarDetalle = (f: FormDieta) =>
    Object.entries(f.comidas)
        .filter(([, c]) => c.aplicar)
        .map(([id, c]) => ({ id_tipo_servicio: Number(id), precio_especial: Math.round(Number(c.precio) * 100) / 100 }));

/** Detalle de una dieta del backend como { id_tipo_servicio → precio }. */
export const detalleDeFila = (fila: any): { id_tipo_servicio: number; servicio?: string; precio: number }[] => {
    const det = pick(fila, ['detalle', 'detalles', 'comidas']);
    if (!Array.isArray(det)) return [];
    return det.map((d: any) => ({
        id_tipo_servicio: Number(pick(d, ['id_tipo_servicio', 'idTipoServicio'])),
        servicio: pick(d, ['servicio', 'tipo_servicio', 'nombre_servicio']),
        precio: Number(pick(d, ['precio_especial', 'precio'])),
    }));
};

export const formDesdeFila = (fila: any, tipos: { id: number }[]): FormDieta => {
    const det = detalleDeFila(fila);
    const comidas: Record<number, LineaComida> = {};
    tipos.forEach((t) => {
        const d = det.find((x) => x.id_tipo_servicio === t.id);
        comidas[t.id] = d ? { aplicar: true, precio: String(d.precio) } : { aplicar: false, precio: '' };
    });
    return {
        id_punto_atencion: String(fila?.id_punto_atencion ?? ''),
        moneda: fila?.moneda || 'PEN',
        vigente_desde: soloFecha(fila?.vigente_desde),
        vigente_hasta: soloFecha(fila?.vigente_hasta),
        observacion: fila?.observacion ?? '',
        comidas,
    };
};

export const formVacioDieta = (tipos: { id: number }[], hoy: string): FormDieta => ({
    id_punto_atencion: '',
    moneda: 'PEN',
    vigente_desde: hoy,
    vigente_hasta: '',
    observacion: '',
    comidas: Object.fromEntries(tipos.map((t) => [t.id, { aplicar: false, precio: '' }])),
});

export const simboloMoneda = (m?: string) => (m === 'USD' ? '$' : 'S/');

export const formatearPrecio = (p: number, moneda?: string) => `${simboloMoneda(moneda)} ${Number(p).toFixed(2)}`;

/** Situación mostrada: la que informa el backend o, si no la trae, se deduce por fechas/estado. */
export const situacionDe = (fila: any, hoy: string): string => {
    const s = pick(fila, ['situacion']);
    if (s) return String(s).toUpperCase();
    const activo = fila?.estado === undefined ? true : fila.estado === true || fila.estado === 1;
    if (!activo) return 'INACTIVA';
    const desde = soloFecha(fila?.vigente_desde);
    const hasta = soloFecha(fila?.vigente_hasta);
    if (desde && desde > hoy) return 'PROGRAMADA';
    if (hasta && hasta < hoy) return 'VENCIDA';
    return 'VIGENTE';
};
