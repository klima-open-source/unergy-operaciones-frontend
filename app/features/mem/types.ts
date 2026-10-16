/**
 * Tipos de `mem` verificados contra sus vistas. Los de EVO (`/evo/*`) se fueron
 * el 2026-10-16 con Clima & ENSO, Balance Energía y la Precio de Bolsa vieja.
 */

// ── `/cumplimiento/*` — cumplimiento de PPA y descubrimientos (`CumplimientoV2View.vue`) ──

/** `GET /cumplimiento/ppa`: catálogo de contratos PPA visibles para cumplimiento. */
export interface ContratoCumplimientoPpa {
  id: number
  nombre_interno?: string
  numero_codigo_contrato?: string
  comprador_nombre?: string
  [clave: string]: unknown
}

/** `GET /cumplimiento/ppa/:id/anual`: el detalle mes a mes de un contrato. */
export interface AnualCumplimientoPpa {
  contrato: ContratoCumplimientoPpa
  year: number
  meses: unknown[]
  [clave: string]: unknown
}

export type ResumenAnualPpa = Record<string, unknown>

/** Forma libre — el simulador arma su propio árbol de asignaciones por planta/mes. */
export type SimuladorCumplimiento = Record<string, unknown>

/** Forma libre — comparte fuente con la pestaña Proyectos y con Revisión del mes. */
export type PlantasContratosCumplimiento = Record<string, unknown>

export type BalanceEnergiaCumplimiento = Record<string, unknown>

export type EnergiaTransadaCumplimiento = Record<string, unknown>

export interface ContratoAnualMatrizResumen {
  id: number
  [clave: string]: unknown
}

/** `GET /cumplimiento/anual-matriz/contratos`. */
export interface RespuestaAnualMatrizContratos {
  contratos: ContratoAnualMatrizResumen[]
  [clave: string]: unknown
}

/** `GET /cumplimiento/anual-matriz/contrato/:id`: se mezcla sobre la fila resumen. */
export type DetalleAnualMatrizContrato = Record<string, unknown>

export interface TotalesDescubrimientos {
  compras_bolsa_cop: number
  compras_bolsa_mwh: number
  excedentes_bolsa_cop: number
  excedentes_bolsa_mwh: number
  exposicion_neta_cop: number
}

/** Fila de `meses[].contratos[]`: el detalle de un contrato dentro del mes expandido. */
export interface ContratoDescubrimientoMes {
  contrato_id: number
  nombre?: string
  comprador?: string
  min_mwh: number
  max_mwh: number
  gen_asignada_mwh: number
  compras_cop: number
  compras_mwh: number
  excedentes_cop: number
  excedentes_mwh: number
  sobrecosto_vs_ppa_cop: number | null
}

export interface MesDescubrimientos {
  month: number
  precio_bolsa_avg?: number | null
  dias_con_precios: number
  compras_mwh: number
  compras_cop: number
  excedentes_mwh: number
  excedentes_cop: number
  contratos?: ContratoDescubrimientoMes[]
}

/** `GET /cumplimiento/descubrimientos` (`DescubrimientosView.vue`). */
export interface DescubrimientosCumplimiento {
  totales: TotalesDescubrimientos
  meses: MesDescubrimientos[]
}
