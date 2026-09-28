/**
 * El Modelo Predictivo de garantías: cuánto va a pedir XM en cada vencimiento,
 * estimado con antelación (percentil 90) antes de que XM lo publique.
 */
import type { Id } from '~/types/api'
import type {
  DetalleVencimiento,
  ParametrosPlanModeloPredictivo,
  PlanModeloPredictivo,
} from '~/features/garantias/types'
import { BaseService } from '~/core/service'

const BASE = '/garantias/modelo'

const RUTAS = {
  plan: `${BASE}/plan`,
  detalle: (id: Id) => `${BASE}/detalle/${encodeURIComponent(id)}`,
} as const

export class ModeloPredictivoService extends BaseService {
  getPlan(parametros: ParametrosPlanModeloPredictivo): Promise<PlanModeloPredictivo> {
    // Objeto fresco, no el valor tipado tal cual: una `interface` no tiene firma
    // de índice y el `Record<string, any>` que `ofetch` pide para la query la exige.
    return this.get<PlanModeloPredictivo>(RUTAS.plan, { query: { ...parametros } })
  }

  getDetalle(id: Id): Promise<DetalleVencimiento> {
    return this.get<DetalleVencimiento>(RUTAS.detalle(id))
  }
}
