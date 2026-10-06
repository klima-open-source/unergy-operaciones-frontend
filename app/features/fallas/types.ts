import type { FallaClasificacion } from '~/features/fallas/utils/fallaTitulo'

/**
 * Forma verificada contra `MonitoreoView.vue`, `FallaDetailView.vue`,
 * `FallaForm.vue`, `FallaArchivos.vue`, `CalendarioFallas.vue`,
 * `FasorialButton.vue` y `FallaCreateSheet.vue` (mobile).
 *
 * `FallasListView.vue` y `FallasMapView.vue` no están en esa lista a propósito:
 * son vistas muertas (`contexto/02-specs.md §7`, la entrada real de la ruta es
 * `MonitoreoView`) sin ninguna página que las montara — se borraron al migrar
 * el slice, junto con `listarOperadoresMapa`/`obtenerMapa` del service y los
 * tipos `OperadorMapa`/`DatosMapa` que solo ellas usaban.
 */

/** Un ítem de catálogo (`tipos`, `estados`, `prioridades`, `resoluciones`…): `{id, etiqueta}` y poco más. */
export interface CatalogoItemFalla {
  id: number
  nombre?: string
  codigo?: string
  etiqueta?: string
  descripcion?: string
  color?: string
  /** Solo en `estados`: si es un estado final (cerrada/sin_solucion). */
  es_estado_final?: boolean
  /** Solo en `tipos`: sugerencia de qué hacer, mostrada en el detalle. */
  accion_sugerida?: string
  /** Solo en `tipos` (legacy): la categoría a la que pertenece. */
  categoria?: { etiqueta?: string; color_hex?: string; [clave: string]: unknown }
  [clave: string]: unknown
}

/** `GET /fallas/catalogos`. */
export interface CatalogosFalla {
  tipos: CatalogoItemFalla[]
  estados: CatalogoItemFalla[]
  prioridades: CatalogoItemFalla[]
  resoluciones: CatalogoItemFalla[]
  categorias?: unknown[]
  [clave: string]: unknown
}

export interface FotoFalla {
  id: number
  url?: string
  [clave: string]: unknown
}

/** Una opción dentro de una categoría de `GET /fallas/estructura` (p.ej. un tipo de evento de red). */
export interface OpcionCategoriaFalla {
  codigo: string
  etiqueta?: string
  requiere_detalle?: boolean
  detalle_label?: string
  /** Es un estado temporal: marca la falla `pendiente_reclasificar` (ver `Falla`). */
  pendiente_reclasificar?: boolean
  [clave: string]: unknown
}

/** Un tipo de falla de inversor, dentro de `CategoriaFalla.tipos_falla` (categoría `inversores`). */
export interface TipoFallaInversor {
  codigo: string
  etiqueta?: string
  [clave: string]: unknown
}

/** Una categoría del árbol de clasificación que arma `FallaForm.vue` y `FallaCreateSheet.vue` (mobile). */
export interface CategoriaFalla {
  codigo: string
  etiqueta?: string
  color_hex?: string
  /** `'opcion'` (red/eventos adversos), `'equipo'` (frontera) o `'inversores'`. */
  tipo?: string
  opciones?: OpcionCategoriaFalla[]
  /** Etiqueta del selector de opciones cuando no son "eventos" (p.ej. frontera). */
  opciones_label?: string
  /** Solo categoría `inversores`: los tipos de falla que se le pueden imputar a un inversor. */
  tipos_falla?: TipoFallaInversor[]
  [clave: string]: unknown
}

/** `GET /fallas/estructura`: árbol de categorías/subtipos para el formulario de reporte. */
export interface RespuestaEstructuraFallas {
  categorias: CategoriaFalla[]
}

/** Un cambio de estado del día, dentro de `RespuestaActividadHoyFallas.cambios_estado`. */
export interface CambioEstadoFalla {
  falla: Falla
  estado_anterior?: CatalogoItemFalla | null
  estado_nuevo?: CatalogoItemFalla | null
  /** Hora `HH:MM` (o timestamp) del cambio. */
  hora?: string
}

/** `GET /fallas/actividad-hoy` (`MobileResumenView.vue`): fallas creadas y cambios de estado del día. */
export interface RespuestaActividadHoyFallas {
  creadas: Falla[]
  cambios_estado: CambioEstadoFalla[]
  fecha?: string
}

