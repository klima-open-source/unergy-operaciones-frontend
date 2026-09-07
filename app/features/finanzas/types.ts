/**
 * Tipos del slice de finanzas — por ahora, los del agente local de XM.
 */
import type { Id } from '~/types/api'

/** Una descarga encolada en el agente local. */
export interface TrabajoDescargaXm {
  job_id: string
  [campo: string]: unknown
}

export interface EstadoDescargaXm {
  estado?: string
  mensaje?: string
  [campo: string]: unknown
}

// ── Documentos de arriendos ──────────────────────────────────────────────────

/** Un documento de arriendo (cuenta de cobro o factura) ya subido. */
export interface DocumentoArriendo {
  id: Id
  /** Id real de `Proyecto`. Es la clave con la que se agrupa. */
  proyecto_id: Id
  /**
   * Id heredado. El backend lo sigue devolviendo por compatibilidad, pero ya no
   * se usa para agrupar.
   */
  arr_proyecto_id?: Id | null
  [campo: string]: unknown
}

/** Documentos del período agrupados por proyecto. */
export type DocumentosPorProyecto = Record<Id, DocumentoArriendo[]>

/** Un predio dentro de una cuenta de cobro: el backend genera una copia por cada uno. */
export interface PredioCuentaCobro {
  arr_proyecto_id: Id | null
  codigo_predio: string
  valor_individual: number | null
  nombre_resultante: string
}

export interface SubidaCuentaCobro {
  file: File
  fileSecundario?: File | null
  periodo: string
  pagoId: Id
  codigoContrato: string
  tipoDocumento: string
  numeroCuentaCobro?: string | null
  nombreArrendatario?: string | null
  predios: PredioCuentaCobro[]
}

// ── Cálculo de arriendos ──────────────────────────────────────────────────────

/**
 * Una fila del cálculo de arriendos de un período — decenas de campos
 * (canon, IVA, indexación, estado del contrato…) que consume principalmente
 * `ArriendosOperaciones.vue`. Solo se afirman los campos que otras vistas del
 * slice (`ArriendosProveedor.vue`, `ArriendosInfo.vue`) leen directamente.
 */
export interface FilaCalculoArriendo {
  id: Id
  incluido?: boolean
  habilitado?: boolean
  facturado?: boolean
  [campo: string]: unknown
}

/** `GET /arriendos/calculo/:periodo`. */
export interface RespuestaCalculoArriendos {
  filas: FilaCalculoArriendo[]
  [campo: string]: unknown
}

export interface ItemSeleccionArriendo {
  arr_arrendador_id: Id
  incluido: boolean
  motivo_exclusion: string | null
}

/** `GET /arriendos/ipc`: una fila por año con la tasa vigente. */
export interface TasaIpc {
  año: number
  tasa: number
  confirmado?: boolean
  fuente?: string
  [campo: string]: unknown
}

export interface PayloadTasaIpc {
  tasa: number
  confirmado: boolean
  fuente: string
}

// ── Mandatos (Operaciones) ────────────────────────────────────────────────────

/** `GET /mandatos`, verificado contra `MandatosOperaciones.vue`. */
export interface MandatoOperaciones {
  id: Id
  cmu?: string
  estado?: string
  observacion?: string
  [campo: string]: unknown
}

export interface PeriodoMandatos {
  periodo: string
  [campo: string]: unknown
}

export interface ResumenMandatosOperaciones {
  total: number
  correcciones: number
  firmados: number
  enviados_inversionista: number
  pendientes: number
  [campo: string]: unknown
}

export interface InversionistaMandato {
  id: Id
  nombre?: string
  [campo: string]: unknown
}

export interface RespuestaSubidaZipMandatos {
  creados: number
  sugerencias?: { mandato_id: Id; sugerido_id: Id; sugerido_nombre?: string; cmu?: string }[]
  [campo: string]: unknown
}

export interface RespuestaSubidaFirmadoMandato {
  asociado: boolean
  mandato?: { cmu?: string; [campo: string]: unknown }
  mensaje?: string
  [campo: string]: unknown
}

// ── Mandatos (Finanzas) ───────────────────────────────────────────────────────

