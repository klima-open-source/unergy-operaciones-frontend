/**
 * Forma verificada contra `ProyectosListView.vue`, `ProyectoDetailView.vue`,
 * `ProyectoForm.vue`, `ProyectoAreaContactosPanel.vue` y
 * `ProximosEnergizarView.vue`. El editable base
 * (`Proyecto`/`ProyectoEditable`/`ProyectoInfoTecnica`/`ProyectoInversionista`)
 * vive en `~/types/proyecto.ts` porque lo comparten varios slices; aquí solo
 * lo que ven el listado y el detalle además de eso.
 */
import type { Id } from '~/types/api'
import type {
  EstadoProyecto,
  Proyecto,
  ProyectoInfoTecnica,
  ProyectoInversionista,
} from '~/types/proyecto'

// ── Próximos a energizar (pipeline Sun Factory) ───────────────────────────────

/** Un proyecto del pipeline, ya rehidratado (fechas como `Date`). */
export interface ProyectoProximoEnergizar {
  id: Id
  commercialName: string
  /** `null` mientras no haya fecha estimada. */
  energizationDate: Date | null
  contracts: unknown[]
  monthlyMwh: number
  [campo: string]: unknown
}

/** La respuesta cruda del backend, antes de rehidratar. */
export interface RespuestaProximosEnergizar {
  projects?: unknown[]
  /** De dónde salieron los datos. Hoy siempre `operaciones_db`. */
  source?: string | null
  /**
   * Último sync que tocó el pipeline en la BD — el del job de 6 h o el que
   * alguien disparó a mano. No depende de esta sesión.
   */
  ultimaSincronizacion?: string | null
}

// ── Inversionista, con lo que agrega el detalle sobre el tipo compartido ──────

export interface InversionistaProyecto extends ProyectoInversionista {
  cliente_nombre?: string
  es_patrimonio_autonomo?: boolean
}

export interface PayloadInversionista {
  cliente_id: number
  porcentaje_participacion: number | null
  es_patrimonio_autonomo?: boolean
  fecha_inicio: string | null
  fecha_fin: string | null
}

export interface PayloadActualizarInversionista {
  porcentaje_participacion: number | null
  fecha_inicio: string | null
  fecha_fin: string | null
}

// ── Puntero de contacto por área (pestaña Contactos) ──────────────────────────

export type TipoAreaContacto = 'operacional' | 'cgm' | 'liquidacion'

export interface AreaContactoOverride {
  tipo: TipoAreaContacto
  cliente_id: number
  cliente_nombre: string
}

export interface PayloadAreaContactoOverride {
  cliente_id: number
}

// ── Contratos PPA vinculados (resumen, para el listado y el detalle) ─────────

export interface ContratoPpaResumenProyecto {
  id: number
  nombre_interno?: string | null
  numero_codigo_contrato?: string | null
  comprador_nombre?: string | null
  fecha_inicio?: string | null
  fecha_fin?: string | null
}

// ── El proyecto con todo lo que agregan el listado y el detalle ──────────────

export interface ProyectoConDetalle extends Proyecto {
  inversionistas: InversionistaProyecto[]
  info_tecnica?: ProyectoInfoTecnica
  ppa_contratos?: ContratoPpaResumenProyecto[]
  portafolio_id?: number | null
  fecha_inicio_comercializacion?: string | null
  fecha_entrada_operacion?: string | null
  fecha_operacion_mantenimiento?: string | null
  fecha_entrega_proyecto?: string | null
  fecha_fin_representacion?: string | null
  p90_mensual_kwh?: string | null
  p50_mensual_kwh?: string | null
  p99_mensual_kwh?: string | null
  topico_liquidaciones?: string | null
  quoia_reporte_generacion_id?: string | null
  quoia_reporte_consumo_id?: string | null
  quoia_nodo_id?: string | null
  produccion_especifica_kwh_kwp?: number | null
  srv_ppa?: boolean
  srv_operacion?: boolean
  srv_representacion?: boolean
  srv_cgm?: boolean
  srv_promotor?: boolean
  [clave: string]: unknown
}

/** `GET /proyectos?servicio=representacion`: agrega el resumen del contrato de representación de la planta. */
export interface ProyectoConServicioRepresentacion extends ProyectoConDetalle {
  servicio_representacion?: {
    nombre_rf?: string | null
    nombre_comercializador?: string | null
    [clave: string]: unknown
  }
}

/**
 * El cuerpo de `PATCH /proyectos/:id` que arma el detalle: además de
 * `ProyectoEditable`, los campos de simulación, fechas e IDs de Quoia — el
 * listado (creación) solo manda `ProyectoEditable`.
 */
export interface PayloadActualizarProyecto {
  nombre_comercial?: string
  estado?: EstadoProyecto
  tipo_proyecto?: string | null
  tipo_tecnologia?: string | null
  departamento?: string | null
  municipio?: string | null
  direccion_vereda?: string | null
  latitud?: number | null
  longitud?: number | null
  operador_red_id?: number | null
  clasificacion_regulatoria?: string | null
  carpeta_drive_codigo?: string | null
  sub_project?: string | null
  codigo_tsf?: string | null
  es_comunidad_energetica?: boolean
  nombre_comunidad?: string | null
  p90_mensual_kwh?: string | null
  p50_mensual_kwh?: string | null
  p99_mensual_kwh?: string | null
  fecha_entrada_operacion?: string | null
  fecha_operacion_mantenimiento?: string | null
  fecha_entrega_proyecto?: string | null
  fecha_fin_representacion?: string | null
  fecha_inicio_comercializacion?: string
  topico_liquidaciones?: string | null
  [clave: string]: unknown
}

export interface PayloadServicioToggle {
  [clave: string]: boolean
}

// ── Inversores del proyecto (equipo, no inversionistas — catálogo para clasificar fallas) ──

export interface InversorProyecto {
  id: number
  nombre?: string
  potencia_nominal_kw?: number | null
  orden?: number
  [clave: string]: unknown
}

export type PayloadInversorProyecto = Partial<Omit<InversorProyecto, 'id'>>

// ── Fronteras del proyecto (el slice `fronteras` aún no está migrado) ─────────

export interface FronteraProyectoResumen {
  id: number
  [clave: string]: unknown
}

// ── Contratos de servicio inline (pestaña Servicios) ──────────────────────────

export interface ContratoServicioResumenProyecto {
  id: number
  tipo?: string
  estado?: string
  [clave: string]: unknown
}

// ── Proyectos pendientes (Sun Factory / Quoia) ────────────────────────────────

export type TipoSugerenciaPendiente = 'crear' | 'actualizar' | string

export interface ProyectoPendiente {
  clave: string
  nombre_sugerido?: string | null
  tipo_proyecto_sugerido?: string | null
  tipo_sugerencia: TipoSugerenciaPendiente
  candidato_id?: number
  sunfactory_project_id?: string
  [clave: string]: unknown
}

export interface PayloadConfirmarPendiente {
  nombre_comercial?: string
  tipo_proyecto?: string | null
}

/** El 409 estructurado cuando el nombre se parece a un proyecto ya existente. */
export interface DuplicadoProyecto {
  duplicado_nombre: true
  candidato_id: number
  candidato_nombre: string
  [clave: string]: unknown
}

// ── Backfill de inversores típicos de minigranja ──────────────────────────────

export interface ReporteBackfillInversores {
  a_sembrar: number
  [clave: string]: unknown
}