export interface SeguimientoFalla {
  id: number
  nota?: string
  estado_id?: number | null
  /** El estado al que quedó la falla tras este seguimiento, si cambió. */
  estado_nuevo?: CatalogoItemFalla | null
  usuario?: { nombre?: string; [clave: string]: unknown } | null
  /** Respaldo legacy de `usuario?.nombre` en seguimientos viejos. */
  usuario_nombre?: string
  creado_por?: string
  created_at?: string
  [clave: string]: unknown
}

export interface ArchivoFalla {
  id: number
  nombre?: string
  url?: string
  tipo_mime?: string
  tamaño?: number
  created_at?: string
  [clave: string]: unknown
}

/**
 * Un elemento de `Falla.fotos_lista`/`Falla.attachments`: formatos legado que
 * conviven — string suelto (URL) u objeto `{url, nombre}` — ver `FallaDetailView.vue`.
 */
export interface AdjuntoFallaLegado {
  url?: string
  nombre?: string
  archivo_url?: string
  [clave: string]: unknown
}

/**
 * `GET /fallas/:id` (y su forma resumida en `GET /fallas`). El catch-all cubre
 * el resto: es una entidad grande y las vistas leen subconjuntos distintos.
 */
export interface Falla {
  id: number
  codigo_interno?: string
  proyecto?: { id: number; nombre_comercial?: string; [clave: string]: unknown }
  proyecto_id?: number
  tipo?: CatalogoItemFalla
  tipo_id?: number | null
  estado?: CatalogoItemFalla
  estado_id?: number | null
  prioridad?: CatalogoItemFalla
  prioridad_id?: number | null
  descripcion?: string
  fecha_identificacion?: string
  hora_identificacion?: string
  fecha_ocurrencia?: string | null
  fecha_resolucion?: string | null
  fecha_programada?: string | null
  causa_raiz?: string | null
  acciones_correctivas?: string | null
  kwh_perdidos_estimado?: number | null
  /** Costo estimado del impacto económico, en COP (ver `MonitoreoView.vue`). */
  impacto_economico_cop?: number | null
  /** Id de la alarma de monitoreo que generó la falla automáticamente, si aplica (ver `MonitoreoView.vue`). */
  alarma_monitoreo_id?: number | null
  sla_limite_horas?: number | null
  sla_limite_horas_efectivo?: number | null
  sla_limite_dias?: number | null
  /** Reloj del SLA, calculado por el backend: no recalcular en la vista. */
  sla_horas_transcurridas?: number | null
  /** % del SLA consumido, tope 110. `null` si la falla no tiene limite. */
  sla_pct?: number | null
  sla_cumplido?: boolean | null
  /**
   * SLA **contractual** del Anexo 4: dias y umbral por CATEGORIA de falla. Es
   * otro compromiso que el operativo de arriba (horas por prioridad). Lo calcula
   * el backend; no recalcular en la vista.
   *
   * `cumple` en una falla ABIERTA significa "por ahora va dentro del plazo", no
   * "cumplio". `null` --igual que `dias`-- cuando no se puede juzgar: una falla
   * en estado final sin `fecha_resolucion` (dato legacy).
   */
  sla_contractual?: {
    dias: number | null
    plazo_dias: number
    etiqueta: string
    cumple: boolean | null
  } | null
  dias_abierta?: number | null
  tiempo_afectacion_horas?: number | null
  registrado_por?: { nombre?: string; [clave: string]: unknown } | null
  resolucion?: CatalogoItemFalla | null
  resolucion_id?: number | null
  fotos?: FotoFalla[]
  fotos_urls?: string[]
  /** Adjuntos normalizados por el backend: string (URL) u objeto, según cuándo se subieron. */
  fotos_lista?: (string | AdjuntoFallaLegado)[]
  /** Adjuntos subidos por `subirAdjunto` (ruta `/attachments`, ver el service). */
  attachments?: AdjuntoFallaLegado[]
  seguimientos?: SeguimientoFalla[]
  created_at?: string
  categoria_codigo?: string | null
  subtipo_codigo?: string | null
  subtipo_detalle?: string | null
  frontera_afecta_medicion?: boolean
  frontera_perdida_comunicacion?: boolean
  notificacion?: boolean
  /**
   * Vista de presentación de la clasificación estructurada, computada por el
   * backend (`dominio.clasificacion`) — la escritura va por los campos planos
   * de arriba (`categoria_codigo`, `subtipo_codigo`...), nunca por este objeto.
   */
  clasificacion?: FallaClasificacion | null
  /** Tipo libre (texto), respaldo legacy cuando no hay `tipo_id` ni clasificación estructurada. */
  tipo_libre?: string | null
  /** `desconexion_sin_identificar` es un estado temporal: queda así hasta reclasificar. */
  pendiente_reclasificar?: boolean
  inversores_afectados?: {
    proyecto_inversor_id?: number
    nombre?: string | null
    potencia_kw?: number | null
    tipos?: string[]
    tipos_etiquetas?: string[]
    [clave: string]: unknown
  }[]
  [clave: string]: unknown
}

