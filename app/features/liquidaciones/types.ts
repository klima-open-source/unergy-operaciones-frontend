/**
 * Tipos del slice de liquidaciones — la mitad que habla con la API de
 * Liquidaciones de Unergy a través del proxy del backend (`/liquidaciones-api`).
 *
 * Sobre las filas: los envoltorios de respuesta (`results`, `readiness`,
 * `avisos`, `total`…) están verificados contra las vistas que los consumen. La
 * forma de cada fila **no**: el backend es quien manda y no hay contrato
 * publicado. Van como `unknown[]` a propósito, en vez de un `any` que mentiría —
 * tiparlas es el paso 1 de la receta de la fase 3 para este slice, cuando cada
 * vista se migre y se pueda comprobar campo por campo.
 */

/** Versión del ciclo: `txf` es la liquidación inicial; `tx3`…`tx8`, reliquidaciones de XM. */
export const VERSIONES = ['txf', 'tx3', 'tx4', 'tx5', 'tx6', 'tx7', 'tx8'] as const
export type VersionCiclo = (typeof VERSIONES)[number]
export const VERSION_INICIAL: VersionCiclo = 'txf'

/** Estado normalizado de una tarea asíncrona. Lo unifica el backend. */
export enum EstadoTarea {
  EN_CURSO = 'en_curso',
  EXITO = 'exito',
  FALLO = 'fallo',
}

/** Límites que impone la API al subir facturas. */
export const MAX_FACTURAS_POR_LOTE = 20
export const MAX_MB_POR_FACTURA = 10

/** Lo que devuelve el sondeo de una tarea mientras corre y al terminar. */
export interface TareaEstado {
  estado: EstadoTarea
  /** Presente solo cuando `estado` es `EXITO`. Trae, por ejemplo, la `drive_url`. */
  resultado?: ResultadoTarea
  /** El motivo, cuando `estado` es `FALLO`. */
  mensaje?: string
}

/** El `resultado` crudo de una tarea. Cada acción del ciclo llena campos distintos. */
export interface ResultadoTarea {
  drive_url?: string
  file_name?: string
  message?: string
  [campo: string]: unknown
}

export interface OpcionesEsperaTarea {
  timeoutMs?: number
  intervaloMs?: number
  onEstado?: (estado: TareaEstado) => void
}

/** Se lanzó la tarea pero terminó mal. `message` es el motivo del backend. */
export class TareaFallida extends Error {
  constructor(message?: string) {
    super(message)
    this.name = 'TareaFallida'
  }
}

/** No hubo `task_id`, o el sondeo agotó su tiempo de espera. */
export class TareaSinRespuesta extends Error {
  constructor(message?: string) {
    super(message)
    this.name = 'TareaSinRespuesta'
  }
}

// ── Respuestas de los listados ───────────────────────────────────────────────

export interface RespuestaFacturasXm {
  results: unknown[]
  /** Bloque de alistamiento: qué falta para poder repartir el período. */
  readiness?: unknown
}

export interface RespuestaSubidaFacturas {
  task_id: string
  invoice_ids: number[]
  files_queued: number
}

export interface RespuestaDespachos {
  results: unknown[]
  /** Avisos del backend sobre el período (proyectos sin datos, cruces raros…). */
  avisos?: unknown[]
}

export interface RespuestaCostos {
  results: unknown[]
  total?: number
}

export interface FiltrosDespachos {
  month: number
  year: number
  version?: VersionCiclo
}

export interface RespuestaConsumo {
  results: unknown[]
}

export interface FiltrosConsumo {
  month: number
  year: number
  version?: VersionCiclo
  project?: string
  fecha?: string
}

/** Catálogos fijos: empresas, precios de energía y tipos de costo. */
export interface Catalogos {
  tipos_costo?: unknown[]
  [catalogo: string]: unknown
}

// ── Contratos de energía ─────────────────────────────────────────────────────

export const TIPOS_CONTRATO = [
  { value: 'ppa_pay_as_generated', label: 'PLG · pago por generado' },
  { value: 'ppa_pay_as_contracted', label: 'PLC · pago por contratado' },
  { value: 'no_contract', label: 'Sin contrato' },
] as const

