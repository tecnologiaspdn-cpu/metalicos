// Lectura de peso desde TRADE a través de la extensión de Chrome "PDN · Enlace TRADE".
//
// Protocolo (ver background.js / policy.js de la extensión):
//  - Puerto: chrome.runtime.connect(<id extensión>, { name: 'pdn-trade-v1' }).
//  - Solo UNA pestaña puede tener el puerto a la vez; las demás son desconectadas.
//  - Solicitud: { id: string (≤64), action: 'ping' | 'read', server?: 'TRADE' | 'TRADE_1'… }
//    (ninguna otra clave). Una consulta a la vez; si hay otra en curso responde error.
//  - Respuesta: { id, ok, ... } | { id, ok: false, error }.
//  - La extensión solo acepta los orígenes de policy.js: http://localhost:5174,
//    http://127.0.0.1:5174, http://localhost:4174 e https://intranet.polimetalicos.com.pe.
//
// El estado es un singleton de módulo (como el puerto, que es único) y se consume con `useTrade`.
import { pick } from '../../components/Comedor/comedorUtils';

export const EXTENSION_ID_DEFECTO = 'fbehiocmdhdajmnkhahakjimlfabgkkf';
const NOMBRE_PUERTO = 'pdn-trade-v1';

// Una extensión sin empaquetar tiene un ID distinto en cada PC: se recuerda el último que conectó.
const CLAVE_EXTENSION = 'balanzaExtensionId';
export const leerExtensionLocal = (): string => {
    try {
        return localStorage.getItem(CLAVE_EXTENSION) || '';
    } catch {
        return '';
    }
};
const guardarExtensionLocal = (id: string) => {
    try {
        localStorage.setItem(CLAVE_EXTENSION, id);
    } catch {
        /* sin almacenamiento */
    }
};
const INTERVALO_MS = 800;
const TIMEOUT_MS = 4000;

export interface LecturaTrade {
    peso: number | null;
    estable: boolean;
    /** Marca de tiempo (ms) de la última lectura recibida. */
    leidoEn: number;
}

export interface EstadoTrade {
    conectado: boolean;
    conectando: boolean;
    error: string;
    lectura: LecturaTrade;
    /** Última respuesta tal cual la envió el puente (diagnóstico). */
    cruda: unknown;
}

export interface OpcionesConexion {
    extensionId?: string;
    /** Sesión de TRADE de la estación: 0 → 'TRADE', N → 'TRADE_N'. */
    sesion?: number;
}

const SIN_LECTURA: LecturaTrade = { peso: null, estable: false, leidoEn: 0 };
let estado: EstadoTrade = { conectado: false, conectando: false, error: '', lectura: SIN_LECTURA, cruda: null };
const oyentes = new Set<() => void>();
const publicar = (p: Partial<EstadoTrade>) => {
    estado = { ...estado, ...p };
    oyentes.forEach((f) => f());
};

export const tradeStore = {
    suscribir: (f: () => void) => {
        oyentes.add(f);
        return () => oyentes.delete(f);
    },
    estado: () => estado,
};

// ───────────────────────── Interpretación de la respuesta ─────────────────────────
/** Número desde 48250, "48250", "48 250,5 kg" o "48.250 kg" (punto de miles). */
export const aNumero = (v: unknown): number | null => {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    if (typeof v !== 'string') return null;
    const m = v.replace(/\s/g, '').match(/-?\d[\d.,]*/);
    if (!m) return null;
    let s = m[0];
    if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else if (s.includes(',')) s = s.replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    const n = Number(s);
    return isFinite(n) ? n : null;
};

const FACTOR_UNIDAD: Record<string, number> = { kg: 1, g: 0.001, t: 1000, ton: 1000, lb: 0.45359237 };

/**
 * Peso en kg y estabilidad desde la respuesta de `read`. El formato exacto del puente
 * nativo no está documentado, así que se aceptan varios nombres de campo; si no hay
 * indicador de estabilidad, lo decide `estabilizar` comparando lecturas consecutivas.
 */
