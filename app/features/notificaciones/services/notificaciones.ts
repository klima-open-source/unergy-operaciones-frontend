/** Las notificaciones de la campana. */
import type { Notificacion } from '~/features/notificaciones/types'
import { BaseService } from '~/core/service'

/** El backend contesta a veces un array plano, a veces `{ items: [...] }`. */
interface RespuestaListado {
  items?: Notificacion[]
}

interface RespuestaConteo {
  no_leidas?: number
  count?: number
  unread?: number
}

export class NotificacionesService extends BaseService {
  async contarNoLeidas(): Promise<number> {
    const data = await this.get<RespuestaConteo>('/notificaciones/count')
    return data.no_leidas ?? data.count ?? data.unread ?? 0
  }

  async listar(limit = 20): Promise<Notificacion[]> {
    const data = await this.get<Notificacion[] | RespuestaListado>('/notificaciones', {
      query: { limit },
    })
    return Array.isArray(data) ? data : (data.items ?? [])
  }

  marcarLeida(id: Notificacion['id']): Promise<void> {
    return this.patch(`/notificaciones/${id}/leer`)
  }

  marcarTodasLeidas(): Promise<void> {
    return this.patch('/notificaciones/leer-todas')
  }
}
