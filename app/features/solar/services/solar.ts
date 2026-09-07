/** Estadísticas históricas de generación solar: filtros, ranking, comparación. */
import type {
  FiltrosGeneracionSolar,
  FiltrosSolar,
  ProyectoSolarResumen,
  RespuestaComparacionSolar,
  RespuestaGeneracionSolar,
  RespuestaRankingSolar,
  RespuestaReloadCacheSolar,
} from '~/features/solar/types'
import { BaseService } from '~/core/service'

const BASE = '/solar'

const RUTAS = {
  filtros: `${BASE}/filtros`,
  proyectos: `${BASE}/proyectos`,
  generacion: `${BASE}/generacion`,
  ranking: `${BASE}/ranking`,
  comparacion: `${BASE}/comparacion`,
  reloadCache: `${BASE}/reload-cache`,
} as const

export class SolarService extends BaseService {
  obtenerFiltros(): Promise<FiltrosSolar> {
    return this.get<FiltrosSolar>(RUTAS.filtros)
  }

  listarProyectos(): Promise<ProyectoSolarResumen[]> {
    return this.get<ProyectoSolarResumen[]>(RUTAS.proyectos)
  }

  // `{ ...filtros }`: una `interface` no tiene firma de índice y `Query` (de
  // `air`) la exige — un objeto fresco sí la satisface. Ver la nota del propio
  // README de `air`.
  obtenerGeneracion(filtros: FiltrosGeneracionSolar): Promise<RespuestaGeneracionSolar> {
    return this.get<RespuestaGeneracionSolar>(RUTAS.generacion, { query: { ...filtros } })
  }

  obtenerRanking(
    filtros: FiltrosGeneracionSolar & { top?: number },
  ): Promise<RespuestaRankingSolar> {
    return this.get<RespuestaRankingSolar>(RUTAS.ranking, { query: { ...filtros } })
  }

  obtenerComparacion(
    filtros: FiltrosGeneracionSolar & { sicNacionales?: string; idsInternos?: string },
  ): Promise<RespuestaComparacionSolar> {
    return this.get<RespuestaComparacionSolar>(RUTAS.comparacion, { query: { ...filtros } })
  }

  recargarCache(): Promise<RespuestaReloadCacheSolar> {
    return this.post<RespuestaReloadCacheSolar>(RUTAS.reloadCache)
  }
}
