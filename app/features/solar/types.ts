/**
 * Forma verificada contra `SolarLiveView.vue`, `SolarView.vue` y
 * `MobileResumenView.vue` (mobile). Dos aggregates:
 * `/generacion-solar/*` (monitoreo en vivo, datos de Solenium) y `/solar/*`
 * (estadísticas históricas).
 */

// ── Monitoreo en vivo (`/generacion-solar/*`) ─────────────────────────────────

export interface ProyectoMonitoreoSolar {
  proyecto_id: number
  nombre?: string
  status?: string
  power_kw?: number | null
  utilization_pct?: number | null
  availability_pct?: number | null
  /** P90 diario, en kWh — meta contra la que se compara la generación de hoy. */
  p90_diario_kwh?: number
  [clave: string]: unknown
}

/** `GET /generacion-solar/monitoring`. */
export interface RespuestaMonitoreoSolar {
  projects: ProyectoMonitoreoSolar[]
}

/** Un punto de la curva de potencia (inversores) o del medidor, kW cada 5 min. */
export interface PuntoCurvaSolar {
  time?: string
  kw?: number | string | null
  [clave: string]: unknown
}

/** El medidor ya resuelto por el backend (`medidor`, `medidor_principal`, `medidor_respaldo`). */
export interface MedidorMonitoreoSolar {
  node_id?: string | number
  curva?: PuntoCurvaSolar[]
  energia_kwh?: number | null
  energia_hasta?: string | null
  [clave: string]: unknown
}

/** Generación de un día del histórico de 30 días. */
export interface GeneracionDiaSolar {
  date?: string
  kwh?: number
}

/**
 * `GET /generacion-solar/monitoring/:id`: datos crudos de Solenium, forma
 * variable por planta. Solo se tipan los campos que algún consumidor lee de
 * verdad — ver la lista completa en `detalleMonitoreo.guard.test.ts`.
 */
export interface DetalleMonitoreoSolar {
  power_curve?: PuntoCurvaSolar[]
  generation_today_kwh?: number | null
  generation_today_hasta?: string | null
  generation_30d?: GeneracionDiaSolar[]
  medidor?: MedidorMonitoreoSolar | null
  medidor_principal?: MedidorMonitoreoSolar | null
  medidor_respaldo?: MedidorMonitoreoSolar | null
  [clave: string]: unknown
}

/** `GET /generacion-solar/monitoring/:id/inverters-power`. */
export interface PotenciaInversores {
  [clave: string]: unknown
}

/** Una fila del "top" de proyectos por generación de `resumen-dia`. */
export interface TopGeneracionProyecto {
  proyecto_id: number
  nombre?: string
  kwh: number
  [clave: string]: unknown
}

export interface ResumenGeneracionDiaFuente {
  total?: number
  top?: TopGeneracionProyecto[]
  [clave: string]: unknown
}

/** `GET /generacion-solar/resumen-dia`: top de generación de hoy por medidor e inversor. */
export interface RespuestaResumenGeneracionDia {
  medidor?: ResumenGeneracionDiaFuente
  inversor?: ResumenGeneracionDiaFuente
  fecha?: string
  [clave: string]: unknown
}

export interface GeneracionHoyProyecto {
  proyecto_id: number
  kwh_real?: number | null
  fuente?: string
}

/** `GET /generacion-solar/generacion-hoy`. */
export interface RespuestaGeneracionHoy {
  proyectos: GeneracionHoyProyecto[]
  total?: number
}

/** `GET /generacion-solar/proyecto/:id/historial`. */
export interface HistorialGeneracionProyecto {
  puntos: unknown[]
  total_kwh: number
}

// ── Estadísticas históricas (`/solar/*`) ──────────────────────────────────────

/** `GET /solar/filtros`: catálogos para armar los selectores. */
export interface FiltrosSolar {
  estados: string[]
  [clave: string]: unknown
}

export interface FiltrosGeneracionSolar {
  fechaIni?: string
  fechaFin?: string
  municipio?: string
  departamento?: string
  estado?: string
}

export interface ProyectoSolarResumen {
  id: number
  nombre_comercial?: string
  [clave: string]: unknown
}

/** `GET /solar/generacion`: la forma la decide el backend según agrupación/rango. */
export interface RespuestaGeneracionSolar {
  [clave: string]: unknown
}

/** `GET /solar/ranking`. */
export interface RespuestaRankingSolar {
  [clave: string]: unknown
}

/** `GET /solar/comparacion`. */
export interface RespuestaComparacionSolar {
  [clave: string]: unknown
}

export interface RespuestaReloadCacheSolar {
  proyectos: number
  registros_generacion: number
  [clave: string]: unknown
}
