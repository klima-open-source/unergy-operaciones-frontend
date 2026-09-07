/** CRUD de fronteras comerciales y su sincronización con Quoia (el CGM). */
import type { Frontera, FronteraPendienteQuoia, PayloadFrontera } from '~/features/fronteras/types'
import { BaseService } from '~/core/service'

const BASE = '/fronteras'

const RUTAS = {
  fronteras: BASE,
  frontera: (id: Frontera['id']) => `${BASE}/${id}`,
  quoiaPendientes: `${BASE}/quoia/pendientes`,
  quoiaConfirmar: (frtCode: string) => `${BASE}/quoia/pendientes/${frtCode}/confirmar`,
  quoiaIgnorar: (frtCode: string) => `${BASE}/quoia/pendientes/${frtCode}/ignorar`,
} as const

export class FronterasService extends BaseService {
  listar(filtros: { limit?: number } = {}): Promise<Frontera[]> {
    return this.get<Frontera[]>(RUTAS.fronteras, { query: { ...filtros } })
  }

  /** `forzar`: repite la creación con `forzar: true` cuando el 409 de nombre parecido se confirma igual. */
  crear(payload: PayloadFrontera, forzar = false): Promise<Frontera> {
    return this.post<Frontera>(RUTAS.fronteras, payload, { query: { forzar } })
  }

  actualizar(id: Frontera['id'], payload: PayloadFrontera): Promise<Frontera> {
    return this.patch<Frontera>(RUTAS.frontera(id), payload)
  }

  eliminar(id: Frontera['id']): Promise<unknown> {
    return this.delete<unknown>(RUTAS.frontera(id))
  }

  listarPendientesQuoia(): Promise<FronteraPendienteQuoia[]> {
    return this.get<FronteraPendienteQuoia[]>(RUTAS.quoiaPendientes)
  }

  /** `forzar` salta el aviso de "ya existe una con nombre parecido", igual que crear(). */
  confirmarPendienteQuoia(frtCode: string, proyectoId: number, forzar = false): Promise<unknown> {
    return this.post<unknown>(
      RUTAS.quoiaConfirmar(frtCode),
      { proyecto_id: proyectoId },
      {
        query: { forzar },
      },
    )
  }

  ignorarPendienteQuoia(frtCode: string): Promise<unknown> {
    return this.post<unknown>(RUTAS.quoiaIgnorar(frtCode), {})
  }
}
