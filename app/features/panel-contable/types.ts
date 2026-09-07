/**
 * Forma verificada contra `PanelContableView.vue`, único consumidor de
 * `/panel-contable/*`.
 */

export interface LineaPanel {
  id: number
  grupo: string
  concepto: string
  valor_cop?: number
  comprobante_contable?: string
  hoja?: string
  celda?: string
  origen?: string
  soporte?: { archivo_url?: string; archivo_nombre?: string } | null
  [clave: string]: unknown
}

export interface InversionistaPanel {
  proyecto_inversionista_id?: number
  nombre?: string
  lineas: LineaPanel[]
  [clave: string]: unknown
}

/** Una fila del panel contable: un proyecto en un período. */
export interface PanelContable {
  id: number
  proyecto: string
  proyecto_nombre?: string
  proyecto_id?: number
  generar_mandatos?: boolean
  liquidar_ingresos?: boolean
  liquidar_costos?: boolean
  consecutivo_ingresos?: number | null
  consecutivo_costos?: number | null
  inversionistas: InversionistaPanel[]
  total_100: LineaPanel[]
  [clave: string]: unknown
}

export interface RespuestaPaneles {
  paneles: PanelContable[]
  [clave: string]: unknown
}

export interface RespuestaArmarPeriodo {
  armados: number
  omitidos: string[]
  [clave: string]: unknown
}

export interface ConsecutivoInfo {
  usados: number
  siguiente: number
  [clave: string]: unknown
}

export interface RespuestaConsecutivosUsados {
  ingresos: ConsecutivoInfo
  costos: ConsecutivoInfo
  [clave: string]: unknown
}

export interface ClasificacionProyecto {
  proyecto_id: number
  proyecto?: string
  tipo: string
  [clave: string]: unknown
}

export interface RespuestaClasificacion {
  proyectos: ClasificacionProyecto[]
  [clave: string]: unknown
}

export interface PayloadClasificacion {
  periodo: string
  asignaciones: { proyecto_id: number; tipo: string }[]
}

export interface RespuestaReasignarConsecutivos {
  asignados: { panel_id: number; consecutivo_ingresos?: number; consecutivo_costos?: number }[]
  [clave: string]: unknown
}

export interface RespuestaCargarEr {
  cargados?: unknown[]
  sin_match?: string[]
  rechazados?: unknown[]
  errores?: unknown[]
  [clave: string]: unknown
}

export interface FiltrosPanel {
  periodo: string
  tipo: string
}

/** Forma variable — la vista solo la muestra, no opera sobre campos puntuales. */
export interface RespuestaContraste {
  [clave: string]: unknown
}

/**
 * `GET /panel-contable/diferencia`: preliquidación vs oficial, por proyecto.
 * Forma verificada contra `DiferenciaPanel.vue` (slice `liquidaciones`), el
 * otro consumidor de este mismo endpoint.
 */
export interface RespuestaDiferencia {
  proyectos: unknown[]
  resumen: Record<string, unknown>
  tiene_oficial: boolean
}
