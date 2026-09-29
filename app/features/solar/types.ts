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
  /** P90 del día, en kWh — meta contra la que `SolarLiveView.vue` compara lo generado hoy. */
  p90_diario_kwh?: number | null
  [clave: string]: unknown
}

/** `GET /generacion-solar/monitoring`. */
export interface RespuestaMonitoreoSolar {
  projects: ProyectoMonitoreoSolar[]
}

/** Un punto de `power_curve` (inversores) o de `medidor.curva` (medidor): potencia a un instante. */
export interface PuntoPotenciaSolar {
  time?: string
  kw?: number | null
  [clave: string]: unknown
}

/** Una fila del histórico de 30 días (`generation_30d`), usada como respaldo del acumulado de hoy. */
export interface GeneracionDiaHistorial {
  date: string
  kwh: number
}

/**
 * El medidor que el BACKEND ya resolvió para este proyecto (ver
 * `~/features/solar/serieSolar`): su curva de potencia y el contador de
 * energía acumulada del día.
 */
export interface MedidorMonitoreoSolar {
  curva?: PuntoPotenciaSolar[]
  energia_kwh?: number | null
  energia_hasta?: string | null
  /** Id del nodo Gaia de este medidor — se compara contra `medidor_principal`/`medidor_respaldo` para saber cuál ganó. */
  node_id?: string | number | null
  [clave: string]: unknown
}

/**
 * El medidor PRINCIPAL o RESPALDO tal como Solenium los expone, antes de que
 * el backend elija cuál mostrar en `medidor` — `SolarLiveView.vue` solo lo usa
 * para saber cuál de los dos ganó, comparando `node_id`.
 */
export interface MedidorReferenciaSolar {
  node_id?: string | number | null
  [clave: string]: unknown
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
  /** Curva de potencia de INVERSORES del día, cada 5 min (ver `~/features/solar/serieSolar`). */
  power_curve?: PuntoPotenciaSolar[]
  /** El medidor a mostrar, ya elegido por el backend (ver `medidorDelDetalle`). */
  medidor?: MedidorMonitoreoSolar | null
  /** Energía acumulada de hoy según inversores (`eae`), en kWh — preferida sobre integrar la curva. */
  generation_today_kwh?: number | null
  /** Hasta qué hora `HH:MM` cubre `generation_today_kwh`. */
  generation_today_hasta?: string | null
  /** Histórico de 30 días, respaldo cuando `generation_today_kwh` no vino. */
  generation_30d?: GeneracionDiaHistorial[]
  gaia_snapshot?: GaiaSnapshot | null
  gaia_node_id?: string | number | null
  gaia_snapshot_principal?: GaiaSnapshot | null
  gaia_node_principal?: string | number | null
  gaia_snapshot_respaldo?: GaiaSnapshot | null
  gaia_node_respaldo?: string | number | null
  /** Tipo del medidor mostrado en `medidor` (según lo resuelva el backend). */
  medidor_tipo?: string | null
  /** El medidor PRINCIPAL sin resolver — ver `MedidorReferenciaSolar`. */
  medidor_principal?: MedidorReferenciaSolar | null
  /** El medidor de RESPALDO sin resolver, si el proyecto tiene dos. */
  medidor_respaldo?: MedidorReferenciaSolar | null
  [clave: string]: unknown
}

/** Un inversor de `PotenciaInversores.inverters`: su serie de potencia del día. */
export interface PotenciaInversor {
  dev_name: string
  points: PuntoPotenciaSolar[]
  peak_kw?: number | null
  [clave: string]: unknown
}

/** `GET /generacion-solar/monitoring/:id/inverters-power`. */
export interface PotenciaInversores {
  inverters?: PotenciaInversor[]
  granularidad?: string
  date_from?: string
  date_to?: string
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
