/**
 * Forma verificada contra las vistas de `contratos`: `PPAView.vue`,
 * `PPAContratoWizard.vue`, `ContratoDetailView.vue`, `ContratosListView.vue`,
 * `ContratoServicioWizard.vue`, `RepresentacionView.vue`, `OperacionView.vue`,
 * `FacturasMantenimiento.vue` y `ServiciosUnificadoView.vue`.
 *
 * Dos aggregates comparten este archivo porque las vistas los cruzan
 * constantemente (un PPA lista sus fronteras, un contrato de servicio se abre
 * desde el mismo listado que un PPA): `ContratoPpa` (`/ppa`) y
 * `ContratoServicio` (`/contratos-servicio`, que cubre mantenimiento, arriendo,
 * internet, representación y REC — mismo backend, campos por tipo).
 */

// ── PPA ────────────────────────────────────────────────────────────────────────

export type EstadoAsic = 'publicado' | 'en_proceso' | 'rechazado' | 'desistido'

/** Fila de `GET /ppa/:id/tarifas` y del cuerpo de `PUT /ppa/:id/tarifas`. */
export interface TarifaPpa {
  año: number
  mes: number
  tarifa: number
}

/** Fila de `GET /ppa/:id/compromisos` y del cuerpo de `PUT /ppa/:id/compromisos`. */
export interface CompromisoEnergiaPpa {
  año: number
  mes: number
  energia_minima: number
  energia_maxima?: number | null
  cantidad_proyectos?: number | null
}

export interface ResponsablePpa {
  id: number
  nombre: string
  incluir_en_cumplimiento?: boolean
}

export interface PayloadResponsablePpa {
  nombre: string
  incluir_en_cumplimiento: boolean
}

export interface PayloadAsignarResponsablesPpa {
  contrato_ids: number[]
  responsable_id: number | null
}

export interface ProyectoPpaResumen {
  id: number
  nombre_comercial?: string
  [clave: string]: unknown
}

/** `GET /ppa/:id` (y su forma en el listado `GET /ppa`). */
export interface ContratoPpa {
  id: number
  numero_codigo_contrato?: string | null
  nombre_interno?: string | null
  tipo_contrato?: string | null
  comprador_nombre?: string | null
  comprador_nit?: string | null
  vendedor_nombre?: string | null
  vendedor_nit?: string | null
  fecha_inicio?: string | null
  fecha_fin?: string | null
  tarifa_base?: number | null
  indice_indexacion?: string | null
  periodicidad_indexacion?: string | null
  periodo_indexacion_base?: string | null
  valor_indexacion_base?: number | null
  cantidad_minima_kwh_mes?: number | null
  cantidad_maxima_kwh_mes?: number | null
  periodicidad_facturacion?: string | null
  tiempo_pago?: string | null
  condiciones_pago?: string | null
  codigo_sic?: string | null
  gescon_codigo?: string | null
  gescon_fecha_inicio?: string | null
  gescon_fecha_fin?: string | null
  gescon_precio?: number | null
  gescon_cantidades_kwh?: number | null
  carpeta_link?: string | null
  responsable_id?: number | null
  proyecto_id?: number
  proyectos?: ProyectoPpaResumen[]
  tarifas?: TarifaPpa[]
  compromisos_energia?: CompromisoEnergiaPpa[]
  estado?: string
  [clave: string]: unknown
}

/**
 * El cuerpo de `POST`/`PATCH /ppa` (y `/ppa/:id`): las vistas mandan subconjuntos
 * distintos según qué sección editan (identificación, GESCON, partes, enlace…),
 * así que todo es opcional salvo lo que exige crear.
 */
export type PayloadPpa = Partial<
  Omit<ContratoPpa, 'id' | 'proyectos' | 'tarifas' | 'compromisos_energia'>
> & {
  proyecto_id?: number
  proyecto_ids?: number[]
}

export interface RegistroAsic {
  id: number
  codigo_sic_contrato?: string
  contrato_interno?: string
  fecha_fin?: string | null
  [clave: string]: unknown
}