export const TIPOS_TARIFA = [
  { value: 'ppa', label: 'PPA' },
  { value: 'market', label: 'Bolsa' },
  { value: 'market_plus_benefits', label: 'Bolsa + beneficios' },
] as const

export type TipoContrato = (typeof TIPOS_CONTRATO)[number]['value']
export type TipoTarifa = (typeof TIPOS_TARIFA)[number]['value']

// ── Acciones del ciclo ───────────────────────────────────────────────────────

/**
 * Las acciones asíncronas del ciclo, tal como las nombra la API.
 *
 * Orden obligatorio: liquidar → repartir → estado de resultados → cruce.
 * IPP, FTP y facturas son independientes entre sí.
 */
export enum AccionCiclo {
  DESCARGAR_XM = 'ftp',
  LIQUIDAR = 'liquidar',
  REPARTIR = 'repartir',
  ESTADO_RESULTADOS = 'estado-resultados',
  CRUCE_FACTURAS = 'cruce-facturas',
}

export interface PeriodoCiclo {
  month: number
  year: number
  version?: VersionCiclo
  [parametro: string]: unknown
}

export interface DiagnosticoProyecto {
  project: string
  month: number
  year: number
  version?: VersionCiclo
}

/**
 * `GET/PATCH /liquidaciones-api/proyectos/:id`: los códigos SIC de un proyecto,
 * verificado contra `ProyectoDetailView.vue` (pestaña ID liquidaciones).
 */
export interface ConfigLiquidacionProyecto {
  sic_gen?: string | null
  sic_con?: string | null
  /** Uno por subproyecto en la API — ver `SubproyectoQuoia`. */
  subproyectos?: SubproyectoQuoia[]
  [clave: string]: unknown
}

export interface PayloadConfigLiquidacionProyecto {
  sic_gen?: string | null
  sic_con?: string | null
  from_generator?: boolean
  from_commercializer?: boolean
  ac_power?: number | null
}

/**
 * `GET /liquidaciones-api/proyectos`: el listado plano de proyectos de la API
 * de liquidaciones, identificados por `nombre_topico` — verificado contra
 * `VerificacionCostosView.vue`, `IdsProyectosView.vue`, `ContratosEnergiaView.vue`,
 * `ConsumoView.vue` y `CostosComercializacionView.vue` (todas en `finanzas`).
 */
export interface ProyectoLiquidacionApi {
  proyecto_id: number
  nombre_comercial: string
  nombre_topico?: string | null
  tipo_proyecto?: string
  estado?: string
  sic_gen?: string | null
  sic_con?: string | null
  from_generator?: boolean
  from_commercializer?: boolean
  ac_power?: number | null
  subproyectos?: { [clave: string]: unknown }[]
  [clave: string]: unknown
}

/** `GET /liquidaciones-api/ac-power`: totales de potencia AC y tópicos sin cruce. */
export interface TotalesAcPower {
  topicos_sin_cruce?: string[]
  [clave: string]: unknown
}

// ── `/liquidaciones` — base propia del backend (no el proxy `-api`) ──────────
//
// Forma verificada contra `LiquidacionesListView.vue`, `LiquidacionDetailView.vue`,
// `LiquidacionPdfView.vue`, `LiquidacionesView.vue`, `LiquidacionesPorInversionistaView.vue`,
// `panels/ResumenPanel.vue`, `panels/DiferenciaPanel.vue`,
// `components/IngresoCostoComparativo.vue` y `components/GeneracionMensualChart.vue`.

export type TipoVentaLiquidacion = 'bolsa' | 'ppa' | 'interno' | 'autoconsumo'

/** `GET/PATCH /liquidaciones/:id`: el detalle operativo de una liquidación de proyecto. */
export interface Liquidacion {
  id: number
  proyecto_id: number
  proyecto_nombre?: string
  periodo: string
  estado?: string
  tipo_venta?: TipoVentaLiquidacion
  [clave: string]: unknown
}

export interface PayloadCrearLiquidacion {
  proyecto_id: number
  periodo: string
  tipo_venta: TipoVentaLiquidacion
}

/** Un `PATCH` parcial: estado, o cualquier campo del formulario de resumen. */
export type PayloadActualizarLiquidacion = Record<string, unknown>

