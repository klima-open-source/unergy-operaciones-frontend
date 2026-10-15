/** Patrimonios autónomos: las fiducias a través de las que se tiene una planta. */
import type { Patrimonio, PatrimonioGeneral, PayloadPatrimonio } from '~/features/clientes/types'
import { BaseService } from '~/core/service'

const BASE = '/patrimonios'

const RUTAS = {
  patrimonios: BASE,
  patrimonio: (id: Patrimonio['id']) => `${BASE}/${id}`,
} as const

export class PatrimoniosService extends BaseService {
  /** El árbol: los generales, con sus subpatrimonios y las plantas de cada uno. */
  listar(): Promise<PatrimonioGeneral[]> {
    return this.get<PatrimonioGeneral[]>(RUTAS.patrimonios)
  }

  crear(payload: PayloadPatrimonio): Promise<Patrimonio> {
    return this.post<Patrimonio>(RUTAS.patrimonios, payload)
  }

  actualizar(id: Patrimonio['id'], payload: PayloadPatrimonio): Promise<Patrimonio> {
    return this.patch<Patrimonio>(RUTAS.patrimonio(id), payload)
  }

  /** `409` si todavía tiene plantas o subpatrimonios. */
  eliminar(id: Patrimonio['id']): Promise<unknown> {
    return this.delete<unknown>(RUTAS.patrimonio(id))
  }
}
