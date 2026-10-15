/**
 * Importar proyectos desde TSF (originabot).
 *
 * Usa `apiClient` y no una instancia propia: así viaja el Bearer de la sesión
 * (cualquiera de los dos logins), con el que Nitro comprueba que quien pide
 * entró a Operaciones. A originabot se llega con el usuario de Operaciones (ver
 * `server/utils/originabot-servicio.ts`). `baseURL: ''` porque las rutas son de
 * Nitro (`server/routes/originabot/*`), no del backend bajo `/api/v1`.
 *
 * Si originabot rechaza al usuario de Operaciones llega como 403, no 401: ver
 * `server/utils/originabot-api.ts`.
 */
import { BaseService } from '~/core/service'
import type {
  ArriendoTsf,
  BusquedaTsf,
  ProyectoTsf,
  ResultadoTsf,
} from '~/features/proyectos/types'

const RUTAS = {
  busqueda: '/originabot/minigranjas',
  minigranja: (id: number) => `/originabot/minigranjas/${id}`,
  arriendo: (id: number) => `/originabot/minigranjas/${id}/arriendo`,
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

  /** Solo el contrato de arrendamiento; null si TSF no lo tiene. */
  async arriendo(minigranjaId: number): Promise<ArriendoTsf | null> {
    const datos = await this.get<{ arriendo: ArriendoTsf | null }>(RUTAS.arriendo(minigranjaId), {
      baseURL: '',
    })
    return datos.arriendo
  }
}
