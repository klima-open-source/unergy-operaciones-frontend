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
  /** Respaldo legacy — `EnvioMensualPanel.vue`/`InformesMensualesPanel.vue` lo usan si no hay `sub_project`/`nombre_comercial`. */
  name?: string
  /** Alias usado por `InformesMensualesPanel.vue` para cruzar portafolios/ranking por nombre. */
  nombre_bitacora?: string
  municipio?: string
  [clave: string]: unknown
}

/** `getProjects`. */
export interface RespuestaProyectosLegacy {
  projects: ProyectoMonitoreoLegacy[]
}

/** `getGeneration`: la serie diaria y, si el backend simuló, el P90/P50 mensual y el P90 diario. */
export interface RespuestaGeneracionLegacy {
  ok?: boolean
  // MIGRACIÓN (slice `liquidaciones`) — el campo real que trae cada punto es
  // `date` (así lo consume `GeneracionView.vue`, sin migrar todavía); `fecha`
  // quedaba declarado sin que nada lo usara. Se agrega `date` en vez de
  // reemplazarlo por si algún consumidor futuro sí recibe `fecha`.
  data: {
    fecha?: string
    date?: string
    kwh: number
    /** Hora del punto (`HH:MM…`) — `InformesMensualesPanel.vue` la usa para inferir disponibilidad en franja solar. */
    time?: string
    [clave: string]: unknown
  }[]
  simulation?: {
    p90_monthly?: number | null
    p50_monthly?: number | null
    /** P90 a nivel diario (no mensual) — usado para la línea de referencia del gráfico diario. */
    p90_daily?: number | null
    [clave: string]: unknown
  }
  /**
   * De dónde salió la curva. `verified_by_operator` es un campo de la API de
   * Unergy que marca las lecturas que alguien revisó; cuando una planta no
   * tiene ninguna, el backend cae a las crudas. No son el mismo dato.
   */
  fuente?: 'verificada' | 'cruda' | 'sin_datos'
  [clave: string]: unknown
}

/** Datos de un inversor tal como los expone `getFMOData` — forma variable según el fabricante/plataforma de monitoreo. */
export interface InversorFmoLegacy {
  name?: string
  nombre?: string
  inverter_name?: string
  sn?: string
  serial_number?: string
  serial?: string
  nominal_power?: number | string
  capacity?: number | string
  potencia_nominal?: number | string
  power_kw?: number | string
  status?: string | number
  estado?: string | number
  alarm_status?: string | number
  active_power?: number | string
  power?: number | string
  potencia?: number | string
  pac?: number | string
  [clave: string]: unknown
}

/** El contrato O&M asociado al proyecto, tal como lo devuelve `getFMOData`. */
export interface ContratoFmoLegacy {
  contratista?: string
  disponibilidad_garantizada_pct?: string | number | null
  valor_estimado_ano1_cop?: string | number | null
  garantias_equipos?: string
  [clave: string]: unknown
}

/** `getFMOData`: datos de inversores en vivo, forma variable. */
export interface RespuestaFmoLegacy {
  contrato?: ContratoFmoLegacy | null
  inverters?: InversorFmoLegacy[]
  inverters_error?: string
  [clave: string]: unknown
}

/** `getPortfolios`: `portfolios` mapea `{ [nombrePortafolio]: subProjects[] }`. */
export interface RespuestaPortafoliosLegacy {
  ok?: boolean
  portfolios: Record<string, string[]>
}

export interface ContratoLegacy {
  sub_project: string
  /**
   * Mismo gateway legacy que `ProyectoMonitoreoLegacy` (`getProjects`) — un
   * contrato FMO cae al proyecto en operación cuando no aparece en
   * `getAllContratos` (ver `InformesMensualesPanel.vue`), así que comparte sus
   * mismas etiquetas de nombre/ubicación.
   */
  nombre_comercial?: string
  nombre_display?: string
  nombre_clientes?: string
  nombre_bitacora?: string
  municipio?: string
  [clave: string]: unknown
}

/** `getAllContratos`. */
export interface RespuestaContratosLegacy {
  ok?: boolean
  contratos: ContratoLegacy[]
}

// ── `/informe-om/*` — informe de puesta en marcha ─────────────────────────────

/** Estado global de un proyecto/checklist frente al sistema de monitoreo. */
export type EstadoGlobalOm = 'atencion' | 'operativo'
/** Estado de aprobación de un ítem de checklist — `null` es "sin revisar todavía". */
export type EstadoChecklistOm = 'aprobado' | 'pendiente' | null

export interface ProyectoInformeOm {
  id: number
  nombre_comercial?: string
  municipio?: string
  departamento?: string
  potencia_ac_kw?: number | null
  /** `false` cuando el proyecto todavía no tiene ficha creada — la lista lo muestra como "Sin iniciar". */
  tiene_ficha?: boolean
  estado_global?: EstadoGlobalOm
  [clave: string]: unknown
}