export const interpretarLectura = (resp: any): { pesoKg: number | null; estable: boolean | null } => {
    // Formato real del puente: { ok, raw: '"@GI","23","<token>","<fecha>","[<id>]","1:BALANZA Min=… e=d=10kg","","0kg","0kg","<*> >0< ",…' }.
    // El peso es el primer campo que es SOLO "número + unidad" (el campo de la balanza también
    // contiene "Min=400kg", pero con más texto). Esto no informa estabilidad: la decide `estabilizar`.
    if (typeof resp?.raw === 'string') {
        const campos = Array.from(resp.raw.matchAll(/"([^"]*)"/g), (m) => (m as RegExpMatchArray)[1].trim());
        const campo = campos.find((c) => /^-?\d[\d.,]*\s*(kg|g|t|lb)$/i.test(c));
        if (!campo) return { pesoKg: null, estable: null };
        const n = aNumero(campo);
        const unidad = campo.replace(/[^a-zA-Z]/g, '').toLowerCase();
        return { pesoKg: n == null ? null : n * (FACTOR_UNIDAD[unidad] ?? 1), estable: null };
    }
    const d = resp?.data ?? resp?.lectura ?? resp?.reading ?? resp;
    const bruto = pick(d, ['peso_kg', 'pesoKg', 'peso', 'weight', 'valor', 'value', 'kg', 'gross', 'bruto', 'neto', 'net']);
    let peso = aNumero(bruto);
    if (peso != null) {
        const unidad = String(pick(d, ['unidad', 'unit', 'um']) ?? (typeof bruto === 'string' ? bruto.replace(/[^a-zA-Z]/g, '') : '')).toLowerCase();
        peso *= FACTOR_UNIDAD[unidad] ?? 1;
    }
    const e = pick(d, ['estable', 'stable', 'estabilidad', 'stability', 'motion']);
    let estable: boolean | null = null;
    if (typeof e === 'boolean') estable = e;
    else if (typeof e === 'number') estable = e !== 0;
    else if (typeof e === 'string') estable = /^(1|true|st|stable|estable|s[ií])$/i.test(e);
    if (d?.motion === true || d?.movimiento === true) estable = false;
    return { pesoKg: peso, estable };
};

// ───────────────────────── Conexión ─────────────────────────
let puerto: any = null;
let pendiente: { id: string; ok: (r: any) => void; fallo: (e: Error) => void; reloj: ReturnType<typeof setTimeout> } | null = null;
let bucle: ReturnType<typeof setTimeout> | null = null;
let historial: number[] = [];

const nuevoId = () => (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));

const solicitar = (action: 'ping' | 'read', server: string): Promise<any> =>
    new Promise((ok, fallo) => {
        if (!puerto) return fallo(new Error('No hay conexión con la extensión.'));
        if (pendiente) return fallo(new Error('Hay otra consulta en curso.'));
        const id = nuevoId();
        const reloj = setTimeout(() => {
            pendiente = null;
            fallo(new Error('La extensión no respondió a tiempo.'));
        }, TIMEOUT_MS);
        pendiente = { id, ok, fallo, reloj };
        try {
            puerto.postMessage({ id, action, server });
        } catch (e) {
            clearTimeout(reloj);
            pendiente = null;
            fallo(e instanceof Error ? e : new Error('No se pudo enviar la consulta.'));
        }
    });

const cerrarPuerto = () => {
    if (bucle) clearTimeout(bucle);
    bucle = null;
    if (pendiente) {
        clearTimeout(pendiente.reloj);
        pendiente.fallo(new Error('Conexión cerrada.'));
        pendiente = null;
    }
    try {
        puerto?.disconnect();
    } catch {
        /* ya cerrado */
    }
    puerto = null;
    historial = [];
};

const MENSAJE_SIN_CONEXION =
    'No se pudo conectar con la extensión. Verifique que esté instalada y activa, que esta página sea un origen autorizado ' +
    '(localhost:5174, localhost:4174 o la intranet) y que no haya otra pestaña conectada a TRADE.';

/** Estable si el puente lo informa; si no, tras 3 lecturas consecutivas iguales. */
const estabilizar = (peso: number, informado: boolean | null): boolean => {
    historial = [...historial.slice(-2), peso];
    if (informado !== null) return informado;
    return historial.length === 3 && historial.every((p) => p === peso);
};

