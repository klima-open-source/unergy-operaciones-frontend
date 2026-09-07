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
  RespuestaPortafoliosLegacy,
  RespuestaProyectosLegacy,
} from '~/features/operaciones/types'
import { BaseService } from '~/core/service'

const RUTA = '/monitoreo/_legacy'

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
