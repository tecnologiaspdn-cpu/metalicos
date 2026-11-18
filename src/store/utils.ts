export const ymdToISO = (ymd: string) => {
    const [y, m, d] = ymd.split("-").map(Number);
    const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
    dt.setHours(0, 0, 0, 0);
    return dt.toISOString();
};

export const toDDMMYYYY = (input: string) => {
    // Acepta ISO (2025-09-06T00:00:00.000Z) o "YYYY-MM-DD"
    const tryIso = new Date(input);
    if (!Number.isNaN(tryIso.getTime())) {
        const d = tryIso;
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const yyyy = d.getFullYear();
        return `${dd}-${mm}-${yyyy}`;
    }
    const parts = input.split("-");
    if (parts.length === 3) {
        const [y, m, d] = parts;
        return `${d.padStart(2, "0")}-${m.padStart(2, "0")}-${y}`;
    }
    // último recurso: hoy
    const t = new Date();
    const dd = String(t.getDate()).padStart(2, "0");
    const mm = String(t.getMonth() + 1).padStart(2, "0");
    const yyyy = t.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
};