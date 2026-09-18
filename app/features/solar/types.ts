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
  [clave: string]: unknown
}

/** `GET /generacion-solar/monitoring`. */
export interface RespuestaMonitoreoSolar {
  projects: ProyectoMonitoreoSolar[]
}

/** Un proyecto del que hay lectura eléctrica (`/generacion-solar/medidores`). */
export interface ProyectoConMedidor {
  proyecto_id: number
  nombre?: string
}

/**
 * `GET /generacion-solar/medidores`: los proyectos que tienen medidor en Gaia.
 *
 * NO es el mismo conjunto que `monitoring`. Ese lista el universo de Generación
 * Solar —minigranjas con servicio de operación— y este lista de qué proyectos
 * hay lectura eléctrica, autoconsumos incluidos. Lo usa el selector del
 * diagrama fasorial, que dibuja un medidor y no una planta.
 */
export interface RespuestaProyectosConMedidor {
  projects: ProyectoConMedidor[]
}

/** `GET /generacion-solar/monitoring/:id`: datos crudos de Solenium, forma variable por planta. */
export interface DetalleMonitoreoSolar {
  generation_?: unknown
  power_curve?: unknown
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
