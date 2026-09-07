/** Gestión de usuarios de la plataforma. */
import type { Paginado } from '~/types/api'
import type { PayloadUsuario, Usuario } from '~/features/admin/types'
import { BaseService } from '~/core/service'

const BASE = '/usuarios'

const RUTAS = {
  usuarios: BASE,
  usuario: (id: number) => `${BASE}/${id}`,
} as const

export class UsuariosService extends BaseService {
  async listar({ size }: { size?: number } = {}): Promise<Usuario[]> {
    const data = await this.get<Paginado<Usuario>>(RUTAS.usuarios, {
      query: size ? { size } : undefined,
    })
    return data.items
  }

  crear(payload: PayloadUsuario): Promise<Usuario> {
    return this.post<Usuario>(RUTAS.usuarios, payload)
  }

  actualizar(id: Usuario['id'], payload: PayloadUsuario): Promise<Usuario> {
    return this.patch<Usuario>(RUTAS.usuario(id), payload)
  }
}