export interface ChecklistItemOm {
  estado: EstadoChecklistOm
  nota: string
}

export interface ChecklistItemConEvidenciaOm extends ChecklistItemOm {
  evidencia: ArchivoEvidencia[]
}

export interface InversorFichaFusionSolarOm {
  id: number
  nombre?: string
  limitado: boolean
  motivo_limitacion: string
}

export interface EquipoOm {
  descripcion: string
  marca: string
  cantidad: number
  ubicacion: string
  numero_serie: string
}

export interface VariableMonitoreadaOm {
  variable: string
  unidad: string
  fuente: string
  registro: string
  plataforma: string
}

export interface NotificacionMonitoreoOm {
  rol: string
  nombre: string
  canal: string
  alcance: string
}

export interface UmbralAlarmaOm {
  evento: string
  condicion: string
  notificacion: string
  destinatarios: string
}

export type ResultadoPruebaOm = 'conforme' | 'no_conforme' | 'na' | ''

export interface PruebaOm {
  codigo: string
  prueba: string
  criterio_aceptacion: string
  resultado: ResultadoPruebaOm
  observacion: string
}

export type EstadoEventoOperativoOm = 'abierta' | 'en_gestion' | 'cerrada' | ''

export interface EventoOperativoOm {
  codigo: string
  descripcion: string
  causa_raiz: string
  accion_correctiva: string
  estado: EstadoEventoOperativoOm
}

export type EstadoPendienteOm = 'abierto' | 'en_gestion' | 'cerrado' | ''

export interface PendienteOm {
  descripcion: string
  responsable: string
  /** `''` = sin fecha — `Input` de shadcn no acepta `null` en su `v-model`. */
  fecha_compromiso: string
  clasificacion?: string
  estado: EstadoPendienteOm
  observaciones?: string
}

export interface FirmanteOm {
  nombre: string
  cargo: string
  /** `''` = sin fecha — `Input` de shadcn no acepta `null` en su `v-model`. */
  fecha: string
}

export type EstadoFichaOm = 'borrador' | 'en_revision' | 'aprobado'

/**
 * El formulario del informe O&M: decenas de campos anidados por sección
 * (objetivo/alcance, datos generales, checklists por sistema…). Modelado campo
 * a campo — es lo que arma/edita `InformeOMView.vue` — con todo opcional
 * porque un proyecto sin ficha todavía devuelve `{}` desde el backend.
 */
export interface FichaInformeOm {
  version?: string
  elaborado_por?: string
  actividad?: string
  estado?: EstadoFichaOm
  empresa_contratista?: string
  fecha_energizacion?: string
  fecha_inicio_operacion?: string
  pendientes?: PendienteOm[]
  checklist_fusion_solar?: {
    starlink?: ChecklistItemConEvidenciaOm
    datos_coherentes?: ChecklistItemOm
    evidencia?: ArchivoEvidencia[]
    nota?: string
    inversores?: InversorFichaFusionSolarOm[]
  }
  checklist_frontera?: {
    principal?: ChecklistItemConEvidenciaOm
    respaldo?: ChecklistItemConEvidenciaOm
  }
  checklist_estacion_meteo?: {
    instalacion?: ChecklistItemOm
    en_plataforma?: ChecklistItemOm
    reporta_datos?: ChecklistItemConEvidenciaOm
    poa?: ChecklistItemOm
    temperatura_ambiente?: ChecklistItemOm
    velocidad_viento?: ChecklistItemOm
    direccion_viento?: ChecklistItemOm
  }
  checklist_reconectador?: {
    tiene?: boolean | null
    en_plataforma?: ChecklistItemOm
    calidad_datos?: ChecklistItemOm
    evidencia?: ArchivoEvidencia[]
    nota?: string
  }
  objetivo_alcance?: { objetivo?: string; alcance_items?: string[] }
  datos_generales?: {
    seguidores_marca?: string
    medida_comercial_marca?: string
    medida_comercial_modelo?: string
    plataformas_monitoreo?: string[]
    responsable_nombre?: string
    responsable_email?: string
  }
  arquitectura_comunicacion?: {
    enlace_principal?: string
    enlaces_celulares?: string
    concentrador_datos?: string
    destino_datos?: string
    sincronizacion_horaria?: string
  }
  equipos?: EquipoOm[]
  variables_monitoreadas?: VariableMonitoreadaOm[]
  configuracion_monitoreo?: {
    notificaciones?: NotificacionMonitoreoOm[]
    umbrales_alarma?: UmbralAlarmaOm[]
    politicas_datos?: string[]
  }
  protocolo_pruebas?: PruebaOm[]
  eventos_operativos?: EventoOperativoOm[]
  observaciones?: { generales?: string; factor_pendiente?: string }
  recomendaciones?: string[]
  conclusion?: string
  firmas?: FirmanteOm[]
  evidencia_arquitectura?: ArchivoEvidencia[]
  [clave: string]: unknown
}