/** `POST /asic`, `PATCH /asic/:id` — un registro GESCON/ASIC (forma libre, `GesconView.vue`). */
export interface PayloadAsic {
  codigo_sic_contrato?: string | null
  codigo_sic_vendedor?: string | null
  codigo_sic_comprador?: string | null
  cedula_agente_vendedor?: string | null
  cedula_agente_comprador?: string | null
  contrato_interno?: string | null
  nombre_interno?: string | null
  requerimiento_asic?: string | null
  nombre_contacto_solicitante?: string | null
  tipo_asignacion?: string | null
  link_archivo?: string | null
  observaciones?: string | null
  modalidad_pago?: string | null
  fecha_solicitud?: string | null
  fecha_inicio?: string | null
  fecha_fin?: string | null
  porcentaje_despacho?: number | null
  porcentaje_fncer?: number | null
  proyecto_id?: number | null
  reemplaza_anterior?: boolean
  es_duplicado?: boolean
  uso_del_recurso?: boolean
  [clave: string]: unknown
}

/** `POST /asic/terminacion` — cierra la vigencia de un contrato ASIC (`GesconTerminacionForm.vue`). */
export interface PayloadAsicTerminacion {
  codigo_sic_contrato: string
  fecha_terminacion: string | null
  requerimiento_asic?: string | null
  cedula_agente_vendedor?: string | null
  cedula_agente_comprador?: string | null
  estado_solicitud?: string
  fecha_solicitud?: string | null
  link_archivo?: string | null
  observaciones?: string | null
}

/** `POST /asic/modificacion` — nueva versión de un contrato ASIC vigente (`GesconModificacionForm.vue`). */
export interface PayloadAsicModificacion {
  codigo_sic_contrato: string
  fecha_entrada: string | null
  requerimiento_asic: string
  fecha_fin?: string | null
  proyecto_id?: number | null
  porcentaje_despacho?: number | null
  modalidad?: string
  proyecto_saliente_id?: number | null
  estado_solicitud?: string
  fecha_solicitud?: string | null
  link_archivo?: string | null
  observaciones?: string | null
}

/** Respuesta de `/asic/terminacion` y `/asic/modificacion`: el registro creado + un resumen legible. */
export interface RespuestaAsicOperacion {
  resumen?: string
  [clave: string]: unknown
}

/** `POST /asic/backfill-nombre-interno` y `/asic/backfill-terminaciones` (con `dry_run`). */
export interface RespuestaBackfillAsic {
  a_actualizar?: number
  a_recortar?: number
  [clave: string]: unknown
}

/** `GET /cumplimiento/ppa/:id/plantas-inscritas-por-mes`. */
export interface PlantasInscritasPorMes {
  año: number
  mes: number
  plantas_inscritas: number
}

// ── Contratos de servicio (mantenimiento, arriendo, internet, representación) ─

export type TipoServicioContrato =
  'mantenimiento' | 'arriendo' | 'internet' | 'representacion' | 'rec' | 'operacion' | string

/**
 * `/contratos-servicio` es una sola tabla para varios tipos de servicio; cada
 * tipo usa un subconjunto distinto de estos campos (`internet` los de wifi/red,
 * `arriendo` los de indexación por arrendador, etc.) — de ahí que casi todo sea
 * opcional. El catch-all cubre lo que un tipo concreto agrega y esta forma
 * todavía no nombra.
 */
