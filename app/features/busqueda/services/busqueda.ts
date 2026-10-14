/** Búsqueda global (⌘K): plantas, clientes, contratos y fronteras en una llamada. */
import { BaseService } from '~/core/service'
import type { RespuestaBusqueda } from '~/features/busqueda/types'

const RUTAS = { busqueda: '/busqueda' } as const

export class BusquedaService extends BaseService {
  buscar(q: string): Promise<RespuestaBusqueda> {
    return this.get<RespuestaBusqueda>(RUTAS.busqueda, { query: { q } })
  }
}