const leer = async (server: string) => {
    try {
        const r = await solicitar('read', server);
        if (!puerto) return;
        if (!r?.ok) {
            historial = [];
            publicar({ error: r?.error || 'TRADE no devolvió lectura.', lectura: SIN_LECTURA, cruda: r });
        } else {
            const { pesoKg, estable } = interpretarLectura(r);
            if (pesoKg == null) {
                historial = [];
                publicar({ error: `La respuesta de TRADE no trae un peso reconocible: ${JSON.stringify(r).slice(0, 300)}`, lectura: SIN_LECTURA, cruda: r });
            } else {
                publicar({ error: '', lectura: { peso: pesoKg, estable: estabilizar(pesoKg, estable), leidoEn: Date.now() }, cruda: r });
            }
        }
    } catch (e) {
        if (!puerto) return;
        publicar({ error: e instanceof Error ? e.message : 'Error al leer TRADE.', lectura: SIN_LECTURA });
    }
    if (puerto) bucle = setTimeout(() => leer(server), INTERVALO_MS);
};

export const tradeBridge = {
    /** Abre el puerto, verifica con `ping` y empieza a leer. */
    async conectar({ extensionId, sesion = 0 }: OpcionesConexion = {}) {
        if (estado.conectado || estado.conectando) return;
        const chromeApi = (window as any).chrome;
        if (!chromeApi?.runtime?.connect) {
            publicar({ error: 'Este navegador no permite conectar con la extensión (use Chrome y un origen autorizado).' });
            return;
        }
        const server = sesion > 0 ? `TRADE_${sesion}` : 'TRADE';
        publicar({ conectando: true, error: '', lectura: SIN_LECTURA, cruda: null });
        const idExtension = extensionId?.trim() || leerExtensionLocal() || EXTENSION_ID_DEFECTO;
        try {
            puerto = chromeApi.runtime.connect(idExtension, { name: NOMBRE_PUERTO });
        } catch (e) {
            puerto = null;
            publicar({ conectando: false, error: e instanceof Error ? e.message : MENSAJE_SIN_CONEXION });
            return;
        }
        const este = puerto;
        este.onMessage.addListener((m: any) => {
            if (pendiente && m?.id === pendiente.id) {
                clearTimeout(pendiente.reloj);
                const p = pendiente;
                pendiente = null;
                p.ok(m);
            }
        });
        este.onDisconnect.addListener(() => {
            if (puerto !== este) return;
            const motivo: string | undefined = (window as any).chrome?.runtime?.lastError?.message;
            const conectadoAntes = estado.conectado;
            cerrarPuerto();
            const sinExtension = motivo && /Receiving end does not exist/i.test(motivo);
            publicar({
                conectado: false,
                conectando: false,
                lectura: SIN_LECTURA,
                error: conectadoAntes
                    ? 'Se perdió la conexión con la extensión o con el puente de TRADE.'
                    : sinExtension
                      ? `No hay una extensión con el ID ${idExtension} activa en este Chrome. Copie el ID real desde chrome://extensions y escríbalo en Configuración de balanza.`
                      : motivo || MENSAJE_SIN_CONEXION,
            });
        });
        try {
            const r = await solicitar('ping', server);
            if (!r?.ok) throw new Error(r?.error || 'El puente de TRADE no respondió al ping.');
            guardarExtensionLocal(idExtension);
            publicar({ conectado: true, conectando: false, error: '', cruda: r });
            leer(server);
        } catch (e) {
            const sigueAbierto = puerto === este;
            if (sigueAbierto) cerrarPuerto();
            // Si el puerto se cerró solo, onDisconnect ya publicó el motivo.
            if (sigueAbierto) publicar({ conectado: false, conectando: false, error: e instanceof Error ? e.message : MENSAJE_SIN_CONEXION });
        }
    },

    desconectar() {
        cerrarPuerto();
        publicar({ conectado: false, conectando: false, error: '', lectura: SIN_LECTURA });
    },
};
