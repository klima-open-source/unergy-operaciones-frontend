/** Forma verificada contra `RegistrosCndAsicListView.vue` y `RegistroCndAsicDetailView.vue`. */

// ── Listado ───────────────────────────────────────────────────────────────────

export interface SiguientePasoRegistroCnd {
  codigo: string
  descripcion: string
  etapa?: string
}

/** Fila de `GET /registros-cnd`: un proyecto con su avance en el proceso CND/ASIC. */
export interface ResumenRegistroCnd {
  proyecto_id: number
  nombre_comercial: string
  codigo_cnd?: string
  clasificacion_regulatoria?: string
  tecnologia?: string
  operador_red?: string
  avance_pct: number
  siguiente_paso?: SiguientePasoRegistroCnd
  tiene_registro?: boolean
  alertas_pendientes?: number
  bloqueos?: number
}

// ── Detalle ───────────────────────────────────────────────────────────────────

export interface HitoRegistroCnd {
  hito: string
  codigo: string
  descripcion: string
  peso_pct: number
  min?: number
  completado?: boolean
  etapa?: string
}

export interface EtapaRegistroCnd {
  etapa: string
  etiqueta?: string
  estado_actual?: string
  responsable_actual?: string
  ganado_pct: number
  total_pct: number
  bloqueada?: boolean
}

export interface AlertaRegistroCnd {
  [clave: string]: unknown
}

/** Respuesta de `GET/POST /registros-cnd/:id` (y `/por-proyecto/:proyectoId`). */
export interface RegistroCnd {
  id: number
  avance_pct: number
  bloqueos?: number
  clasificacion_regulatoria?: string
  codigo_cnd?: string
  nombre_comercial: string
  operador_red?: string
  tecnologia?: string
  hitos: HitoRegistroCnd[]
  por_etapa: EtapaRegistroCnd[]
  siguiente_paso?: SiguientePasoRegistroCnd & { etapa?: string }
  alertas_pendientes?: AlertaRegistroCnd[]
  numero_expediente?: string
  id_requerimiento_or?: string
  numero_solicitud_appweb?: string
  fecha_conexion_estimada?: string
  vigencia_aprobacion_conexion?: string
  fecha_visita_protecciones?: string
  tipo_visita_protecciones?: string
  exporta?: boolean
  comercializador_es_or?: boolean
  punto_conexion_texto?: string
  notas?: string
  [clave: string]: unknown
}

export interface CatalogosRegistroCnd {
  /** `transiciones[etapa][estado_actual]` → estados a los que se puede pasar. */
  transiciones: Record<string, Record<string, string[]>>
  tipos_equipo: string[]
  tipos_documento: string[]
  tipos_visita: string[]
}

export interface ParametrosCreg93 {
  voltaje_max_kv?: number
  voltaje_nominal_kv?: number
  voltaje_min_kv?: number
  in_eq_ka?: number
  icc_subtrans_pico_kap?: number
  icc_subtrans_3f_ka?: number
  icc_subtrans_2f_ka?: number
  icc_subtrans_1f_ka?: number
  icc_estado_estable_ka?: number
  impedancia_equivalente_ohm?: number
  frecuencia_max_hz?: number
  frecuencia_min_hz?: number
  [clave: string]: unknown
}

export interface ResultadoValidacionCreg93 {
  [clave: string]: unknown
}

/** Respuesta de `GET /registros-cnd/:id/validacion-93`. */
export interface ValidacionCreg93 {
  valido: boolean
  sin_parametros?: boolean
  resultados: ResultadoValidacionCreg93[]
}

export interface EquipoRegistroCnd {
  id: number
  tipo: string
  marca?: string
  modelo?: string
  serial?: string
  fecha_vencimiento_calibracion?: string
  [clave: string]: unknown
}

export interface DocumentoRegistroCnd {
  id: number
  tipo: string
  radicado?: string
  estado: string
  firmado_por?: string
  [clave: string]: unknown
}

export interface RespuestaRecomputarAlertas {
  alertas: AlertaRegistroCnd[]
  creadas: number
}

/** Respuesta de `POST /registros-cnd/:id/correos/:tipo`: el borrador generado. */
export interface CorreoGenerado {
  asunto?: string
  cuerpo: string
  [clave: string]: unknown
}
