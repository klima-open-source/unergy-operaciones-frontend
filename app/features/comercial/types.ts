/**
 * Forma verificada contra las vistas de `comercial`: `TableroOfertas.vue` (vía
 * `useOfertas.ts`), `OfertasPanel.vue`, `OfertaDrawer.vue`, `BitacoraPanel.vue`,
 * `OportunidadDetailView.vue` y `ProyectoDesdeCRMDialog.vue`.
 */
import type { DocumentoCliente } from '~/features/clientes/types'

// ── `/comercial/ofertas` ─────────────────────────────────────────────────────

/**
 * La ficha operativa de la oferta: cada dato dice de dónde salió
 * (`fuentes[campo]` → clave de `FUENTES` en `utils/comercial.ts`). Lo que
 * gobierna el proyecto no se edita desde acá.
 */
export interface FichaOferta {
  proyecto_nombre?: string | null
  municipio?: string | null
  departamento?: string | null
  operador_red?: string | null
  energia_promedio_kwh_mes?: number | null
  energia_real_kwh_mes?: number | null
  energia_real_periodo?: string | null
  fecha_inicio_operacion?: string | null
  contrato_fecha_inicio?: string | null
  contrato_fecha_fin?: string | null
  contrato_compra_anios?: number | null
  contrato_compra_meses?: number | null
  /** `campo → 'proyecto' | 'oferta' | 'contrato' | 'estimada' | 'generacion'`. */
  fuentes?: Record<string, string>
  [clave: string]: unknown
}

/** `oferta.detalle.servicios`: lo que pide un `servicios_operacionales` (RF/CGM/etc). */
export interface DetalleOferta {
  servicios?: string[]
  fpo?: string | null
  [clave: string]: unknown
}

/** Fila de `GET /comercial/ofertas`: el tablero, la tabla y el drawer leen de la misma forma. */
export interface Oferta {
  id: number
  tipo?: string
  estado?: string
  estado_desde?: string
  planta_nombre?: string
  numero_oferta?: string
  codigo_seguimiento?: string
  cliente_id?: number
  cliente_razon_social?: string
  cliente_nit?: string
  precio_detalle?: string
  notas?: string
  documento_url?: string
  fecha_oferta?: string | null
  fecha_ultima_respuesta?: string | null
  fecha_tentativa_inicio?: string | null
  fecha_fin_tentativa?: string | null
  municipio?: string
  departamento?: string
  operador_red_id?: number | null
  energia_promedio_kwh_mes?: number | null
  contrato_servicio_id?: number | null
  plantas?: { id: number; nombre_comercial?: string; [clave: string]: unknown }[]
  /** La oportunidad (cliente + negocio) a la que pertenece. */
  oportunidad_id?: number
  oportunidad_nombre?: string
  resultado?: string
  /** Toques enviados al cliente sin respuesta (ver `sinRespuesta`/`alarmante`). */
  seguimientos?: number
  /** Calculado por el backend: `seguimientos >= 4 && sin respuesta` en su forma real. */
  alerta?: boolean
  dias_sin_respuesta?: number
  updated_at?: string
  ppa_contrato_id?: number | null
  ficha?: FichaOferta
  detalle?: DetalleOferta
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
  ppa_contrato_id?: number
  plantas_del_contrato?: number
  tarifas_creadas?: number
  /** Avisos no bloqueantes (p. ej. «ya existe un PPA que cubre esto»). */
  avisos?: string[]
  [clave: string]: unknown
}

// ── `/comercial/oportunidades` ───────────────────────────────────────────────

/** Una entrada de la bitácora (`GesionesPanel`/`BitacoraPanel`). */
export interface GestionComercial {
  id: number
  tipo?: string
  descripcion?: string
  /** Quién habló: `'saliente'` (le escribimos) o `'entrante'` (nos respondió). */
  direccion?: string
  fecha?: string
  /** `null`/ausente: la gestión es del cliente entero, no de una oferta puntual. */
  oferta_id?: number | null
  [clave: string]: unknown
}

/** Un movimiento del histórico de etapas de una oferta. */
export interface HistorialEtapaOferta {
  id: number
  estado_anterior?: string | null
  estado_nuevo?: string
  oferta_id?: number | null
  fecha?: string
  [clave: string]: unknown
}

/** La planta vinculada a la oportunidad, tal como la resuelve el backend para la pestaña «Proyectos y contratos». */
export interface ProyectoOportunidad {
  id: number
  nombre_comercial?: string
  potencia_ac_kw?: number | string | null
  municipio?: string | null
  operador_red?: string | null
  mwh_mes_estimado?: number | null
  fecha_estimada_energizacion?: string | null
  fecha_inicio_comercializacion?: string | null
  [clave: string]: unknown
}

/** `GET /comercial/oportunidades/:id`. */
export interface Oportunidad {
  id: number
  nombre?: string | null
  cliente_id: number
  cliente_razon_social?: string
  cliente_nit?: string
  numero_oferta?: string | null
  fecha_estimada_firma?: string | null
  fecha_tentativa_inicio_representacion?: string | null
  fecha_tentativa_inicio_compra_energia?: string | null
  notas?: string | null
  documentos?: DocumentoCliente[]
  /** `etapa → cantidad de ofertas`, usado para resumir el pipeline del cliente. */
  etapas?: Record<string, number>
  ofertas?: Oferta[]
  proyectos?: ProyectoOportunidad[]
  gestiones?: GestionComercial[]
  historial?: HistorialEtapaOferta[]
  alerta?: boolean
  dias_sin_respuesta?: number
  [clave: string]: unknown
}

export type PayloadEditarOportunidad = Partial<Oportunidad>

export interface PayloadGestion {
  tipo: string | null
  descripcion: string
  oferta_id: number | null
  /** Optativo: ver nota de `GestionComercial.direccion`. */
  direccion?: string
}

/** Registro completo (cliente + oportunidad + ofertas) en una sola transacción. */
export type PayloadRegistrarOportunidad = Record<string, unknown>

/** `POST /comercial/oportunidades/:id/proyectos`: crea la planta y la vincula a la oportunidad (y a la oferta, si `oferta_id` viene en la query). */
export interface FiltrosCrearProyectoDesdeCRM {
  forzar?: boolean
  oferta_id?: number
}

/**
 * Una propuesta concreta de una oferta. APPEND-ONLY: no se editan ni se borran.
 *
 * Reofertar agrega una version; la oferta conserva su consecutivo. Antes habia
 * un solo `documento_url` y un `precio_detalle` de texto que se sobrescribian,
 * asi que la propuesta anterior desaparecia sin rastro.
 */
export interface VersionOferta {
  id: number
  numero: number
  /** Sin fecha de envio la version es un BORRADOR: todavia no salio. */
  fecha_envio: string | null
  /** La version que el cliente acepto. Es la que se firmara. Maximo una por oferta. */
  fecha_aceptacion: string | null
  documento_url: string | null
  indice_indexacion: string | null
  /** Mes base de indexacion, YYYY-MM. En el PDF es la fila "Precio Base". */
  periodo_indexacion_base: string | null
  que_cambio: string | null
  creado_por_usuario_id: number | null
  created_at: string
  /** La tabla 2 del PDF: precio por anio del periodo de suministro. */
  precios: { anio: number; precio: number }[]
}

/** `POST /comercial/ofertas/:id/versiones`. El `numero` lo asigna el backend. */
export interface PayloadVersionOferta {
  fecha_envio?: string | null
  documento_url?: string | null
  indice_indexacion?: string | null
  periodo_indexacion_base?: string | null
  que_cambio?: string | null
  precios?: { anio: number; precio: number }[]
}
