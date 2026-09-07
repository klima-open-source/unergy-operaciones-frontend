/**
 * Forma verificada contra las vistas de `comercial`: `TableroOfertas.vue` (vía
 * `useOfertas.js`), `OfertasPanel.vue`, `OfertaDrawer.vue`, `BitacoraPanel.vue`,
 * `OportunidadDetailView.vue` y `ProyectoDesdeCRMDialog.vue`.
 */

// ── `/comercial/ofertas` ─────────────────────────────────────────────────────

/** Fila de `GET /comercial/ofertas`: el tablero, la tabla y el drawer leen de la misma forma. */
export interface Oferta {
  id: number
  tipo?: string
  estado?: string
  planta_nombre?: string
  numero_oferta?: string
  codigo_seguimiento?: string
  cliente_id?: number
  cliente_razon_social?: string
  precio_detalle?: string
  notas?: string
  documento_url?: string
  fecha_oferta?: string
  fecha_ultima_respuesta?: string
  fecha_tentativa_inicio?: string
  fecha_fin_tentativa?: string
  municipio?: string
  departamento?: string
  operador_red_id?: number
  energia_promedio_kwh_mes?: number
  contrato_servicio_id?: number
  plantas?: { id: number; nombre_comercial?: string; [clave: string]: unknown }[]
  [clave: string]: unknown
}

export interface ConfigComercial {
  alerta_dias?: number
  [clave: string]: unknown
}

export interface PayloadCrearOferta {
  tipo: string | null
  planta_nombre: string | null
  proyecto_ids: number[] | null
  numero_oferta: string | null
  estado: string
  precio_detalle: string | null
  fecha_oferta: string | null
  fecha_tentativa_inicio: string | null
  fecha_fin_tentativa: string | null
}

/** El PATCH de autosave del drawer solo manda los campos tocados. */
export type PayloadEditarOferta = Partial<Oferta>

/** Payload de `FirmarOfertaDialog.vue`: rama por tabla de precios o por tarifa base — forma libre. */
export type PayloadFirmarOferta = Record<string, unknown>

export interface RespuestaFirmarOferta {
  oferta: Oferta
  [clave: string]: unknown
}

// ── `/comercial/oportunidades` ───────────────────────────────────────────────

/** `GET /comercial/oportunidades/:id`. */
export interface Oportunidad {
  id: number
  nombre?: string
  cliente_id: number
  cliente_razon_social?: string
  numero_oferta?: string
  fecha_estimada_firma?: string
  fecha_tentativa_inicio_representacion?: string
  fecha_tentativa_inicio_compra_energia?: string
  notas?: string
  documentos?: { id: number; tipo: string; [clave: string]: unknown }[]
  etapas?: Record<string, number>
  proyectos?: unknown[]
  [clave: string]: unknown
}

export type PayloadEditarOportunidad = Partial<Oportunidad>

export interface PayloadGestion {
  tipo: string | null
  descripcion: string
  oferta_id: number | null
}

/** Registro completo (cliente + oportunidad + ofertas) en una sola transacción. */
export type PayloadRegistrarOportunidad = Record<string, unknown>

/** `POST /comercial/oportunidades/:id/proyectos`: crea la planta y la vincula a la oportunidad (y a la oferta, si `oferta_id` viene en la query). */
export interface FiltrosCrearProyectoDesdeCRM {
  forzar?: boolean
  oferta_id?: number
}
