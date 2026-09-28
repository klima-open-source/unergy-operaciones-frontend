/**
 * Forma verificada contra `SolarLiveView.vue` y `MobileResumenView.vue`
 * (mobile). Un solo aggregate: `/generacion-solar/*` (monitoreo en vivo,
 * datos de Solenium).
 *
 * Hasta acá también vivían los tipos de `/solar/*` (estadísticas históricas),
 * que solo consumía `SolarView.vue` — 1282 líneas sin ninguna página que la
 * montara (ni `/m/solar`, que es `MobileSolarView.vue`, ni ninguna otra ruta).
 * Se borró junto con su service (`services/solar.ts`) al migrar el slice:
 * "borrar es borrar" (`AGENTS.md`), no se migra código sin consumidor.
 */

import type { GaiaSnapshot } from '~/features/fallas/utils/gaiaSnapshotToFasorial'

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

/**
 * `GET /generacion-solar/monitoring/:id`: datos crudos de Solenium, forma
 * variable por planta.
 *
 * Los campos `gaia_*` son el snapshot eléctrico del medidor (voltaje,
 * corriente y potencia por fase), y solo vienen cuando se pide con
 * `incluir_snapshot: true` (ver `obtenerDetalle`) — los usa el diagrama
 * fasorial (`FasorialButton.vue`, `~/features/fallas/utils/fasorial.ts`).
 * `GaiaSnapshot` es el tipo de ESA librería de cálculo, no de este endpoint:
 * se reimporta acá en vez de duplicar los ~15 campos porque es exactamente
 * la misma forma de dato.
 */
export interface DetalleMonitoreoSolar {
  nombre?: string
  generation_?: unknown
  power_curve?: unknown
  gaia_snapshot?: GaiaSnapshot | null
  gaia_node_id?: string | number | null
  gaia_snapshot_principal?: GaiaSnapshot | null
  gaia_node_principal?: string | number | null
  gaia_snapshot_respaldo?: GaiaSnapshot | null
  gaia_node_respaldo?: string | number | null
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
