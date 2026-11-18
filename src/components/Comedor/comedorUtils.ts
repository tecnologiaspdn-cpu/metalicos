/** Primer valor no vacío entre varias claves candidatas (las respuestas del backend no están 100% tipadas). */
export const pick = (obj: any, keys: string[]): any => {
    if (!obj) return undefined;
    for (const k of keys) {
        if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
    }
    return undefined;
};

export const estaActivo = (row: any): boolean => {
    const v = row?.estado;
    if (typeof v === 'boolean') return v;
    return ['1', 'ACTIVO', 'TRUE'].includes(String(v ?? '').trim().toUpperCase());
};

/** `05:20:00` → `05:20` (valor de <input type="time">). */
export const horaCorta = (v?: string | null) => (v ? String(v).slice(0, 5) : '');

/** `2026-09-26T00:00:00Z` → `2026-09-26` (valor de <input type="date">). */
export const soloFecha = (v?: string | null) => (v ? String(v).slice(0, 10) : '');

export const hoyLima = (): string =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export const formatearFechaHora = (v?: string | null): string => {
    if (!v) return '—';
    // El backend envía hora de Lima sin zona ("2026-10-02T22:53:23.197"): se muestra tal cual,
    // sin pasar por Date (que la reinterpretaría según la zona del navegador).
    const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?$/);
    if (m) return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}:${m[6]}`;
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return d.toLocaleString('es-PE', {
        timeZone: 'America/Lima',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
};

export const nombreCompleto = (o: any): string =>
    pick(o, ['nombre_completo', 'nombres_completos', 'nombres_apellidos']) ??
    [o?.nombres, o?.ape_pat, o?.ape_mat].filter(Boolean).join(' ');

/** Extrae el arreglo de filas y el total de una respuesta paginada o plana. */
export const normalizarListado = (data: any): { filas: any[]; total: number } => {
    if (Array.isArray(data)) return { filas: data, total: data.length };
    const filas: any[] =
        data?.items ?? data?.registros ?? data?.rows ?? data?.resultados ?? data?.data ?? data?.consumos ?? data?.autorizaciones ?? data?.dietas ?? [];
    const total = Number(
        pick(data, ['total', 'total_registros', 'total_items', 'count']) ??
            pick(data?.paginacion, ['total', 'total_registros']) ??
            pick(data?.meta, ['total']) ??
            filas.length
    );
    return { filas: Array.isArray(filas) ? filas : [], total };
};

export const usuarioActual = (): string => {
    try {
        const raw = localStorage.getItem('usuarioCookie');
        return (raw ? JSON.parse(raw)?.username : '') || '';
    } catch {
        return '';
    }
};