/** `GET /finanzas/mandatos`, verificado contra `MandatosFinanzas.vue`. */
export interface MandatoFinanzas {
  cmu?: string
  proyecto?: string
  tercero?: string
  estado?: string
  [campo: string]: unknown
}

export interface RespuestaListaMandatosFinanzas {
  mandatos: MandatoFinanzas[]
  [campo: string]: unknown
}

export interface ResumenMandatosFinanzas {
  ingreso: { total?: number; firmados?: number; falta_firma?: number; con_comentarios?: number }
  costo: { total?: number; firmados?: number; falta_firma?: number; con_comentarios?: number }
  [campo: string]: unknown
}

// ── Factura Starlink ──────────────────────────────────────────────────────────

export interface LineaFacturaStarlink {
  descripcion: string
  proyecto_id?: Id | null
  nombre_comercial?: string
  tipo_proyecto?: string
  [campo: string]: unknown
}

export interface AgrupadoFacturaStarlink {
  descripcion: string
  cantidad_total?: number
  precio_unitario_promedio?: number
  [campo: string]: unknown
}

/** `GET /starlink/factura/:periodo` y el cuerpo de `PUT` para guardarla. */
export interface FacturaStarlink {
  periodo?: string
  items?: unknown[]
  agrupado?: AgrupadoFacturaStarlink[]
  lineas?: LineaFacturaStarlink[]
  cargos_totales?: unknown
  suma_items?: unknown
  [campo: string]: unknown
}

/** `POST /starlink/procesar-pdf`: lo mismo que `FacturaStarlink`, sin guardar todavía. */
export type ResultadoProcesarPdfStarlink = FacturaStarlink

export interface PayloadMapeoStarlink {
  patron: string
  proyecto_id: Id | null
  activo: boolean
  excluido?: boolean
}

// ── Estados de resultados / cruce de facturas (archivos en Drive) ────────────

/** Un archivo generado (estado de resultados o cruce de facturas), proxeado desde Drive. */
export interface ArchivoEstadoResultados {
  id: string
  nombre: string
  mes?: number
  anio?: number
  version?: string
  fecha?: string
  tamano?: number
  [campo: string]: unknown
}

export interface FiltrosArchivosEstadoResultados {
  tipo: string
  anio?: number
  mes?: number
  version?: string
  refrescar?: boolean
  limite?: number
}

/** `GET /estados-resultados/archivos`. */
export interface RespuestaArchivosEstadoResultados {
  archivos: ArchivoEstadoResultados[]
  periodos: string[]
  versiones: string[]
  total_filtrados?: number
  truncado?: boolean
}

// ── Mantenimiento (O&M) — Proveedor y Operaciones ──────────────────────────────

/**
 * Fila del cálculo mensual de O&M (una por contrato) que arma el backend a
 * partir de IPC + contratos. Solo se afirman los campos que leen las vistas
 * (`OMAProveedor.vue`, `OMAOperaciones.vue`).
 */
export interface FilaCalculoOm {
  contrato_id: Id
  nombre_proyecto?: string
  incluido?: boolean
  habilitado?: boolean
  aplica_este_mes?: boolean
  facturado?: boolean
  editado_manual?: boolean
  valor_a_facturar?: number | null
  factor_acumulado?: number
  periodo?: string
  [campo: string]: unknown
}

/** `GET /om/calculo/:periodo`. */
export interface RespuestaCalculoOm {
  filas: FilaCalculoOm[]
  [campo: string]: unknown
}

export interface ItemSeleccionOm {
  contrato_id: Id
  incluido: boolean
  valor_manual: number | null
  motivo_exclusion: string | null
}

export interface ProyectoOm {
  id: Id
  nombre?: string
  [campo: string]: unknown
}

export interface SinMatchPendienteOm {
  id: Id
  [campo: string]: unknown
}

/** `GET /om/factura/:periodo`. */
export interface FacturaOm {
  nombre_archivo?: string | null
  enlace_pdf?: string | null
  tiene_archivo?: boolean
  subido_en?: string | null
  sin_match_pendientes?: SinMatchPendienteOm[]
  [campo: string]: unknown
}

export interface RespuestaSubidaFacturaOm {
  splitting_result?: unknown
  [campo: string]: unknown
}