/** Una fila de proyecto dentro de `resumen-panel` / `resumen-panel-rango` — espejo del Panel Contable. */
export interface ProyectoResumenPanel {
  proyecto_id: number
  ingresos_cop?: number
  costos_cop?: number
  valor_a_pagar_total?: number
  utilidad_estimada?: number
  utilidad_real?: number
  diferencia?: number
  inversionistas?: { grupos_totales?: Record<string, number>; [clave: string]: unknown }[]
  [clave: string]: unknown
}

/** `GET /liquidaciones/resumen-panel`. */
export interface RespuestaResumenPanel {
  proyectos: ProyectoResumenPanel[]
  sin_panel?: unknown[]
}

/** `GET /liquidaciones/resumen-panel-rango`: una entrada por período dentro del rango. */
export interface RespuestaResumenPanelRango {
  periodos: { periodo: string; proyectos: ProyectoResumenPanel[] }[]
}

/** `GET/PUT /liquidaciones/:id/informe`: el HTML del informe guardado en BD. */
export interface InformeLiquidacion {
  html_content?: string | null
  actualizado_en?: string | null
  [clave: string]: unknown
}

// ── `/facturacion` — facturación de energía del período ──────────────────────
//
// Forma verificada contra `panels/FacturacionPanel.vue`.

export interface LineaFacturacion {
  factura: string
  emitida?: boolean
  numero_factura?: string | null
  emitida_por?: string
  emitida_at?: string
  tarifa_indexada?: number | null
  tarifa_mixta?: boolean
  sin_ppa?: boolean
  kwh?: number
  facturacion?: number
  mensaje?: string
  proyectos?: {
    proyecto?: string
    contrato?: string
    tarifa_indexada?: number
    kwh?: number
    facturacion?: number
  }[]
  [clave: string]: unknown
}

/** `GET /facturacion`. */
export interface RespuestaFacturacion {
  resumen?: {
    kwh_total?: number
    facturacion_total?: number
    emitidas?: number
    [clave: string]: unknown
  }
  lineas?: unknown[]
  por_codigo_sic?: unknown[]
  por_factura?: LineaFacturacion[]
}

/** `GET /facturacion/despacho`. */
export interface RespuestaFacturacionDespacho {
  contratos: unknown[]
}

/** `POST /facturacion/despacho`: resultado de la carga del Excel de despacho. */
export interface RespuestaCargaDespacho {
  contratos: number
  kwh_total: number
  [clave: string]: unknown
}

/** `GET /facturacion/despacho/dias`. */
export interface RespuestaDespachoDias {
  dias: unknown[]
}

/** `GET/PUT /facturacion/bolsa`. */
export interface RespuestaBolsaFacturacion {
  manual?: number | null
  sugerido?: number | null
  vigente?: number | null
}

/** `GET /facturacion/cumplimiento`. */
export interface RespuestaCumplimientoFacturacion {
  resumen: Record<string, unknown>
  filas: unknown[]
}

export interface AgrupacionFacturacion {
  codigo_sic_contrato: string
  nombre: string
  porcentaje?: number | null
}

export interface PayloadEmitidaFacturacion {
  nombre: string
  periodo: string
  emitida: boolean
  numero_factura?: string | null
}

/** `GET /ppa/ipp/mensual`: histórico del IPP usado para indexar tarifas PPA. */
export interface IppMensual {
  año: number
  mes: number
  valor: number
  [clave: string]: unknown
}

/**
 * Los tres ids de Quoia viven por subproyecto, no por proyecto — un proyecto
 * puede tener varios (la mayoría tiene exactamente uno). `topic` identifica
 * al subproyecto y es el que se usa en la URL de
 * `PATCH /liquidaciones-api/subproyectos/:topic`.
 */
export interface SubproyectoQuoia {
  topic: string
  name?: string | null
  quoia_report_gen_id?: string | null
  quoia_report_con_id?: string | null
  quoia_node_id?: string | null
}

/** PATCH parcial: lo que no se envía no se toca, y `null` borra el id. */
export interface PayloadSubproyectoQuoia {
  quoia_report_gen_id?: string | null
  quoia_report_con_id?: string | null
  quoia_node_id?: string | null
}
