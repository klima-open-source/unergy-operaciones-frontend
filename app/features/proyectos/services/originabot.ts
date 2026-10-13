/**
 * Importar proyectos desde TSF (originabot).
 *
 * Usa `apiClient` y no una instancia propia: así viaja el Bearer de Unergy Auth
 * y se renueva si está por vencer (`~/core/client.ts`), que es justo el token que
 * originabot valida. `baseURL: ''` porque las rutas son de Nitro
 * (`server/routes/originabot/*`), no del backend de operaciones bajo `/api/v1`.
 *
 * Un token que originabot no acepta (sesión del login propio, o de otro entorno)
 * llega como 403, no 401: ver `server/utils/originabot-api.ts`.
 */
import { BaseService } from '~/core/service'
import type { BusquedaTsf, ProyectoTsf, ResultadoTsf } from '~/features/proyectos/types'

const RUTAS = {
  busqueda: '/originabot/minigranjas',
  minigranja: (id: number) => `/originabot/minigranjas/${id}`,
  sugerencias: '/originabot/sugerencias',
} as const

export class OriginabotService extends BaseService {
  buscar(q: string): Promise<BusquedaTsf> {
    return this.get<BusquedaTsf>(RUTAS.busqueda, { baseURL: '', query: { q } })
  }

  /** Todos los proyectos de TSF en construcción u operación. */
  async sugerencias(): Promise<ResultadoTsf[]> {
    const datos = await this.get<{ resultados: ResultadoTsf[] }>(RUTAS.sugerencias, { baseURL: '' })
    return datos.resultados
  }

  minigranja(id: number): Promise<ProyectoTsf> {
    return this.get<ProyectoTsf>(RUTAS.minigranja(id), { baseURL: '' })
  }
}
