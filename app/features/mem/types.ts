/**
 * Forma verificada contra las vistas de `mem`: `BalanceView.vue`,
 * `PrecioBolsaView.vue`, `ClimaView.vue` (endpoints `/evo/*`).
 */

// ── `/evo/dailyspot/*` — precio de bolsa (spot) ─────────────────────────────

export interface RegistroDailySpot {
  fecha?: string
  precio_promedio?: number
  precio_max?: number
  demanda_gwh?: number
  [clave: string]: unknown
}

/**
 * `GET /evo/dailyspot/latest`: resumen del día — precios horarios, generación
 * por fuente y plantas marginales. Forma parcialmente libre; solo se afirman
 * las llaves que leen las vistas.
 */
export interface DailySpotLatest {
  date?: string
  scarcity_price?: number
  summary?: Record<string, unknown>
  prices?: Record<string, number>
  generation?: Record<string, number>
  marginal_plants?: Record<string, string>
  [clave: string]: unknown
}

// ── `/evo/clima/*` — ENSO/ONI, precios históricos y precipitación ──────────

export interface RegistroClimaHistorico {
  id?: number
  [clave: string]: unknown
}

/** `GET /evo/clima/forecast`: estado ENSO/ONI vigente y señales de trading. */
export interface ClimaForecast {
  models_available?: boolean
  enso?: {
    current_state?: string
    classification?: string | string[]
    latest_oni?: number
    nino34_predicted?: number | number[]
    probabilities?: Record<string, number>
    [clave: string]: unknown
  }
  trading_signals?: Record<string, unknown>[]
  [clave: string]: unknown
}

/** `GET /evo/clima/prices`: precio de bolsa mensual histórico, para cruzar contra ONI. */
export interface RegistroPrecioMensual {
  year: number
  month: number
  price_cop_kwh?: number
  [clave: string]: unknown
}

/** `GET /evo/clima/oni`: índice ONI mensual y fase ENSO asociada. */
export interface RegistroOni {
  year: number
  month: number
  oni_value?: number
  enso_phase?: string
  [clave: string]: unknown
}

/** `GET /evo/clima/precip`: precipitación mensual por región. */
export interface RegistroPrecipitacion {
  year: number
  month: number
  precip_mm?: number
  anomaly_pct?: number
  climatology_mm?: number
  [clave: string]: unknown
}

// ── `/cumplimiento/*` — cumplimiento de PPA y descubrimientos (`CumplimientoV2View.vue`) ──

/** `GET /cumplimiento/ppa`: catálogo de contratos PPA visibles para cumplimiento. */
export interface ContratoCumplimientoPpa {
  id: number
  nombre_interno?: string
  numero_codigo_contrato?: string
  comprador_nombre?: string
  responsable?: string
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

export type DescubrimientosCumplimiento = Record<string, unknown>
