/**
 * Catálogos y etiquetas del módulo de Liquidaciones.
 *
 * Fuente única de verdad — antes estaban duplicados en cuatro vistas. Estos
 * valores reflejan los enums del backend (ver `/liquidaciones/catalogos/tipos`).
 *
 * MIGRACIÓN — venían de `app/constants/liquidaciones.js`. Van al slice y no a
 * `app/config/` (que es lo que decía el roadmap) porque `config/` es para lo que
 * cambia una vez por proyecto —branding, rutas de login—, y esto es vocabulario
 * de un dominio concreto: pertenece a quien lo habla.
 *
 * Varias listas de abajo **no tienen consumidor hoy**; van marcadas una por una.
 * Se conservan porque son datos del dominio que reflejan enums vivos del
 * backend, no abstracciones «por si acaso», y porque las vistas que las van a
 * necesitar son las que se migran en la fase 3. Si al llegar ahí siguen sin
 * usarse, se borran.
 */
import type { GandalfBadgeColor } from '~/components/gandalf/base/badge'

// ── Estados del workflow ─────────────────────────────────────────────────────

/** Los ocho estados, en el orden del pipeline — selector de `LiquidacionDetailView.vue`. */
export const ESTADOS_LIQUIDACION = [
  'iniciada',
  'costos_registrados',
  'xm_procesado',
  'mandatos_emitidos',
  'en_contabilidad',
  'en_revisoria',
  'facturado',
  'entregado',
] as const

export type EstadoLiquidacion = (typeof ESTADOS_LIQUIDACION)[number]

export const ESTADO_LABEL: Record<EstadoLiquidacion, string> = {
  iniciada: 'Iniciada',
  costos_registrados: 'Costos registrados',
  xm_procesado: 'XM procesado',
  mandatos_emitidos: 'Mandatos emitidos',
  en_contabilidad: 'En contabilidad',
  en_revisoria: 'En revisoría',
  facturado: 'Facturado',
  entregado: 'Entregado',
}

/**
 * Color de `GBadge` por estado.
 *
 * Es el único mapa de aquí acoplado a la capa de UI. `entregado` usaba
 * `contrast` en el `Tag` de PrimeVue, sin equivalente en `GBadge`; cae en
 * `default`.
 */
export const ESTADO_SEVERITY: Record<EstadoLiquidacion, GandalfBadgeColor> = {
  iniciada: 'default',
  costos_registrados: 'information',
  xm_procesado: 'information',
  mandatos_emitidos: 'warning',
  en_contabilidad: 'warning',
  en_revisoria: 'warning',
  facturado: 'success',
  entregado: 'default',
}

/** Color por estado, para barras de pipeline y gráficos. */
export const ESTADO_COLOR: Record<EstadoLiquidacion, string> = {
  iniciada: '#9b8fb0',
  costos_registrados: '#3B82F6',
  xm_procesado: '#06B6D4',
  mandatos_emitidos: '#F59E0B',
  en_contabilidad: '#D97706',
  en_revisoria: '#CA8A04',
  facturado: '#10B981',
  entregado: '#915BD8',
}

// ── Clasificación de proyecto ────────────────────────────────────────────────

/** Opciones del selector "Tipo venta" al crear una liquidación — ver `LiquidacionesListView.vue`. */
export const TIPOS_VENTA = ['bolsa', 'ppa', 'interno', 'autoconsumo'] as const

/** Pestañas Todos / Minigranjas / Autoconsumo. **Sin consumidor hoy.** */
export const TIPOS_PROYECTO_TABS = [
  { key: 'todos', label: 'Todos', filter: null },
  { key: 'minigranja', label: 'Minigranjas', filter: 'minigranja' },
  { key: 'autoconsumo', label: 'Autoconsumo', filter: 'autoconsumo' },
] as const

// ── Tipos de línea de mandato ────────────────────────────────────────────────

/** **Sin consumidor hoy.** */
export const TIPOS_LINEA_INGRESOS = [
  'ingreso_bruto',
  'ajuste_xm',
  'ajuste_unergy',
  'ajuste_comercializacion',
  'intereses',
  'otro_ingreso',
  'despacho',
  'ventas_en_bolsa',
  'compras_en_bolsa',
  'redistribucion_ingresos',
  'valor_a_pagar',
] as const

/** **Sin consumidor hoy.** */
export const TIPOS_LINEA_COSTOS = [
  'mantenimiento',
  'arriendo',
  'servicio_internet',
  'poliza_cumplimiento',
  'servicios_publicos_consumo',
  'cambio_equipos_medida',
  'seguro',
  'otro_costo',
  'comercializacion',
  'representacion',
  'cgm',
  'administracion',
  'iva',
  'retencion_fuente',
  'reteica',
  'ica_opex',
  'otro_impuesto',
] as const

/** Los costos operativos: el prefijo de `TIPOS_LINEA_COSTOS`. **Sin consumidor hoy.** */
export const TIPOS_COSTO = [
  'mantenimiento',
  'arriendo',
  'servicio_internet',
  'poliza_cumplimiento',
  'servicios_publicos_consumo',
  'cambio_equipos_medida',
  'seguro',
  'otro_costo',
] as const

export const TIPOS_SERVICIO = [
  { label: 'Representación', value: 'representacion' },
  { label: 'CGM', value: 'cgm' },
  { label: 'Administración Operación', value: 'administracion_operacion' },
  { label: 'Otro', value: 'otro' },
] as const

// ── Etiquetas legibles ───────────────────────────────────────────────────────

export const ETIQUETAS: Record<string, string> = {
  ingreso_bruto: 'Ingreso Bruto',
  ajuste_xm: 'Ajuste Xm',
  ajuste_unergy: 'Ajuste Unergy',
  ajuste_comercializacion: 'Comercialización',
  intereses: 'Intereses',
  otro_ingreso: 'Otro Ingreso',
  despacho: 'Despacho',
  ventas_en_bolsa: 'Ventas en Bolsa',
  compras_en_bolsa: 'Compras en Bolsa',
  redistribucion_ingresos: 'Redistribución de Ingresos de acuerdo al Protocolo',
  mantenimiento: 'Mantenimiento',
  arriendo: 'Arriendo',
  servicio_internet: 'Servicio de Internet',
  poliza_cumplimiento: 'Póliza de Cumplimiento',
  servicios_publicos_consumo: 'Servicios Públicos Consumo de energía',
  cambio_equipos_medida: 'Cambio Equipos de Medida',
  seguro: 'Seguro',
  otro_costo: 'Otro Costo',
  comercializacion: 'Comercialización',
  representacion: 'Representación',
  cgm: 'CGM',
  administracion: 'Administración',
  iva: 'IVA',
  retencion_fuente: 'Retención en la Fuente',
  reteica: 'Reteica',
  ica_opex: 'ICA OPEX',
  otro_impuesto: 'Otro Impuesto',
  valor_a_pagar: 'Valor a Pagar',
}

export const LABEL_SERVICIO: Record<string, string> = {
  representacion: 'Representación',
  cgm: 'CGM',
  administracion_operacion: 'Administración',
  otro: 'Otro',
}

// ── Clasificación para el estado de resultados ───────────────────────────────
// Qué líneas suman al ingreso bruto y cuáles son costo de comercialización.

export const TIPOS_INGRESO_BRUTO: ReadonlySet<string> = new Set([
  'ingreso_bruto',
  'despacho',
  'ventas_en_bolsa',
  'redistribucion_ingresos',
])

export const TIPOS_COMERCIALIZACION: ReadonlySet<string> = new Set([
  'ajuste_comercializacion',
  'comercializacion',
  'compras_en_bolsa',
])
