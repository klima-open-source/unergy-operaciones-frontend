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
  /** El período del costo regulatorio usado. `fallback: true` cuando no había Cruce de facturas del mes y se usó el último disponible. */
  regulatorio_periodo: { periodo?: string; fallback: boolean } | null
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
 * y cuánto genera cada una. `corte` (YYYY-MM-DD) replica un corte pasado; vacío =
 * el corte de hoy.
 */
export interface ParametrosProyeccion {
  plantasNuevas?: number
  kwhPlantaNueva?: number
  corte?: string
}

/** La parte de la garantía que le toca a un contrato por el déficit que genera. */
export interface ContratoGarantia {
  codigo: string
  contrato: string | null
  comprador: string | null
  proyecto_id: number | null
  deficit_mwh: number
  pct: number
  monto: number
  es_plc: boolean
  es_duplicado: boolean
}

/** Reparto de la garantía del mes entre los contratos que la generan. */
export interface AtribucionGarantia {
  fecha_corte: string
  anio: number
  mes: number
  total_garantia: number
  guardadas: number
  contratos: ContratoGarantia[]
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

/** Qué tan firme es una estimación: si XM ya la publicó, si ya cerró la ventana base, o si sigue abierta. */
export enum EstadoVencimiento {
  FIRME = 'firme',
  ESTIMADO = 'estimado',
  PRELIMINAR = 'preliminar',
}

/** De dónde sale la ventana de cálculo usada para un vencimiento. */
export enum ProcedenciaVentana {
  OBSERVADA = 'observada',
  DERIVADA = 'derivada',
  CANDIDATAS = 'candidatas',
}

export enum EsquemaModelo {
  SEMANAL = 'semanal',
  MENSUAL = 'mensual',
}

export enum AgenteGarantia {
  UNGG = 'UNGG',
  UNGC = 'UNGC',
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
  estado: EstadoVencimiento
  procedencia_ventana: ProcedenciaVentana
  central: number | null
  p90: number | null
  real: number | null
}

export interface GarantiaMensual {
  id: Id
  mes: string
  estado: EstadoVencimiento
  procedencia_ventana: ProcedenciaVentana
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
  agente: AgenteGarantia
  esquema: EsquemaModelo
  cuantil?: number
  horizonte?: number
}

// ── `/garantias-ajustes` — histórico de ajustes semanales (AjustesXM) ──────────

/** Los tres orígenes de un registro del histórico, uno por tab de `AjustesXM`. */
export type TipoAjusteGarantia = 'semanal' | 'txr' | 'mensual'

export interface AjusteGarantia {
  id: number
  tipo: TipoAjusteGarantia
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
