/**
 * El cliente — quien firma. Cubre los dos papeles que juega la misma entidad en
 * el negocio: el **inversionista** que pone el capital de una planta y recibe su
 * liquidación, y el **comprador** que firma el PPA y paga la energía.
 *
 * Vive en `~/types/` porque lo consumen `clientes`, `comercial`, `contratos`,
 * `proyectos` y `liquidaciones`.
 *
 * **Verificado contra `ClienteForm.vue`** y la vista de detalle.
 */
import type { FechaISO, Id } from '~/types/api'

/** Natural o jurídica: decide qué retenciones aplican y qué documentos se piden. */
export const TIPOS_PERSONA = ['natural', 'juridica'] as const
export type TipoPersona = (typeof TIPOS_PERSONA)[number]

export interface ClienteEditable {
  razon_social_nombre: string
  tipo_persona: TipoPersona | null
  nit_cedula: string | null
  representante_legal: string | null
  departamento: string | null
  /** Del catálogo DIVIPOLA, igual que en `Proyecto`. */
  ciudad: string | null
  direccion: string | null

  // ── Tributario: qué se le descuenta al facturar ───────────────────────────
  iva_pct: number | null
  retencion_pct: number | null
  reteica_pct: number | null
  reteiva_pct: number | null

  /** De dónde salió el cliente. Lo alimenta el pipeline comercial. */
  origen_tipo: string | null
  origen_detalle: string
}

export interface Cliente extends ClienteEditable {
  id: Id
}

/** Una persona de contacto del cliente. Se editan en línea desde el detalle. */
export interface Contacto {
  id: Id
  nombre: string
  cargo?: string | null
  email?: string | null
  telefono?: string | null
  [campo: string]: unknown
}

/**
 * Los servicios que Unergy presta y que se vinculan a un cliente o a una planta.
 *
 * Las etiquetas están en `~/features/clientes/components/clientesUi.js`
 * (`SERVICIO_LABELS`); se unifican aquí cuando ese archivo se migre.
 */
export const SERVICIOS = [
  'representacion',
  'cgm',
  'ppa',
  'rec',
  'mantenimiento',
  'arriendo',
  'internet',
] as const

export type Servicio = (typeof SERVICIOS)[number]

/**
 * El semáforo de vigencia que comparten la tabla de clientes y la pestaña
 * Resumen: mismo lenguaje visual en los dos niveles para no re-aprender colores.
 */
export const VIGENCIAS = ['vigente', 'por_vencer', 'vencido'] as const
export type Vigencia = (typeof VIGENCIAS)[number]

/** Un servicio contratado, con su ventana. */
export interface ServicioContratado {
  id: Id
  servicio: Servicio
  fecha_inicio: FechaISO | null
  fecha_fin: FechaISO | null
  vigencia?: Vigencia
  [campo: string]: unknown
}
