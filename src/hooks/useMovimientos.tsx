// src/hooks/useMovimientos.ts
import { useCallback, useState } from "react";
import notify from "devextreme/ui/notify";
import { apiManager } from "../services/api/ApiManager";
import { MovimientoListadoApi, MovimientoListadoUI, Movimiento, MovimientoDetalle, MovimientoFormData, TipoMovimiento, DetalleApi, NuevoDetalle } from "../types/Movimientos";
import { toDDMMYYYY, ymdToISO } from "../store/utils";
import moment from "moment";
// === Tipos del backend (listar) ===



// ==== HOOK ====
const DEFAULT_EMPRESA_ID = 1; // "metalicos"
const DEFAULT_USUARIO = "erodrigo";
export const useMovimientos = () => {
    const [loading, setLoading] = useState(false);

    const crearMovimiento = useCallback(
        async (form: MovimientoFormData) => {
            setLoading(true);
            try {
                // 1) tipo → id (si no viene explícito)
                const tipoId =
                    form.tipoMovPersonalId ??
                    (form.tipo === "Entrada" ? 1 : 2); // 1 = ingreso, 2 = salida

                // 2) descripcion con fallback
                const descripcion =
                    (form.descripcion ?? form.observacion ?? form.motivo ?? "").trim();

                // 3) mapear detalles
                const detalles = (form.detalles || []).map((d) => ({
                    personaId: d.id_persona,
                    //aprobado: d.aprobado ? "1" : "0",
                    aprobado: d.aprobado,
                }));

                // 4) armar payload EXACTO
                const payload = {
                    fechaMov: moment(form.fecha).format("DD-MM-YYYY"),
                    tipoMovPersonalId: tipoId,
                    empresaId: form.empresaId ?? DEFAULT_EMPRESA_ID,
                    descripcion,
                    estado: "0",
                    usuReg: DEFAULT_USUARIO,
                    detalles,
                };
                console.log("payload", payload);
                //return

                const resp = await (apiManager as any).movimientos.crearMovimiento(payload);
                notify("Movimiento creado correctamente.", "success", 2500);
                return resp;
            } catch (e: any) {
                notify(e?.message || "No se pudo crear el movimiento.", "error", 3500);
                throw e;
            } finally {
                setLoading(false);
            }
        },
        []
    );

    const obtenerMovimientos = useCallback(async (id: number) => {
        setLoading(true);
        try {
            const resp = await (apiManager as any).movimientos.listarMovimientos({ id });
            const raw: MovimientoListadoApi[] = Array.isArray(resp?.data) ? resp.data : [];

            // mapeo a la forma que usará el DataGrid
            const data: MovimientoListadoUI[] = raw.map((r) => ({
                id: r.id,
                fecha: ymdToISO(r.fecha_mov),
                descripcion: r.descripcion,
                estado: r.estado,
                razon_social: r.razon_social,
                tipo_movimiento: r.tipo_movimiento,
            }));

            return data;
        } catch (e: any) {
            notify(e?.message || "No se pudo obtener la lista de movimientos.", "error", 3500);
            throw e;
        } finally {
            setLoading(false);
        }
    }, []);
    const obtenerDetallesMovimiento = useCallback(async (idCab: number) => {
        setLoading(true);
        try {
            const resp = await (apiManager as any).movimientos.detallesMovimiento({ id_cab: idCab });
            const raw: DetalleApi[] = Array.isArray(resp?.data) ? resp.data : [];
            const detalles: MovimientoDetalle[] = raw.map((r: any) => ({
                id_detalle: r.id_detalle,
                id_persona: r.id_persona,
                nombre: r.nombres_completos,
                //aprobado: r.aprobado === "1",
                aprobado: r.aprobado,
            }));
            return detalles;
        } catch (e: any) {
            notify(e?.message || "No se pudo obtener el detalle del movimiento.", "error", 3500);
            throw e;
        } finally {
            setLoading(false);
        }
    }, []);
    const actualizarAprobacionDetalle = useCallback(async (idDetalle: number, aprobado: boolean | string) => {
        setLoading(true);
        try {
            const resp = await (apiManager as any).movimientos.actualizarAprobacionDetalle({ "id_detalle": idDetalle, aprobado });
            return resp;
        } catch (e: any) {
            notify(e?.message || "No se pudo actualizar la aprobación del detalle.", "error", 3500);
            throw e;
        } finally {
            setLoading(false);
        }
    }, []);
    const actualizarEstadoMovimiento = useCallback(async (id: number, estado: string) => {
        setLoading(true);
        try {
            const resp = await (apiManager as any).movimientos.actualizarEstadoMovimiento({ "id_cabecera": id, estado });
            return resp;
        } catch (e: any) {
            notify(e?.message || "No se pudo actualizar el estado del movimiento.", "error", 3500);
            throw e;
        } finally {
            setLoading(false);
        }
    }, []);
    const agregarDetalle = useCallback(async (data: NuevoDetalle) => {
        setLoading(true);
        try {
            let datosEnviar: any = { ...data }
            delete datosEnviar.movimiento
            datosEnviar.id_mov_personal_cab = data.id 
            const resp = await (apiManager as any).movimientos.agregarDetalle(datosEnviar);
            return resp;
        } catch (e: any) {
            notify(e?.message || "No se pudo agregar el detalle.", "error", 3500);
            throw e;
        } finally {
            setLoading(false);
        }
    }, []);
    const eliminarDetalle = useCallback(async (id: number) => {
        setLoading(true);
        try {
            const resp = await (apiManager as any).movimientos.eliminarDetalle({ "id_detalle": id });
            return resp;
        } catch (e: any) {
            notify(e?.message || "No se pudo eliminar el detalle.", "error", 3500);
            throw e;
        } finally {
            setLoading(false);
        }
    }, []);
    return {
        crearMovimiento, obtenerMovimientos, obtenerDetallesMovimiento, loading, actualizarEstadoMovimiento,
        agregarDetalle, actualizarAprobacionDetalle, eliminarDetalle
    };
};
