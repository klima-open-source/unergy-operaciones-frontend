/**
 * Tipos del slice de garantías.
 *
 * Las formas de abajo están verificadas contra `ProyeccionesView.vue`: son los
 * campos que la vista lee de verdad. El backend puede devolver más; lo que se
 * afirma aquí es lo que se usa.
 */
import type { Id } from '~/types/api'

/** Una ventana mensual de la proyección de garantías. */
export interface VentanaProyeccion {
  /** Identificador de la ventana, `${anio}-${mes}`. Es la key de la lista. */
  clave: string
  anio: number
  mes: number
  neto_mwh: number
  valor_energia: number
  valor_plantas_nuevas: number
  costo_regulatorio: number
  regulatorio_periodo: string | null
  garantia_total: number
  /** Lo ya pagado del período. Editable en línea. */
  pagado: number | null
  /** `pagado − garantia_total`. La vista lo recalcula al guardar para no parpadear. */
  saldo: number
}

export interface Proyecciones {
  fecha_corte: string
  precio_bolsa_cop_kwh: number | null
  ventanas: VentanaProyeccion[]
}

/** Una foto guardada de la proyección, para comparar contra lo que pasó. */
export interface SnapshotGarantias {
  id: Id
  clave: string
  anio: number
  mes: number
  fecha_corte: string
  neto_mwh: number
  precio_bolsa: number
  garantia_total: number
}

export interface HistorialGarantias {
  snapshots: SnapshotGarantias[]
}

/**
 * Los dos parámetros simulables de la proyección: cuántas plantas nuevas entran
 * y cuánto genera cada una.
 */
export interface ParametrosProyeccion {
  plantasNuevas?: number
  kwhPlantaNueva?: number
}

export interface PagoGarantia {
  anio: number
  mes: number
  valor: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Modelo Predictivo — verificado contra `ModeloPredictivo/*.vue`, que son las
// vistas que lo consumen.
// ─────────────────────────────────────────────────────────────────────────────

export interface FrescuraGeneracion {
  fecha_dato_generacion: string
  dias_atraso: number
  umbral_dias: number
}

export interface TotalesModeloPredictivo {
  suma_p90: number
  p90_total: number
  brecha: number
  central: number
}

export interface VencimientoSemanal {
  id: Id
  vencimiento: string
  periodo_ini: string
  periodo_fin: string
  etiqueta_periodo: string
  estado: string
  procedencia_ventana: string
  central: number | null
  p90: number | null
  real: number | null
}

export interface GarantiaMensual {
  id: Id
  mes: string
  estado: string
  procedencia_ventana: string
  central: number | null
  p90: number
  ventana_cierra: string
  objetivo: string
  publica_xm: string
  dias_ventaja: number
}

export interface BacktestModeloPredictivo {
  cobertura_semanal: number
  cobertura_mensual: number
  ancho_mediano: number
  ancho_baseline: number
  n_vencimientos: number
}

export interface PlanModeloPredictivo {
  frescura: FrescuraGeneracion | null
  totales: TotalesModeloPredictivo
  semanales: VencimientoSemanal[]
  mensuales: GarantiaMensual[]
  backtest: BacktestModeloPredictivo | null
}

export interface EslabonCalculo {
  concepto: string
  origen?: string | null
  central: number | null
  p90: number | null
}

export interface FuenteAncho {
  fuente: string
  pct: number
}

export interface InsumoModelo {
  tipo: string
  version: string
  rango: string
  dias: number
}

export interface DetalleVencimiento {
  cadena: EslabonCalculo[]
  descomposicion_ancho: FuenteAncho[]
  insumos: InsumoModelo[]
}

export interface ParametrosPlanModeloPredictivo {
  agente: string
  esquema: string
  cuantil?: number
  horizonte?: number
}

// ── `/garantias-ajustes` — histórico de ajustes semanales (AjustesXM) ──────────

export interface AjusteGarantia {
  id: number
  tipo: string
  fecha: string
  pb?: number | null
  restricciones?: number | null
  stn?: number | null
  trm?: number | null
  ptb?: number | null
  total_ungc?: number | null
  total_ungg?: number | null
  total_consignar?: number | null
  disponible_custodia?: number | null
  congelado?: number | null
  saldo?: number | null
  total_ajuste_txr?: number | null
  snapshot?: unknown
  created_at?: string
  updated_at?: string
}

export type PayloadAjusteGarantia = Partial<
  Omit<AjusteGarantia, 'id' | 'created_at' | 'updated_at'>
>
