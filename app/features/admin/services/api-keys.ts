/** API Keys de un usuario: heredan su rol y permisos. */
import type { ApiKey, Usuario } from '~/features/admin/types'
import { BaseService } from '~/core/service'

const BASE = '/api-keys'

const RUTAS = {
  apiKeys: BASE,
  porUsuario: (usuarioId: Usuario['id']) => `${BASE}/user/${usuarioId}`,
  apiKey: (id: ApiKey['id']) => `${BASE}/${id}`,
  toggle: (id: ApiKey['id']) => `${BASE}/${id}/toggle`,
} as const

interface RespuestaCreacion {
  api_key: string
}

export class ApiKeysService extends BaseService {
  listarPorUsuario(usuarioId: Usuario['id']): Promise<ApiKey[]> {
    return this.get<ApiKey[]>(RUTAS.porUsuario(usuarioId))
  }

  /** La key completa solo viaja una vez, en esta respuesta — no se puede volver a leer. */
  crear(usuarioId: Usuario['id'], nombre: string): Promise<RespuestaCreacion> {
    return this.post<RespuestaCreacion>(RUTAS.apiKeys, { usuario_id: usuarioId, nombre })
  }

  alternarActiva(id: ApiKey['id']): Promise<ApiKey> {
    return this.patch<ApiKey>(RUTAS.toggle(id))
  }

  eliminar(id: ApiKey['id']): Promise<unknown> {
    return this.delete<unknown>(RUTAS.apiKey(id))
  }
}
