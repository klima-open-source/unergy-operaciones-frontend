/**
 * `/monitoreo/_legacy`: un único endpoint que reenvía por `action` a las rutas
 * de monitoreo que traía el legacy — lo consumen `GeneracionView.vue`,
 * `GestionFallasView.vue` (indirectamente vía proyectos) y los paneles de
 * informes mensuales.
 */
import type {
  RespuestaContratosLegacy,
  RespuestaFmoLegacy,
  RespuestaGeneracionLegacy,
  RespuestaGeneracionMensualLegacy,
  RespuestaPortafoliosLegacy,
  RespuestaProyectosLegacy,
} from '~/features/operaciones/types'
import { BaseService } from '~/core/service'

const RUTA = '/monitoreo/_legacy'

/** El tope de plantas por `getMonthlyGeneration` (`MAX_PLANTAS_MENSUAL` en el backend es 20). */
export const MAX_PLANTAS_POR_CONSULTA_MENSUAL = 8

export class MonitoreoLegacyService extends BaseService {
  obtenerProyectos(): Promise<RespuestaProyectosLegacy> {
    return this.get<RespuestaProyectosLegacy>(RUTA, { query: { action: 'getProjects' } })
  }

  obtenerGeneracion(filtros: {
    sub_project: string
    date_from: string
    date_to: string
  }): Promise<RespuestaGeneracionLegacy> {
    return this.get<RespuestaGeneracionLegacy>(RUTA, {
      query: { action: 'getGeneration', ...filtros },
    })
  }

  /**
   * Totales por mes de varias plantas en una llamada (el backend acepta hasta
   * `MAX_PLANTAS_POR_CONSULTA_MENSUAL`).
   */
  obtenerGeneracionMensual(filtros: {
    sub_projects: string[]
    date_from: string
    date_to: string
  }): Promise<RespuestaGeneracionMensualLegacy> {
    return this.get<RespuestaGeneracionMensualLegacy>(RUTA, {
      query: {
        action: 'getMonthlyGeneration',
        sub_projects: filtros.sub_projects.join(','),
        date_from: filtros.date_from,
        date_to: filtros.date_to,
      },
    })
  }

  obtenerDatosFmo(filtros: {
    sub_project: string
    date_from: string
    date_to: string
  }): Promise<RespuestaFmoLegacy> {
    return this.get<RespuestaFmoLegacy>(RUTA, { query: { action: 'getFMOData', ...filtros } })
  }

  obtenerPortafolios(): Promise<RespuestaPortafoliosLegacy> {
    return this.get<RespuestaPortafoliosLegacy>(RUTA, { query: { action: 'getPortfolios' } })
  }

  obtenerTodosLosContratos(): Promise<RespuestaContratosLegacy> {
    return this.get<RespuestaContratosLegacy>(RUTA, { query: { action: 'getAllContratos' } })
  }
}
