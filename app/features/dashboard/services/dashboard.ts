/**
 * El resumen operativo de la portada: los KPIs generales y, en segundo plano,
 * el cumplimiento PPA del mes (la llamada a la API de Unergy, más lenta).
 */
import type { KpisOperativos } from '~/types/dashboard'
import type { ResumenCumplimientoPpa } from '~/features/dashboard/types'
import { BaseService } from '~/core/service'

const RUTAS = {
  kpis: '/dashboard/kpis',
  cumplimientoPpaResumen: '/cumplimiento/ppa/resumen',
} as const

export class DashboardService extends BaseService {
  obtenerKpis(): Promise<KpisOperativos> {
    return this.get<KpisOperativos>(RUTAS.kpis)
  }

  /** La API de Unergy es más lenta que la del backend propio: 15 s de margen. */
  obtenerResumenCumplimiento({
    year,
    month,
  }: {
    year: number
    month: number
  }): Promise<ResumenCumplimientoPpa> {
    return this.get<ResumenCumplimientoPpa>(RUTAS.cumplimientoPpaResumen, {
      query: { year, month },
      signal: () => AbortSignal.timeout(15_000),
    })
  }
}
