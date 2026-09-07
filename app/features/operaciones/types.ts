/**
 * Forma verificada contra las vistas de `operaciones`: `GeneracionView.vue`,
 * `GestionFallasView.vue`, `InformeOMView.vue`, `EvidenciaUploader.vue`,
 * `InformeDetailView.vue`, `InformesListView.vue`, `InformesMensualesView.vue`,
 * `EnvioMensualPanel.vue`, `InformesMensualesPanel.vue`,
 * `PortafoliosGestionPanel.vue` y `PolizasView.vue`.
 */

// ── `/monitoreo/_legacy` — gateway genérico a los endpoints de monitoreo viejos ─

export type AccionMonitoreoLegacy =
  'getProjects' | 'getGeneration' | 'getFMOData' | 'getPortfolios' | 'getAllContratos'

export interface ProyectoMonitoreoLegacy {
  sub_project: string
  nombre_comercial?: string
  nombre_display?: string
  nombre_clientes?: string
  [clave: string]: unknown
}

/** `getProjects`. */
export interface RespuestaProyectosLegacy {
  projects: ProyectoMonitoreoLegacy[]
}

/** `getGeneration`: la serie diaria y, si el backend simuló, el P90 mensual. */
export interface RespuestaGeneracionLegacy {
  ok?: boolean
  data: { fecha?: string; kwh: number; [clave: string]: unknown }[]
  simulation?: { p90_monthly?: number | null; [clave: string]: unknown }
  [clave: string]: unknown
}

/** `getFMOData`: datos de inversores en vivo, forma variable. */
export interface RespuestaFmoLegacy {
  [clave: string]: unknown
}

/** `getPortfolios`: `portfolios` mapea `{ [nombrePortafolio]: subProjects[] }`. */
export interface RespuestaPortafoliosLegacy {
  ok?: boolean
  portfolios: Record<string, string[]>
}

export interface ContratoLegacy {
  sub_project: string
  [clave: string]: unknown
}

/** `getAllContratos`. */
export interface RespuestaContratosLegacy {
  ok?: boolean
  contratos: ContratoLegacy[]
}

// ── `/informe-om/*` — informe de puesta en marcha ─────────────────────────────

export interface ProyectoInformeOm {
  id: number
  nombre_comercial?: string
  [clave: string]: unknown
}

/**
 * El formulario del informe O&M: decenas de campos anidados por sección
 * (objetivo/alcance, datos generales, checklists por sistema…). No se modela
 * campo a campo — la vista arma y desarma el objeto completo contra esta forma
 * libre; lo único que se afirma es la forma de nivel superior.
 */
export interface FichaInformeOm {
  objetivo_alcance?: Record<string, unknown>
  datos_generales?: Record<string, unknown>
  arquitectura_comunicacion?: Record<string, unknown>
  configuracion_monitoreo?: {
    notificaciones?: unknown[]
    umbrales_alarma?: unknown[]
    politicas_datos?: unknown[]
    [clave: string]: unknown
  }
  observaciones?: Record<string, unknown>
  checklist_fusion_solar?: {
    starlink?: Record<string, unknown>
    datos_coherentes?: Record<string, unknown>
    inversores?: { id: number; nombre?: string; limitado?: boolean; motivo_limitacion?: string }[]
    [clave: string]: unknown
  }
  checklist_frontera?: {
    principal?: Record<string, unknown>
    respaldo?: Record<string, unknown>
    [clave: string]: unknown
  }
  checklist_estacion_meteo?: Record<string, unknown>
  checklist_reconectador?: {
    en_plataforma?: Record<string, unknown>
    calidad_datos?: Record<string, unknown>
    [clave: string]: unknown
  }
  [clave: string]: unknown
}

export interface InversorInformeOm {
  id: number
  nombre?: string
  [clave: string]: unknown
}

/** `GET /informe-om/:id`. */
export interface DetalleInformeOm {
  ficha: FichaInformeOm
  inversores?: InversorInformeOm[]
  [clave: string]: unknown
}

export interface ArchivoEvidencia {
  id: number
  nombre?: string
  url?: string
  [clave: string]: unknown
}

// ── `/informes/*` — informes mensuales (operacionales, FMO, portafolio) ──────

export type TipoInforme = 'op' | 'fmo' | 'port' | string
export type EstadoInforme = 'borrador' | 'revisado' | 'aprobado' | string

export interface ComentarioInforme {
  id: number
  mensaje: string
  resuelto?: boolean
  respuesta?: string | null
  resuelto_por_nombre?: string
  resuelto_por_email?: string
  resuelto_en?: string
  [clave: string]: unknown
}

/** `GET /informes/:id` (y su forma resumida en el listado). */
export interface Informe {
  id: number
  tipo: TipoInforme
  sub_project?: string
  proyecto_nombre?: string
  periodo_desde?: string
  periodo_hasta?: string
  periodo_display?: string
  html_content?: string
  estado?: EstadoInforme
  correo_enviado?: boolean
  comentarios?: ComentarioInforme[]
  [clave: string]: unknown
}

export interface PayloadGuardarInforme {
  tipo: TipoInforme
  sub_project: string
  periodo_desde: string
  periodo_hasta: string
  periodo_display: string
  proyecto_nombre: string
  html_content: string
}

export interface FiltrosListaInformes {
  tipo?: string
  sub_project?: string
  limit?: number
  periodo_desde_gte?: string
  periodo_desde_lte?: string
}

export interface RespuestaCompuestoInforme {
  [clave: string]: unknown
}

export interface RespuestaEnviarInforme {
  enviado_a?: string
  [clave: string]: unknown
}

// ── `/portafolios/*` ───────────────────────────────────────────────────────────

export interface ProyectoPortafolio {
  id: number
  nombre?: string
  [clave: string]: unknown
}

export interface Portafolio {
  id: number
  nombre: string
  proyectos: ProyectoPortafolio[]
}

/** `GET /portafolios`. */
export interface RespuestaPortafolios {
  portafolios: Portafolio[]
  sin_portafolio?: ProyectoPortafolio[]
}

// ── `/polizas/*` ───────────────────────────────────────────────────────────────

/** `GET/PUT /polizas`: una fila por proyecto. */
export interface Poliza {
  proyecto_id: number
  numero_poliza?: string | null
  poliza_om?: string | null
  fecha_vencimiento?: string | null
  valor_poliza?: number | null
  mano_obra?: number | null
  estructura?: number | null
  paneles?: number | null
  inversores?: number | null
  otros?: number | null
  link_estudio_suelos?: string | null
  ipp_base?: number | null
  ipp_base_fecha?: string | null
  ipp_provisional?: number | null
  ipp_provisional_fecha?: string | null
  tarifa_base?: number | null
  generacion_anual_p90_kwh?: number | null
  [clave: string]: unknown
}

export type PayloadPoliza = Partial<Omit<Poliza, 'proyecto_id'>>
