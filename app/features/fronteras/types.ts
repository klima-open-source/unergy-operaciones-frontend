/**
 * La frontera comercial: el punto de medida registrado ante XM.
 *
 * Es la unidad de medición del mercado — sin frontera, la energía de una planta
 * no se puede transar ni liquidar. Vive en este slice y no en `~/types/` porque
 * fuera de aquí solo se la nombra por su `id`.
 *
 * **Verificado contra `FronterasView.vue`, `ReporteEnergiaAutomatizacionView.vue`
 * y `ReporteEnergiaDetalleTab.vue`.**
 */
import type { FechaISO, Id } from '~/types/api'

/**
 * Cada frontera lleva medidor **principal** y **respaldo**: si el principal deja
 * de reportar, XM lee el otro. Los dos tienen la misma forma, de ahí el sufijo.
 */
export interface CanalMedidor {
  nro_serie: string | null
  ip_modem: string | null
  puerto_modem: number | null
  password_medidor: string | null
  canal_comunicacion: string | null
  tipo_extraccion: string | null
}

export interface Frontera {
  id: Id
  /** El código con el que XM la conoce. Es su identidad ante el mercado. */
  codigo_frontera: string
  nombre_frontera: string | null
  /** `generacion` | `consumo` | `generacion_consumo` | `consumo_auxiliar` | `consumo_propio`. */
  tipo_frontera: string | null
  estado: string | null

  proyecto_id: Id | null
  /** Desnormalizado por el backend para poder listar sin una segunda consulta. */
  proyecto_nombre: string | null

  operador_red_id: Id | null
  operador_red: string | null
  /** Quién representa la frontera ante el mercado. */
  operador_comercial: string | null

  municipio: string | null
  capacidad_efectiva_mw: number | null
  fecha_registro_asic: FechaISO | null

  /** Si está inyectando ahora mismo. Lo calcula el backend contra el monitoreo. */
  generando_actual: boolean | null

  // ── Medidor principal ─────────────────────────────────────────────────────
  nro_serie_med_ppal: string | null
  ip_modem_ppal: string | null
  puerto_modem_ppal: number | null
  password_medidor_ppal: string | null
  canal_comunicacion_ppal: string | null
  tipo_extraccion_ppal: string | null

  // ── Medidor de respaldo ───────────────────────────────────────────────────
  nro_serie_med_resp: string | null
  ip_modem_resp: string | null
  puerto_modem_resp: number | null
  password_medidor_resp: string | null
  canal_comunicacion_resp: string | null
  tipo_extraccion_resp: string | null
}

/** Cuerpo de creación/edición: mismos campos que `Frontera` menos lo que resuelve el backend. */
export interface PayloadFrontera {
  proyecto_id?: Id | null
  codigo_frontera?: string | null
  nombre_frontera?: string | null
  tipo_frontera?: string | null
  estado?: string | null
  operador_red_id?: Id | null
  tipo_extraccion_ppal?: string | null
  password_medidor_ppal?: string | null
  ip_modem_ppal?: string | null
  puerto_modem_ppal?: number | null
  canal_comunicacion_ppal?: string | null
  tipo_extraccion_resp?: string | null
  password_medidor_resp?: string | null
  ip_modem_resp?: string | null
  puerto_modem_resp?: number | null
  canal_comunicacion_resp?: string | null
}

/** Frontera detectada en Quoia (el CGM) que todavía no tiene fila propia aquí. */
export interface FronteraPendienteQuoia {
  frt_code: string
  nombre_quoia: string
  categoria: string
  proyecto_sugerido_id?: Id | null
}

// ── `/reporte-energia/*` — clasificación diaria y envío del reporte a XM ──────

export interface ResumenReporteEnergiaDia {
  puede_enviar?: boolean
  [clave: string]: unknown
}

export interface FilaReporteEnergia {
  frontera_id: number
  nombre_proyecto?: string
  tipo?: 'generacion' | 'consumo'
  caso?: string | number
  revisar_manualmente?: boolean
  [clave: string]: unknown
}

/**
 * `GET/PATCH /reporte-energia/fronteras/:id`: el resultado de clasificar un día
 * para una frontera — curvas de las distintas fuentes candidatas, cuál se usó,
 * y qué horas se rellenaron y con qué. Forma libre en los sub-bloques que no se
 * leen campo a campo desde la vista.
 */