export interface InversorInformeOm {
  id: number
  nombre?: string
  potencia_nominal_kw?: number | null
  state?: string | null
  [clave: string]: unknown
}

export interface EvidenciaRelacionadaOm {
  seccion: string
  nombre: string
  url: string
}

export interface ProyectoDetalleInformeOm {
  nombre_comercial?: string
  nombre_clientes?: string
  municipio?: string
  departamento?: string
  direccion_vereda?: string
  potencia_ac_kw?: number | null
  [clave: string]: unknown
}

export interface KpisInformeOm {
  pruebas_ejecutadas: number
  pruebas_conformes: number
  pruebas_no_conformes: number
  eventos_total: number
  eventos_cerrados: number
  eventos_en_gestion: number
  checklist_aprobados: number
  checklist_total: number
  estado_global: EstadoGlobalOm
}

/** `GET /informe-om/:id`. */
export interface DetalleInformeOm {
  proyecto: ProyectoDetalleInformeOm
  ficha: FichaInformeOm
  kpis: KpisInformeOm
  inversores: InversorInformeOm[]
  evidencia_relacionada: EvidenciaRelacionadaOm[]
  fusion_solar_estado?: EstadoChecklistOm
  frontera_estado?: EstadoChecklistOm
  estacion_meteo_estado?: EstadoChecklistOm
  reconectador_estado?: EstadoChecklistOm
  [clave: string]: unknown
}

export interface ArchivoEvidencia {
  id: number
  nombre?: string
  url?: string
  /** MIME del archivo subido — `EvidenciaUploader.vue` lo usa para elegir el ícono. */
  tipo_mime?: string
  [clave: string]: unknown
}

// ── `/informes/*` — informes mensuales (operacionales, FMO, portafolio) ──────

export type TipoInforme = 'op' | 'fmo' | 'port' | string
export type EstadoInforme = 'borrador' | 'revisado' | 'aprobado' | string

export interface ComentarioInforme {
  id: number
  mensaje: string
  /** Quién dejó el comentario — `EnvioMensualPanel.vue` lo usa para el avatar y para permitir borrarlo. */
  autor_nombre?: string
  autor_email?: string
  created_at?: string
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
  /** Última edición — `InformesListView.vue` los muestra en su columna "Última edición". */
  editado_en?: string
  editado_por_nombre?: string
  /** Quién lo aprobó — solo presente cuando `estado === 'aprobado'`. */
  aprobado_por_nombre?: string
  correo_enviado_en?: string
  enviado_por_nombre?: string
  /** Solo `tipo === 'port'`: los proyectos que agrupa. */
  miembros?: { sub_project?: string; [clave: string]: unknown }[]
  [clave: string]: unknown
}

/** Un proyecto miembro de un informe de portafolio: vinculado (`html_inline: null`, usa el informe individual vivo) o embebido (con su propia sección congelada). */
export interface MiembroInformePayload {
  sub_project: string
  nombre: string
  orden: number
  html_inline: string | null
}

export interface PayloadGuardarInforme {
  tipo: TipoInforme
  sub_project: string
  periodo_desde: string
  periodo_hasta: string
  periodo_display: string
  proyecto_nombre: string
  html_content: string
  /** Solo `tipo === 'port'`: los proyectos que agrupa (ver `MiembroInformePayload`). */
  miembros?: MiembroInformePayload[]
}

export interface FiltrosListaInformes {
  tipo?: string
  sub_project?: string
  limit?: number
  periodo_desde_gte?: string
  periodo_desde_lte?: string
}

export interface RespuestaCompuestoInforme {
  html_content?: string
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

export type TipoProyectoPoliza =
  'minigranja' | 'autoconsumo' | 'gd' | 'movilidad_electrica' | 'otro'

/**
 * `GET/PUT /polizas`: una fila por proyecto — datos técnicos del proyecto
 * (solo lectura acá) más el bloque de póliza/presupuesto/IPP (editable desde
 * `PolizasView.vue`).
 */
export interface Poliza {
  proyecto_id: number
  nombre_comercial?: string
  tipo_proyecto?: TipoProyectoPoliza
  municipio?: string
  departamento?: string
  direccion_vereda?: string | null
  marca_paneles?: string | null
  cantidad_total_paneles?: number | null
  marca_inversores?: string | null
  cantidad_inversores?: number | null
  capacidad_instalada_kwp?: number | null
  operador_red?: string | null
  voltaje_red?: string | null
  potencia_ac_kw?: number | null
  numero_poliza?: string | null
  poliza_om?: boolean | null
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