export interface ContratoServicio {
  id: number
  servicio_aplica: TipoServicioContrato
  proyecto_id?: number
  numero_contrato?: string | null
  estado?: string
  estado_pago?: string | null
  contratante_id?: number | null
  contratante_nombre?: string | null
  contratante_nit?: string | null
  prestador_id?: number | null
  prestador_nombre?: string | null
  prestador_nit?: string | null
  inversionista_nombre?: string | null
  portafolio?: string | null
  codigo_sun_factory?: string | null
  nombre_proyecto_ref?: string | null
  fecha_firma_contrato?: string | null
  fecha_inicio?: string | null
  fecha_inicio_om?: string | null
  fecha_fin?: string | null
  renovacion_automatica?: boolean | null
  enlace_drive?: string | null
  tarifa_base?: number | null
  tarifa_mensual?: number | null
  tarifa_admin?: number | null
  tarifa_cgm?: number | null
  tarifa_representacion?: number | null
  periodicidad_pago?: string | null
  indice_indexacion?: string | null
  responsable_iva?: boolean | null
  tiene_cgm?: boolean | null
  cgm_codigo_sic?: string | null
  rec_cantidad?: number | null
  rec_precio_unitario?: number | null
  rec_vintage?: string | null
  service_scope?: string | null
  specific_service_terms?: string | null
  slas?: string | null
  responsibilities?: string | null
  // ── Internet ──
  plan_datos_gb?: string | null
  velocidad_mbps?: number | null
  tipo_conexion?: string | null
  linea_servicio?: string | null
  id_router?: string | null
  numero_kit?: string | null
  latencia_ms?: number | null
  wifi_seguridad?: string | null
  wifi_password?: string | null
  ubicacion_lat?: number | null
  ubicacion_lng?: number | null
  // ── Indexación (JSONB), representación ──
  indexacion_cgm?: EntradaIndexacion[]
  indexacion_representacion?: EntradaIndexacion[]
  // ── Indexación calculada, mantenimiento/arriendo (inyectada al cargar) ──
  indexacion_anual?: unknown[]
  indexacion_mensual?: unknown[]
  [clave: string]: unknown
}

export type PayloadContratoServicio = Partial<Omit<ContratoServicio, 'id'>>

/** Entrada de `indexacion_cgm`/`indexacion_representacion`: JSONB `{año, ipc, valor, esBase}`. */
export interface EntradaIndexacion {
  año?: number
  anio?: number
  ipc?: number | null
  valor: number
  esBase?: boolean
}

/** `GET /om/indexacion/:id` y `GET /arriendos/indexacion/:id`: la serie calculada por el backend. */
export interface SerieIndexacionCalculada {
  anual: unknown[]
  mensual: unknown[]
}

export interface Arrendador {
  id: number
  nombre: string
  valor_base?: number | null
  responsable_iva?: boolean
  activo?: boolean
  anticipo_pagado_desde?: string | null
  anticipo_pagado_hasta?: string | null
  observaciones?: string | null
  indexacion_anual?: unknown[]
  indexacion_mensual?: unknown[]
}

export interface PayloadArrendador {
  nombre: string
  valor_base: number | null
  responsable_iva: boolean
  activo: boolean
  anticipo_pagado_desde: string | null
  anticipo_pagado_hasta: string | null
  observaciones: string | null
}

export interface PagoContratoServicio {
  id: number
  mes: number
  año: number
  valor_pagado?: number | null
  estado?: string
  enlace_factura?: string | null
}

export interface PayloadPagoContratoServicio {
  mes: number
  año: number
  valor_pagado: number | null
  estado: string
  enlace_factura: string | null
}

export type TipoFacturaMantenimiento = 'solenium' | 'inversionista'

export interface FacturaContratoServicio {
  id: number
  tipo: TipoFacturaMantenimiento
  fecha: string
  inversionista?: string | null
  numero_factura?: string | null
  monto?: number | null
  enlace_soporte?: string | null
}

export interface PayloadFacturaContratoServicio {
  tipo: TipoFacturaMantenimiento
  fecha: string
  inversionista: string | null
  numero_factura: string | null
  monto: number | null
  enlace_soporte: string | null
}

export interface GrupoDuplicadoRepresentacion {
  ids: number[]
  [clave: string]: unknown
}

/** `GET /contratos-servicio/duplicados-representacion`. */
export interface DuplicadosRepresentacion {
  grupos_fusionables: GrupoDuplicadoRepresentacion[]
  grupos_con_conflicto: GrupoDuplicadoRepresentacion[]
}

export interface RespuestaFusionarRepresentacion {
  contratos_eliminados: number
  grupos_fusionados?: number
  [clave: string]: unknown
}