export interface DetalleReporteEnergia {
  frontera_id: number
  proyecto_id: number | null
  nombre_proyecto?: string
  fecha: string
  tipo: 'generacion' | 'consumo'
  caso: string | number
  medidor_usado?: string
  revisar_manualmente?: boolean
  estado_reporte?: string | null
  energia_final_kwh?: number | null
  energia_cgm_kwh?: number | null
  // Mediana histórica de la frontera y días que la sostienen -- el criterio
  // contra el que se compara el día para marcar revisión en Consumo.
  mediana_historica_kwh?: number | null
  dias_historial?: number | null
  fp?: number | null
  curva_final?: (number | null)[]
  curva_medidor_principal?: (number | null)[]
  curva_medidor_respaldo?: (number | null)[]
  curva_solenium?: (number | null)[]
  curva_reconectador?: (number | null)[]
  curva_respaldo_reportada?: (number | null)[]
  horas_rellenadas_medidor_cruzado?: number[]
  horas_rellenadas_reconectador?: number[]
  horas_rellenadas_solenium?: number[]
  horas_rellenadas_historico?: number[]
  respaldo_reportado_origen?: string | null
  principal_actualizado_en_quoia?: boolean
  respaldo_actualizado_en_quoia?: boolean
  principal_energia_actual_kwh?: number | null
  respaldo_energia_actual_kwh?: number | null
  principal_curva_actual?: (number | null)[]
  respaldo_curva_actual?: (number | null)[]
  solenium_completo?: boolean
  nota_solenium?: string | null
  error_final_pct?: number | null
  error_clasificacion?: string | null
  recuperacion_datos?: string | null
  capacidad_efectiva_mw?: number | null
  editado_manualmente?: boolean
  [clave: string]: unknown
}

export interface PayloadGuardarCurva {
  curva_final: (number | null)[]
  fuente: string | null
  curva_respaldo_final?: (number | null)[]
}

/** `GET /curva-tipica`: mediana histórica, usada como una de las fuentes alternativas al reportar. */
export interface CurvaTipica {
  curva?: (number | null)[]
  energia_total_kwh?: number | null
  dias_usados?: number
}

export interface ExclusionReporteEnergia {
  id: number
  frontera_id: number
  motivo: string
  fecha_inicio: string
  fecha_fin_estimada?: string | null
  resuelta_en?: string | null
  creado_por?: string | null
  created_at: string
}

export interface PayloadCrearExclusion {
  frontera_id: number
  motivo: string
  fecha_inicio: string
  fecha_fin_estimada?: string | null
}

export interface PayloadActualizarExclusion {
  motivo: string
  fecha_fin_estimada?: string | null
}

export interface RespuestaCargaExcelTerceros {
  fechas_cargadas: string[]
}

export interface EstadoEjecucionReporteEnergia {
  error_general?: string | null
  cancelado?: boolean
  fallidas: string[]
}

export interface ResultadoEnvioReporteEnergia {
  bloqueado?: boolean
  motivo_bloqueo?: string
  enviados: number
  fallidos: string[]
}

export interface FronteraFallidaQuoia {
  frontera_id: number
  tipo: 'generacion' | 'consumo'
  nombre_proyecto?: string
}

/** `GET/POST /estado-quoia`: si XM ya resolvió (aprobó/rechazó) lo que ya se envió ese día. */
export interface EstadoQuoiaReporte {
  total: number
  en_espera: number
  exitoso: number
  exitoso_con_alerta: number
  error: number
  fallidas: FronteraFallidaQuoia[]
}

/** `GET /resumen-historico`: patrones agregados de fuente/calidad de dato en un rango de fechas. */
export interface ResumenHistoricoReporteEnergia {
  distribucion_fuente_generacion: { etiqueta: string; total: number }[]
  distribucion_fuente_consumo: { etiqueta: string; total: number }[]
  detalle_fuente_generacion: {
    grupo: string
    frontera_id: number
    dias_grupo: number
    [clave: string]: unknown
  }[]
  detalle_fuente_consumo: {
    grupo: string
    frontera_id: number
    dias_grupo: number
    [clave: string]: unknown
  }[]
  incompletos: Record<string, unknown>[]
  incompletos_callouts: { etiqueta: string; valor: unknown }[]
}
