/** Forma verificada contra `ClientesListView.vue`, `ClienteDetailView.vue` y `ClienteResumen.vue`. */
import type { Cliente, Vigencia } from '~/types/cliente'

// ── Listado (vista comercial) ─────────────────────────────────────────────────

/** Fila de `GET /clientes/vista-comercial`: un read-model propio, no `Cliente`. */
export interface ClienteVistaComercial {
  id: number
  razon_social_nombre: string
  nit_cedula?: string | null
  num_plantas: number
  servicios: string[]
  alerta_contrato?: Vigencia
  contacto_comercial_nombre?: string | null
  contactos_comerciales_extra?: number
  contacto_comercial_telefono?: string | null
  contacto_comercial_correo?: string | null
}

// ── Detalle: documentos comerciales ───────────────────────────────────────────

export type TipoDocumentoCliente =
  'rut' | 'cedula_ciudadania' | 'certificado_bancario' | 'camara_comercio' | 'oferta' | 'contrato'

export type EstadoDocumentoCliente = 'borrador' | 'enviado' | 'aceptado' | 'firmado' | 'rechazado'

export interface DocumentoCliente {
  id: number
  tipo: TipoDocumentoCliente
  nombre: string
  numero?: string | null
  fecha?: string | null
  estado: EstadoDocumentoCliente
  archivo_url?: string | null
  archivo_nombre?: string | null
  notas?: string | null
}

export interface PayloadDocumentoCliente {
  tipo: string
  nombre: string
  numero: string | null
  fecha: string | null
  estado: string
  archivo_url: string | null
  archivo_nombre: string | null
  notas: string | null
  /** Vincula el documento a la oportunidad que lo generó (`OportunidadDetailView.vue`). */
  oportunidad_id?: number
}

/** `GET /clientes/:id`: `Cliente` (`~/types/cliente.ts`) más sus documentos comerciales. */
export interface ClienteDetalle extends Cliente {
  documentos_comerciales?: DocumentoCliente[]
}

// ── Tasas de servicio (excepciones tributarias) ───────────────────────────────

export interface TasaServicioCliente {
  id: number
  servicio: string
  proyecto_id?: number | null
  iva_pct?: number | null
  retencion_pct?: number | null
  reteiva_pct?: number | null
  reteica_pct?: number | null
}

export interface PayloadTasaServicioCliente {
  servicio: string
  proyecto_id: number | null
  iva_pct: number | null
  retencion_pct: number | null
  reteiva_pct: number | null
  reteica_pct: number | null
}

// ── Panel resumen (pestaña Resumen) ───────────────────────────────────────────

export interface PlantaPanelCliente {
  proyecto_id: number
  nombre: string
  potencia_kwp?: number | null
  fecha_fin_contrato?: string | null
  participacion_actual?: number | null
  semaforo?: Vigencia
  servicios: string[]
  renovacion_automatica?: boolean | null
}

export interface CondicionEconomicaCliente {
  contrato_id: number
  proyecto_nombre?: string
  servicio: string
  tarifa_representacion?: number | null
  tarifa_cgm?: number | null
  indice_indexacion?: string | null
  fecha_indexacion?: string | null
}

export interface ParticipacionHistorico {
  proyecto_id: number
  proyecto_nombre?: string
  fecha_inicio: string
  fecha_fin?: string | null
  porcentaje: number
}

export interface ContratoPanelCliente {
  id: number
  fuente: 'ppa' | string
  tipo?: string
  numero?: string | null
  semaforo?: Vigencia
  proyectos: string[]
  fecha_inicio?: string | null
  fecha_fin?: string | null
  renovacion_automatica?: boolean | null
  link?: string | null
}

export interface KpisPanelCliente {
  num_plantas: number
  contratos_activos: number
  servicios: string[]
  proximo_vencimiento?: string | null
}

/** Respuesta de `GET /clientes/:id/panel`. */
export interface PanelCliente {
  kpis: KpisPanelCliente
  plantas: PlantaPanelCliente[]
  condiciones: CondicionEconomicaCliente[]
  contratos: ContratoPanelCliente[]
  participaciones_historico: ParticipacionHistorico[]
}

// ── Pestañas de registros relacionados (proyectos, fronteras, PPA, servicios) ─

/** Fila de `GET /clientes/:id/proyectos` — proyección liviana, no `Proyecto` completo. */
export interface ProyectoClienteResumen {
  id: number
  nombre_comercial: string
  municipio?: string | null
  departamento?: string | null
  potencia_ac_kw?: number | null
  estado?: string
  /** Por qué esta planta aparece en la ficha: participación, contrato de servicio o PPA. */
  roles?: string[]
}

/** Fila de `GET /clientes/:id/fronteras`. */
export interface FronteraClienteResumen {
  id: number
  codigo_frontera: string
  nombre_frontera?: string | null
  estado?: string
}

/** Fila de `GET /clientes/:id/contratos-ppa`. */
export interface ContratoPpaClienteResumen {
  id: number
  nombre_interno?: string | null
  numero_codigo_contrato?: string | null
  comprador_nombre?: string | null
  vendedor_nombre?: string | null
  fecha_inicio?: string | null
  fecha_fin?: string | null
}

export interface ContratoServicioResumen {
  contrato_id: number
  proyecto_nombre?: string | null
  numero_contrato?: string | null
  fecha_inicio?: string | null
  fecha_fin?: string | null
  tarifa?: number | null
  semaforo?: Vigencia
  enlace_drive?: string | null
}

/** Fila de `GET /clientes/:id/servicios-contratos`: un servicio con sus contratos por planta. */
export interface ServicioContratosResumen {
  servicio: string
  num_plantas: number
  semaforo?: Vigencia
  contratos: ContratoServicioResumen[]
}

/** Tipo de área a la que se dirige el contacto (`ContactosPanel.vue`). */
export type TipoContactoCliente = 'liquidacion' | 'operacional' | 'comercial' | 'cgm' | 'contable'

/** Fila de `GET /clientes/:id/contactos`. */
export interface ContactoCliente {
  id: number
  tipo: TipoContactoCliente
  email: string
  nombre?: string | null
  telefono?: string | null
}

export interface PayloadContactoCliente {
  tipo?: TipoContactoCliente
  email: string
  nombre?: string | null
  telefono?: string | null
}

// ── Patrimonios autónomos (`/patrimonios`) ────────────────────────────────────

/** Una planta que se tiene a través del patrimonio, con su dueño. */
export interface ParticipacionEnPatrimonio {
  id: number
  proyecto_id: number
  proyecto_nombre: string | null
  inversionista_nombre: string | null
  /** Decimal del backend, en fracción (`"0.5000000"` = 50 %). */
  porcentaje_participacion: string | null
}

/**
 * Un patrimonio autónomo: la fiducia a la que se le factura y liquida la parte
 * de una planta. El dueño sigue siendo el inversionista. Dos niveles: un
 * general (la fiduciaria, `padre_id` null) y sus subpatrimonios.
 */
export interface Patrimonio {
  id: number
  nombre: string
  codigo: string | null
  padre_id: number | null
  /** Su ficha en clientes. Un subpatrimonio sin ficha se factura a la de su general. */
  cliente_id: number | null
  cliente_nombre: string | null
  cliente_nit: string | null
  participaciones: ParticipacionEnPatrimonio[]
}

/** Fila de `GET /patrimonios`: un general con sus subpatrimonios debajo. */
export interface PatrimonioGeneral extends Patrimonio {
  subpatrimonios: Patrimonio[]
}

export interface PayloadPatrimonio {
  nombre: string
  codigo: string | null
  padre_id: number | null
  cliente_id: number | null
}
