/**
 * Forma verificada contra `PanelContableView.vue` y los componentes de
 * `features/panel-contable/components/`, único consumidor de `/panel-contable/*`
 * junto con `DiferenciaPanel.vue` (slice `liquidaciones`) para el endpoint
 * `/panel-contable/diferencia`.
 */

/** Tipo de dato del panel: preliquidación (estimado) u oficial (real). */
export enum TipoPanel {
  PRELIQUIDACION = 'preliquidacion',
  OFICIAL = 'oficial',
}

/** Tipo de liquidación de un proyecto: define cómo se leen sus ingresos del ER. */
export enum TipoLiquidacion {
  NORMAL = 'normal',
  NEU = 'neu',
  NITRO = 'nitro',
}

/** Grupo contable de una línea del panel. */
export enum GrupoLinea {
  INGRESOS = 'ingresos',
  COMERCIALIZACION = 'comercializacion',
  COSTOS = 'costos',
  FACTURAS = 'facturas',
}

/**
 * De dónde sale un valor que NO viene de una celda del ER: un módulo o tarifa
 * de la app. `api` marca lo que viene de la API de Liquidaciones (panel armado
 * "Desde API", no Excel).
 */
export enum FuenteLinea {
  OM = 'om',
  ARRIENDOS = 'arriendos',
  INTERNET = 'internet',
  SERVICIOS = 'servicios',
  OPERACION = 'operacion',
  STARLINK = 'starlink',
  API = 'api',
}

/** Con qué se armó un panel. Los ingresos no tienen columna `fuente`; esto es lo único que lo distingue. */
export enum OrigenPanel {
  API = 'api',
  EXCEL = 'excel',
}

/** Pestaña activa del Panel Contable. */
export enum TabPanelContable {
  PRELIQUIDACION = 'preliquidacion',
  OFICIAL = 'oficial',
  SELECCION = 'seleccion',
  DIFERENCIA = 'diferencia',
  CLASIFICACION = 'clasificacion',
}

/** Filtro de estado de liquidación de la lista de proyectos. */
export enum FiltroEstadoLiquidacion {
  LIQUIDA = 'liquida',
  NO_LIQUIDA = 'no',
  SOLO_INGRESOS = 'solo_ing',
  SOLO_COSTOS = 'solo_cost',
  GENERA_MANDATOS = 'genera',
}

/** Filtro por marcador de la lista de proyectos. */
export enum FiltroMarcador {
  CON_COSTOS = 'con_costos',
  SIN_COSTOS = 'sin_costos',
  BOLSA = 'bolsa',
}

/** Documento contable: agrupa grupos de línea para el filtro y el export a Excel. */
export enum DocumentoContable {
  MANDATO = 'mandato',
  COSTOS = 'costos',
  FACTURA = 'factura',
}

export interface SoporteLinea {
  archivo_url?: string
  archivo_nombre?: string
}

export interface LineaPanel {
  id: number
  grupo: GrupoLinea
  concepto: string
  valor_cop?: number
  comprobante_contable?: string
  /** Celda de origen del ER, formato `hoja!celda` (solo ingresos/comercialización). */
  hoja?: string
  celda?: string
  /** `columna_origen`: identifica la celda de origen para remapear/renombrar. */
  origen?: string
  /** Impuesto u otro valor calculado a partir de otras líneas, no editable. */
  derivada?: boolean
  /** Presente cuando el valor viene de un módulo/tarifa de la app, no de una celda del ER. */
  fuente?: FuenteLinea
  soporte?: SoporteLinea | null
}

export interface InversionistaPanel {
  proyecto_inversionista_id?: number
  nombre?: string
  porcentaje?: number
  lineas: LineaPanel[]
}

/** Una fila del panel contable: un proyecto en un período. */
export interface PanelContable {
  id: number
  proyecto: string
  proyecto_nombre?: string
  proyecto_id: number
  generar_mandatos?: boolean
  liquidar_ingresos?: boolean
  liquidar_costos?: boolean
  consecutivo_ingresos?: number | null
  consecutivo_costos?: number | null
  tiene_costos?: boolean
  tiene_bolsa?: boolean
  ingreso_bruto_cop?: number
  /** Con qué se armó: API de Liquidaciones o Excel del ER. Los ingresos no traen esta columna. */
  origen?: OrigenPanel
  inversionistas: InversionistaPanel[]
  total_100: LineaPanel[]
}

export interface RespuestaPaneles {
  paneles: PanelContable[]
}

export interface OmitidoArmado {
  proyecto: string
  motivo: string
}

export interface AvisoArmado {
  proyecto: string
  avisos: string[]
}

export interface RespuestaArmarPeriodo {
  armados: number
  omitidos: OmitidoArmado[]
  sin_cruce: string[]
  avisos: AvisoArmado[]
}

export interface ConsecutivoInfo {
  usados: number[]
  siguiente: number
}

export interface RespuestaConsecutivosUsados {
  ingresos: ConsecutivoInfo
  costos: ConsecutivoInfo
}

export interface ClasificacionProyecto {
  proyecto_id: number
  proyecto?: string
  tipo: TipoLiquidacion
}

export interface RespuestaClasificacion {
  proyectos: ClasificacionProyecto[]
}

export interface PayloadClasificacion {
  periodo: string
  asignaciones: { proyecto_id: number; tipo: TipoLiquidacion }[]
}

export interface PanelAsignado {
  panel_id: number
  consecutivo_ingresos?: number
  consecutivo_costos?: number
}

export interface RespuestaReasignarConsecutivos {
  asignados: PanelAsignado[]
}

export interface RechazoEr {
  mensaje: string
}

export interface RespuestaCargarEr {
  cargados?: unknown[]
  sin_match?: string[]
  rechazados?: RechazoEr[]
  errores?: unknown[]
}

export interface FiltrosPanel {
  periodo: string
  tipo: TipoPanel
}

export interface DiferenciaContraste {
  grupo: string
  concepto: string
  excel: number | null
  api: number | null
  diferencia: number
}

export interface ContrasteProyecto {
  proyecto: string
  diferencias: DiferenciaContraste[]
}

/** `GET /panel-contable/contraste`: compara lo que daría la API contra lo que hay hoy. No guarda nada. */
export interface RespuestaContraste {
  periodo: string
  paneles: number
  cuadran_exacto: number
  proyectos: ContrasteProyecto[]
}

export interface LineaDiferencia {
  grupo: GrupoLinea
  concepto: string
  preliquidacion: number
  oficial: number | null
  diferencia: number | null
  pct_variacion: number | null
}

export interface InversionistaDiferencia {
  proyecto_inversionista_id?: number
  nombre: string
  porcentaje?: number
  lineas: LineaDiferencia[]
  utilidad_pre: number
  utilidad_oficial: number | null
  utilidad_dif: number | null
}

export interface ProyectoDiferencia {
  proyecto_id: number
  proyecto_nombre: string
  tiene_oficial: boolean
  utilidad_pre: number
  utilidad_oficial: number | null
  utilidad_dif: number | null
  inversionistas: InversionistaDiferencia[]
}

/**
 * `GET /panel-contable/diferencia`: preliquidación vs oficial, por proyecto.
 * Forma verificada también contra `DiferenciaPanel.vue` (slice `liquidaciones`),
 * el otro consumidor de este mismo endpoint.
 */
export interface RespuestaDiferencia {
  proyectos: ProyectoDiferencia[]
  resumen: Record<string, unknown>
  tiene_oficial: boolean
}