/**
 * El cuerpo de `POST`/`PATCH /fallas`: casi todo opcional porque el formulario
 * solo manda lo diligenciado, y `proyecto_id` (edición) o `proyecto_ids` (alta,
 * una falla por proyecto) según el modo.
 */
export type PayloadFalla = Partial<
  Omit<
    Falla,
    | 'id'
    | 'proyecto'
    | 'tipo'
    | 'estado'
    | 'prioridad'
    | 'fotos'
    | 'seguimientos'
    | 'registrado_por'
    | 'clasificacion'
    | 'inversores_afectados'
  >
> & {
  proyecto_id?: number
  proyecto_ids?: number[]
  inversores?: {
    proyecto_inversor_id: number
    nombre?: string | null
    potencia_kw?: number | null
    tipos: string[]
  }[]
}

/**
 * Emitido por `FallaForm`'s `save`: `PayloadFalla` más los campos que solo
 * existen en el formulario — cada consumidor (`MonitoreoView.vue`,
 * `FallaDetailView.vue`, `GestionFallasView.vue`) los separa antes de mandar
 * el resto a la API.
 */
export interface PayloadFallaForm extends PayloadFalla {
  /** Solo al crear: primer seguimiento, si el usuario escribió uno. */
  nota_inicial?: string
  /** Archivos elegidos en el dropzone; se suben aparte tras crear/editar. */
  _archivos?: File[]
}

/**
 * El cuerpo de `POST /fallas/:id/seguimientos`: dos vistas mandan el cambio de
 * estado con nombres distintos (`estado_nuevo` vs `estado_nuevo_id`) — no se
 * unifica acá, cada una manda lo que su propio backend-consumer espera.
 */
export interface PayloadSeguimiento {
  nota?: string
  estado_nuevo?: number | string | null
  estado_nuevo_id?: number | null
}

/** `GET /fallas`: paginado. */
export interface RespuestaListaFallas {
  items: Falla[]
  total?: number
}

export interface FiltrosListaFallas {
  page?: number
  size?: number
  proyecto_id?: number
  estado_id?: number
  prioridad_id?: number
  con_fecha_programada?: boolean
  q?: string
  /**
   * Solo las fallas cuyo estado NO es final.
   *
   * El filtro existe en el backend desde siempre y ninguna vista lo usaba: se
   * traian las ~6.400 fallas para mostrar las ~115 abiertas.
   */
  solo_activas?: boolean
  /**
   * Solo las fallas que estaban abiertas EN esa fecha puntual (`YYYY-MM-DD`) --
   * distinto de `solo_activas`, que mira el estado actual. Lo usa
   * `ReporteEnergiaDetalleTab.vue` para mostrar el contexto de fallas tal
   * como estaba el día que se está revisando, no el de hoy. Faltaba en este
   * tipo aunque el llamado ya existía (verificado contra ese archivo).
   */
  activa_en_fecha?: string
  /**
   * Rango sobre CUÁNDO SE IDENTIFICÓ la falla (`YYYY-MM-DD`), que es la fecha
   * por la que se mira un período hacia atrás.
   *
   * No confundir con `fecha_programada_*` (cuándo se planeó atenderla) ni con
   * `activa_en_fecha` (qué estaba abierto en un día dado).
   */
  fecha_identificacion_desde?: string
  fecha_identificacion_hasta?: string
  /** Rango sobre CUÁNDO SE PROGRAMÓ la intervención (`YYYY-MM-DD`) — usado por `CalendarioFallas.vue`. */
  fecha_programada_desde?: string
  fecha_programada_hasta?: string
}

/** `POST /fallas/:id/notificar`. */
export interface ResultadoNotificacionFalla {
  ok: boolean
  enviados: string[]
  errores: string[]
  sin_correos: boolean
}

// ── Monitoreo (dashboard de fallas + generación) ──────────────────────────────

/** `GET /monitoreo/resumen-generacion`. */
export interface ResumenGeneracionMonitoreo {
  dates: { fecha: string; kwh_real: number }[]
  [clave: string]: unknown
}
