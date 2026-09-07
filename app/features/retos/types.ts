/**
 * Forma verificada contra `RetosListView.vue`, `RetoDetailView.vue`, `RetoQCard.vue`,
 * `MetricaKpiCard.vue`, `MetricaDialog.vue` y `EditarTrimestreDialog.vue`.
 */

export type EstadoPeriodoReto = 'proximo' | 'en_curso' | 'cerrado'

/** El semáforo de cumplimiento — lo calcula el backend, el frontend solo lo traduce a color. */
export type EstadoMetrica = 'sin_datos' | 'en_riesgo' | 'atencion' | 'cumple' | 'excede'

export type TipoAgregacionMetrica = 'suma' | 'promedio' | 'ultimo' | string
export type DireccionMetrica = 'mayor_mejor' | 'menor_mejor'

// ── Semana ──────────────────────────────────────────────────────────────────

export interface SemanaReto {
  numero: number
  etiqueta: string
  rango_label: string
  inicio: string
  fin: string
  inicio_efectivo?: string
  fin_efectivo?: string
  es_actual?: boolean
  es_futura?: boolean
  parcial?: boolean
}

// ── Métrica ─────────────────────────────────────────────────────────────────

export interface MetricaReto {
  id: number
  nombre: string
  descripcion?: string | null
  unidad?: string | null
  meta?: number | null
  meta_esperada?: number | null
  tipo_agregacion: TipoAgregacionMetrica
  direccion: DireccionMetrica
  decimales?: number
  responsable?: string | null
  activa: boolean
  orden?: number
  estado?: EstadoMetrica
  avance_pct?: number | null
  cumplimiento_pct?: number | null
  consolidado?: number | null
  semanas_con_dato?: number
  serie?: number[]
}

export interface PayloadMetricaReto {
  nombre: string
  descripcion: string | null
  unidad: string | null
  meta: number | null
  tipo_agregacion: TipoAgregacionMetrica
  direccion: DireccionMetrica
  decimales: number
  responsable: string | null
}

export interface PayloadAlternarActivaMetrica {
  activa: boolean
}

// ── Valor semanal ─────────────────────────────────────────────────────────────

export interface ValorSemanal {
  valor: number | null
  nota: string | null
  actualizado_por?: string | null
  updated_at?: string
}

export interface PayloadValorSemanal {
  valor: number | string | null
  nota: string | null
}

/** `valores[metricaId][semanaInicio]`. */
export type ValoresPorMetrica = Record<string, Record<string, ValorSemanal>>

// ── Reto (trimestre) ──────────────────────────────────────────────────────────

/** Fila de `GET /retos` (listado): un trimestre, sin el detalle de semanas/valores. */
export interface RetoResumen {
  id: number
  nombre?: string | null
  anio: number
  trimestre: number
  fecha_inicio: string
  fecha_fin: string
  estado_periodo: EstadoPeriodoReto
  semana_actual?: number | null
  total_semanas: number
  semanas_con_datos?: number
  total_metricas?: number
  avance_global_pct?: number | null
  metricas?: MetricaReto[]
}

/** Respuesta de `GET /retos/:id`: el trimestre completo, con semanas y valores. */
export interface Reto extends RetoResumen {
  metricas: MetricaReto[]
  semanas: SemanaReto[]
  valores: ValoresPorMetrica
}

export interface PayloadEditarTrimestre {
  nombre: string | null
  descripcion: string | null
  fecha_inicio: string | null
  fecha_fin: string | null
}

/** Respuesta de `GET /retos?anio=`: autocrea los 4 trimestres de ese año. */
export interface RespuestaListaRetos {
  retos: RetoResumen[]
  anios_disponibles?: number[]
}
