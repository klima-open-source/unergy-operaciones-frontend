/** Catálogos y agrupaciones de VISUALIZACIÓN del Panel Contable. */
import {
  DocumentoContable,
  FiltroEstadoLiquidacion,
  FiltroMarcador,
  FuenteLinea,
  GrupoLinea,
  TabPanelContable,
  TipoLiquidacion,
} from '~/features/panel-contable/types'

export const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

export const ANIOS = [2025, 2026]

export const TABS: { value: TabPanelContable; label: string }[] = [
  { value: TabPanelContable.PRELIQUIDACION, label: 'Preliquidación' },
  { value: TabPanelContable.OFICIAL, label: 'Oficial' },
  { value: TabPanelContable.SELECCION, label: 'Selección' },
  { value: TabPanelContable.DIFERENCIA, label: 'Diferencia' },
  { value: TabPanelContable.CLASIFICACION, label: 'Clasificación' },
]

export const OPCIONES_TIPO_LIQUIDACION: { value: TipoLiquidacion; label: string }[] = [
  { value: TipoLiquidacion.NORMAL, label: 'Normal' },
  { value: TipoLiquidacion.NEU, label: 'NEU' },
  { value: TipoLiquidacion.NITRO, label: 'NITRO' },
]

export const OPCIONES_ESTADO_LIQUIDACION: { value: FiltroEstadoLiquidacion; label: string }[] = [
  { value: FiltroEstadoLiquidacion.LIQUIDA, label: 'Liquida' },
  { value: FiltroEstadoLiquidacion.NO_LIQUIDA, label: 'No liquida' },
  { value: FiltroEstadoLiquidacion.SOLO_INGRESOS, label: 'Solo ingresos' },
  { value: FiltroEstadoLiquidacion.SOLO_COSTOS, label: 'Solo costos' },
  { value: FiltroEstadoLiquidacion.GENERA_MANDATOS, label: 'Genera mandatos' },
]

export const OPCIONES_MARCADOR: { value: FiltroMarcador; label: string }[] = [
  { value: FiltroMarcador.CON_COSTOS, label: 'Con costos' },
  { value: FiltroMarcador.SIN_COSTOS, label: 'Sin costos' },
  { value: FiltroMarcador.BOLSA, label: 'Con bolsa' },
]

export const OPCIONES_DOCUMENTO: { value: DocumentoContable; label: string }[] = [
  { value: DocumentoContable.MANDATO, label: 'Mandato (ingresos)' },
  { value: DocumentoContable.COSTOS, label: 'Costos' },
  { value: DocumentoContable.FACTURA, label: 'Factura (Repr/CGM/Admin)' },
]

/**
 * Grupos de VISUALIZACIÓN para la pestaña Diferencia. `keys` son las claves de
 * `grupo` del backend que se renderizan juntas bajo un mismo encabezado.
 * "COSTOS OPERATIVOS" combina 'costos' y 'facturas' (Representación, CGM,
 * Administración). No altera el campo `grupo` de los datos, solo la
 * presentación.
 */
export const GRUPOS_DIFERENCIA: { key: string; keys: GrupoLinea[]; label: string }[] = [
  { key: 'ingresos', keys: [GrupoLinea.INGRESOS], label: 'INGRESOS' },
  { key: 'comercializacion', keys: [GrupoLinea.COMERCIALIZACION], label: 'COMERCIALIZACIÓN XM' },
  {
    key: 'costos',
    keys: [GrupoLinea.COSTOS, GrupoLinea.FACTURAS],
    label: 'COSTOS OPERATIVOS',
  },
]

/**
 * Secciones del DETALLE por proyecto: cada una es un acordeón colapsado que
 * muestra solo su título + total; al expandir revela los conceptos. A
 * diferencia de `GRUPOS_DIFERENCIA`, aquí FACTURAS DE SERVICIO se separa de
 * COSTOS OPERATIVOS para aligerar la lectura.
 */
export const SECCIONES_DETALLE: { key: string; keys: GrupoLinea[]; label: string }[] = [
  { key: 'ingresos', keys: [GrupoLinea.INGRESOS], label: 'INGRESOS' },
  { key: 'comercializacion', keys: [GrupoLinea.COMERCIALIZACION], label: 'COMERCIALIZACIÓN XM' },
  { key: 'costos', keys: [GrupoLinea.COSTOS], label: 'COSTOS OPERATIVOS' },
  { key: 'facturas', keys: [GrupoLinea.FACTURAS], label: 'FACTURAS DE SERVICIO' },
]

/** Bloques contables de la tabla plana 100%: Mandato (ingresos+comercialización), Costos, Factura. */
export const BLOQUES_PLANO: { key: DocumentoContable; keys: GrupoLinea[]; label: string }[] = [
  {
    key: DocumentoContable.MANDATO,
    keys: [GrupoLinea.INGRESOS, GrupoLinea.COMERCIALIZACION],
    label: 'MANDATO',
  },
  { key: DocumentoContable.COSTOS, keys: [GrupoLinea.COSTOS], label: 'COSTOS' },
  { key: DocumentoContable.FACTURA, keys: [GrupoLinea.FACTURAS], label: 'FACTURA' },
]

/** Documento contable → grupos de línea (para el filtro por documento y el export a Excel). */
export const GRUPOS_DE_DOCUMENTO: Record<DocumentoContable, GrupoLinea[]> = {
  [DocumentoContable.MANDATO]: [GrupoLinea.INGRESOS, GrupoLinea.COMERCIALIZACION],
  [DocumentoContable.COSTOS]: [GrupoLinea.COSTOS],
  [DocumentoContable.FACTURA]: [GrupoLinea.FACTURAS],
}

/** Grupo de línea → nombre del documento contable, para el export a Excel. */
export const DOCUMENTO_DE_GRUPO: Record<GrupoLinea, string> = {
  [GrupoLinea.INGRESOS]: 'Mandato',
  [GrupoLinea.COMERCIALIZACION]: 'Mandato',
  [GrupoLinea.COSTOS]: 'Costos',
  [GrupoLinea.FACTURAS]: 'Factura',
}

interface MetaFuente {
  label: string
  title: string
  origen: string
}

/**
 * Valores que vienen de un módulo/tarifa de la app (no del ER). Etiqueta,
 * tooltip y texto de origen que se muestra debajo del concepto.
 */
export const FUENTES: Record<FuenteLinea, MetaFuente> = {
  [FuenteLinea.OM]: { label: 'O&M', title: 'O&M', origen: 'del módulo O&M' },
  [FuenteLinea.ARRIENDOS]: {
    label: 'Arriendos',
    title: 'Arriendos',
    origen: 'del módulo Arriendos',
  },
  [FuenteLinea.INTERNET]: {
    label: 'Internet',
    title: 'Internet',
    origen: 'tarifa mensual del contrato',
  },
  [FuenteLinea.SERVICIOS]: {
    label: 'Tarifa app',
    title: 'Representación / CGM',
    origen: 'tarifa de la app × kWh',
  },
  [FuenteLinea.OPERACION]: {
    label: 'Operación',
    title: 'Administración (operación)',
    origen: 'tarifa admin × ingresos',
  },
  [FuenteLinea.STARLINK]: {
    label: 'Starlink',
    title: 'Internet (Starlink)',
    origen: 'de la factura de Starlink',
  },
  [FuenteLinea.API]: {
    label: 'API',
    title: 'API de Liquidaciones',
    origen: 'de la API de Liquidaciones',
  },
}
