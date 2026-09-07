/**
 * Proyectos próximos a energizarse.
 *
 * El pipeline vive 100 % en la BD de operaciones: un job sincroniza lo que hay
 * en Sun Factory (TSF) hacia la tabla `proyectos` (ver
 * `app/services/tsf_sync.py` en el backend). Aquí solo se lee contra esa BD y se
 * puede pedir una resincronización — no hay edición manual de estos campos.
 */
import type { RespuestaProximosEnergizar } from '~/features/proyectos/types'
import { BaseService } from '~/core/service'

const RUTAS = {
  proximosEnergizar: '/proximos-energizar',
  sincronizar: '/proximos-energizar/sync',
  proyecto: (id: number) => `/proyectos/${id}`,
} as const

export class ProximosEnergizarService extends BaseService {
  listar(): Promise<RespuestaProximosEnergizar> {
    return this.get<RespuestaProximosEnergizar>(RUTAS.proximosEnergizar)
  }

  /** Vuelve a leer el pipeline desde Sun Factory. */
  sincronizar(): Promise<unknown> {
    return this.post<unknown>(RUTAS.sincronizar)
  }

  eliminarProyecto(id: number): Promise<unknown> {
    return this.delete<unknown>(RUTAS.proyecto(id))
  }
}
