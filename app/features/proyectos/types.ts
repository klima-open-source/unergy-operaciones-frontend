/**
 * Forma verificada contra `ProyectosListView.vue`, `ProyectoDetailView.vue`,
 * `ProyectoForm.vue`, `ProyectoAreaContactosPanel.vue` y
 * `ProximosEnergizarView.vue`. El editable base
 * (`Proyecto`/`ProyectoEditable`/`ProyectoInfoTecnica`/`ProyectoInversionista`)
 * vive en `~/types/proyecto.ts` porque lo comparten varios slices; aquí solo
 * lo que ven el listado y el detalle además de eso.
 */
import type { Id } from '~/types/api'
import type { PortafolioDeProyecto } from '~/features/operaciones/types'
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
  /** El patrimonio autónomo a través del que se tiene la parte: al que se le factura. */
  patrimonio_id?: number | null
  patrimonio_nombre?: string | null
}

export interface PayloadInversionista {
  cliente_id: number
  porcentaje_participacion: number | null
  patrimonio_id?: number | null
  fecha_inicio: string | null
  fecha_fin: string | null
}

export interface PayloadActualizarInversionista {
  porcentaje_participacion: number | null
  fecha_inicio: string | null
  fecha_fin: string | null
  patrimonio_id?: number | null
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
  /**
   * Potencia AC de la planta, en kW. Vive en el proyecto desde el 2026-09-10
   * (`info_tecnica.potencia_ac_kw` es una copia que solo existe si la planta
   * tiene fila de info técnica). DRF la manda como texto decimal.
   */
  potencia_ac_kw?: number | string | null
  ppa_contratos?: ContratoPpaResumenProyecto[]
  /** Los portafolios en que está la planta: pueden ser varios. */
  portafolios?: PortafolioDeProyecto[]
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
  /** De los contratos vigentes (backend `plantas.resumen_servicios`), solo lectura.
   *  `operacion` es "genera y la operamos": en operación y con contrato de operación. */
  servicios?: ServiciosPlanta
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

/** Valores de `GET /proyectos?servicio=…`: los servicios contratados de una planta (ver `ServiciosPlanta`). */
export enum ServicioPlanta {
  OPERACION = 'operacion',
  REPRESENTACION = 'representacion',
}

export interface ServiciosPlanta {
  operacion: boolean
  representacion: boolean
  cgm: boolean
  ppa: boolean
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

/**
 * `GET /proyectos/lista`: lo justo para identificar un proyecto en un
 * desplegable. **No tiene las relaciones anidadas** -- si hace falta algo mas,
 * es `ProyectoConDetalle` y otra peticion.
 */
export interface ProyectoLiviano {
  id: number
  nombre_comercial: string
  estado?: string | null
  tipo_proyecto?: string | null
  municipio?: string | null
  departamento?: string | null
  potencia_ac_kw?: number | string | null
  sub_project?: string | null
  codigo_tsf?: string | null
}

// ── Importar desde TSF (originabot) ──────────────────────────────────────────
// La forma que entregan `server/routes/originabot/*`, ya traducida por
// `server/utils/originabot-api.ts`: nada de lo crudo de originabot llega aquí.

/** Un resultado de la búsqueda de Portfolio Manager. */
export interface ResultadoTsf {
  minigranjaId: number
  /** El `base_name` de TSF: `COLCEST456P1_BOSCONIA_ORIENTE`. */
  codigo: string
  etapa: string
  etapaLabel: string
  ubicacion: string | null
  operadorRed: string | null
}

export interface BusquedaTsf {
  resultados: ResultadoTsf[]
  /** Alguna etapa tenía más resultados de los que se muestran: afinar la búsqueda. */
  truncado: boolean
}

/** Lo que TSF dice de una minigranja. `null` = no lo trae, y el campo queda editable. */
/** Un portafolio en el plan de `POST /proyectos/{id}/originabot/portafolios`. */
export interface AccionPortafolioTsf {
  /** El de Operaciones; null si se crearía. */
  portafolio_id: number | null
  originabot_portfolio_id: number | null
  nombre: string
  /** Solo en `renombrar`. */
  nombre_anterior?: string
}

/**
 * Qué cambia en los portafolios de la planta para quedar como en TSF. Solo se
 * tocan los portafolios que vienen de TSF; los creados en Operaciones, no.
 */
export interface PlanPortafoliosTsf {
  de_tsf: { id: number; nombre: string }[]
  crear: AccionPortafolioTsf[]
  vincular: AccionPortafolioTsf[]
  renombrar: AccionPortafolioTsf[]
  agregar: AccionPortafolioTsf[]
  quitar: AccionPortafolioTsf[]
  hay_cambios: boolean
}

export interface ProyectoTsf {
  minigranjaId: number
  /** Va a `origina_code`, entero. */
  codigoOrigina: string
  /** Va a `codigo_tsf`: el prefijo CREG. */
  codigoTsf: string | null
  /** Derivado del código (como `tsf_sync`): no es un dato de TSF y se puede editar. */
  nombreSugerido: string
  etapa: string | null
  departamento: string | null
  municipio: string | null
  latitud: number | null
  longitud: number | null
  operadorRed: string | null
  /** El `code` de originabot (`afinia`): la llave con `operadores_red.codigo_originabot`. */
  operadorRedCodigo: string | null
  tipoProyecto: string | null
  /** Generación simulada mensual (kWh): forma del zip de PVsyst, total del anual de TSF. */
  p50MensualKwh: number[] | null
  p90MensualKwh: number[] | null
  /** Los inversionistas en TSF (`Investment`): id y nombre allá. */
  inversionistas: { id: number; nombre: string }[]
  /** Datos técnicos del proyecto de PVsyst de la pre-simulación; null si no hay zip. */
  tecnico: TecnicoTsf | null
  /** «Nivel de tensión» de la validación eléctrica (kV de media tensión). */
  voltajeRed: string | null
  /** El ECS (Estudio de Conexión Simplificado) del proyecto en TSF. */
  ecs: EcsTsf | null
  /** El contrato de arrendamiento del proyecto en TSF, con sus propietarios. */
  arriendo: ArriendoTsf | null
}

/** Un propietario del terreno según TSF. */
export interface ArrendadorTsf {
  id: number
  nombre: string
  /** Tal como lo da TSF; en dev llega enmascarado («19****53»). */
  documento: string | null
  tipoPersona: 'natural' | 'juridica' | null
  /** Su parte del canon, 0–100. */
  porcentaje: number
  /** Quien recibe el pago según la termsheet. */
  recibePago: boolean
}

export type PeriodicidadArriendo = 'mensual' | 'bimestral' | 'trimestral' | 'semestral' | 'anual'

/** El contrato de arrendamiento del proyecto en TSF. */
export interface ArriendoTsf {
  /**
   * `contrato`: el `contract.Contract` con su termsheet (canon, fechas…).
   * `documento`: solo el PDF firmado del campo «(S) Contrato de arrendamiento».
   */
  origen: 'contrato' | 'documento'
  /** El `contract.Contract`: la llave con `contratos.originabot_arriendo_id`. null si es solo el documento. */
  contratoId: number | null
  /** La pestaña legal del terreno en TSF, donde está el PDF. */
  enlace: string | null
  firmado: boolean
  /** ISO `YYYY-MM-DD`, en hora de Bogotá. */
  fechaFirma: string | null
  periodicidad: PeriodicidadArriendo | null
  /** El canon anual del terreno entre sus proyectos, en partes iguales. */
  canonAnual: number | null
  proyectosTerreno: number
  arrendadores: ArrendadorTsf[]
}

/** Un panel o inversor según su archivo de PVsyst. Panel: W pico; inversor: kW AC. */
export interface EquipoTsf {
  fabricante: string | null
  modelo: string | null
  potencia: number | null
}

export interface TecnicoTsf {
  modulos: number
  strings: number
  inversores: number
  kwpDc: number | null
  kwAc: number | null
  paneles: EquipoTsf[]
  equiposInversor: EquipoTsf[]
  /** «Tracker Zentrack 1P», «Fixed tilted plane»… */
  sistema: string | null
}

export interface EcsTsf {
  estado: string | null
  codigoInsumo: string | null
  vencimiento: string | null
  archivoUrl: string | null
  conformidadUrl: string | null
}

/** Un inversionista de TSF ya vinculado con su cliente de Operaciones. */
export interface InversionistaTsfResuelto {
  cliente_id: number
  nombre: string
}

/** Lo que `ImportarDesdeTsf` entrega al formulario: el proyecto y sus inversionistas ya resueltos. */
export interface ImportacionTsf extends ProyectoTsf {
  inversionistasResueltos: InversionistaTsfResuelto[]
}
