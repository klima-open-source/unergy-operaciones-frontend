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

  /**
   * Ubicacion y capacidad son del PROYECTO, con el prefijo que lo dice.
   *
   * `fronteras` tenia sus propias columnas `municipio`, `departamento` y
   * `capacidad_efectiva_mw`; se eliminaron el 2026-08-25 porque duplicaban el
   * dato del proyecto (52 de 53 fronteras de generacion tenian la capacidad
   * identica a `potencia_ac_kw`, solo con la conversion kWp->MW; ver
   * `app/schemas/fronteras.py`). Este tipo siguio declarandolas, asi que
   * `FronterasView` podia leer `f.municipio` y `f.capacidad_efectiva_mw` --
   * claves que ya no llegan -- sin que el typecheck dijera nada: las dos
   * columnas mostraban "—" en todas las filas y la capacidad total daba 0.
   */
  proyecto_municipio: string | null
  proyecto_departamento: string | null
  /** kWp del proyecto convertidos a MW por el backend. */
  proyecto_potencia_instalada_mw: number | null
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

/** 409 estructurado de `POST /fronteras` y `.../quoia/pendientes/:frt/confirmar`: nombre parecido a una frontera existente. */
export interface DuplicadoFrontera {
  duplicado_nombre: true
  candidato_id: number
  candidato_nombre: string
  /** Solo en el flujo de confirmar pendiente de Quoia. */
  mensaje?: string
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
  /** Curva en vivo de Quoia (no persistida) — solo para ofrecerla en "Reportar con otra fuente". */
  curva_cgm?: (number | null)[] | null
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

export enum TipoFronteraReporte {
  GENERACION = 'generacion',
  CONSUMO = 'consumo',
}

/**
 * Grupo de fuente de un día NO automático, como lo agrupa el backend
 * (`_GRUPO_FUENTE_GENERACION` / `_GRUPO_FUENTE_CONSUMO`). `CGM` no aparece en
 * un día no automático, pero el backend puede mandarlo en `fuente_dominante`
 * si el vocabulario cambia -- por eso está.
 */
export enum GrupoFuenteReporte {
  CGM = 'cgm',
  MEDIDOR = 'medidor',
  INVERSOR = 'inversor',
  TERCEROS = 'terceros',
  ESTIMACION = 'estimacion',
  APAGADO = 'apagado',
  SIN_FUENTE = 'sin_fuente',
  OTRO = 'otro',
}

export interface DiaResumenVentana {
  fecha: string
  automatico: boolean
  /** Fuera de la tasa: el clasificador no hizo su trabajo ese día, o se excluyó a mano. */
  excluido: boolean
  /** Solo cuando no fue automático ni excluido. */
  grupo_fuente: GrupoFuenteReporte | null
  etiqueta_fuente: string | null
}

export interface DesgloseFuenteResumen {
  grupo: GrupoFuenteReporte
  etiqueta: string
  dias: number
}

export interface FilaResumenVentana {
  frontera_id: number
  tipo: TipoFronteraReporte
  nombre_proyecto: string
  codigo_frontera: string | null
  dias_automaticos: number
  dias_no_automaticos: number
  tasa: number
  /** Tuvo filas en el período anterior y ninguna en este: dejó de aparecer. */
  nunca_clasificado: boolean
  fuente_dominante: GrupoFuenteReporte | null
  fuente_dominante_etiqueta: string | null
  desglose_fuente: DesgloseFuenteResumen[]
  fechas_excluidas: string[]
  dias: DiaResumenVentana[]
}

export interface KpisResumenVentana {
  tasa_general: number
  dias_automaticos_totales: number
  dias_totales: number
  siempre_automatico: number
  nunca_automatico: number
  /** Contra el período anterior de igual duración, por más de 2 días automáticos. */
  mejoraron: number
  empeoraron: number
}

/**
 * `GET /resumen-historico`: una fila por frontera+tipo en `[desde, hasta]`, la
 * peor primero, más los KPIs del período.
 */
export interface ResumenVentanaReporteEnergia {
  desde: string
  hasta: string
  filas: FilaResumenVentana[]
  kpis: KpisResumenVentana
}
