/** Histórico de ajustes semanales de garantías (`AjustesXM/HistoricoTab.vue`). */
import type { AjusteGarantia, PayloadAjusteGarantia } from '~/features/garantias/types'
import { BaseService } from '~/core/service'

const BASE = '/garantias-ajustes'

const RUTAS = {
  ajustes: BASE,
  ajuste: (id: AjusteGarantia['id']) => `${BASE}/${id}`,
} as const

export class AjustesGarantiaService extends BaseService {
  listar(): Promise<AjusteGarantia[]> {
    return this.get<AjusteGarantia[]>(RUTAS.ajustes)
  }

  crear(payload: PayloadAjusteGarantia): Promise<AjusteGarantia> {
    return this.post<AjusteGarantia>(RUTAS.ajustes, payload)
  }

  actualizar(id: AjusteGarantia['id'], payload: PayloadAjusteGarantia): Promise<AjusteGarantia> {
    return this.patch<AjusteGarantia>(RUTAS.ajuste(id), payload)
  }

  eliminar(id: AjusteGarantia['id']): Promise<unknown> {
    return this.delete<unknown>(RUTAS.ajuste(id))
  }
}
