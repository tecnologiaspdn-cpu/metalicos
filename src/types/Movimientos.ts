// src/types/Movimientos.ts
export type TipoMovimiento = "Entrada" | "Salida";

export type MovimientoDetalle = {
  estado_cabeza?: string;
  id_detalle: number | null;
  id_persona: number;
  nombre: string;
  aprobado: boolean | string;
};

export type MovimientoFormData = {
  /** Visual: radio Entrada/Salida (solo UI) */
  tipo: TipoMovimiento;
  /** Fecha ISO para el picker; se enviará como DD-MM-YYYY */
  fecha: string;
  /** Catálogo backend */
  tipoMovPersonalId: number;
  motivo?: string;
  observacion?: string;
  /** Empresa seleccionada */
  empresaId: number;
  /** Texto libre que va a "descripcion" del backend */
  descripcion: string;
  clasificacion?: string;
  /** Personas seleccionadas */
  detalles?: MovimientoDetalle[];
};

export type Movimiento = {
  id: number;
  // Campos que muestras en la lista local (pueden seguir existiendo si mantienes el grid)
  tipo: TipoMovimiento;
  fecha: string; // ISO
  motivo?: string; // opcional si lo usabas
  observacion?: string; // opcional si lo usabas
  clasificacion?: string;
  estado: "Abierto" | "Cerrado" | "ABIERTO" | "CERRADO";
  // Extras opcionales
  tipoMovPersonalId?: number;
  empresaId?: number;
  descripcion?: string;
  detalles?: MovimientoDetalle[];
};
export type MovimientoListadoApi = {
  id: number;
  fecha_mov: string;        // "YYYY-MM-DD"
  descripcion: string;
  estado: "ABIERTO" | "CERRADO";
  razon_social: string;
  tipo_movimiento: string;
};

// === Tipos para la UI (grid) ===
export type MovimientoListadoUI = {
  id: number;
  fecha: string;            // ISO (para DataGrid date/datetime)
  descripcion: string;
  estado: "ABIERTO" | "CERRADO";
  razon_social: string;
  tipo_movimiento: string;
};

export type DetalleApi = {
  id: number;
  nombres_completos: string;
  aprobado: "0" | "1";
};
export type NuevoDetalle = {
  id: number;
  id_persona: number;
  aprobado: boolean | string;
  movimiento: any;
}