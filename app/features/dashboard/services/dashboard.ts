/**
 * El resumen operativo de la portada: los KPIs generales y, en segundo plano,
 * el cumplimiento PPA del mes (la llamada a la API de Unergy, más lenta).
 */
import type { KpisOperativos } from '~/types/dashboard'
import type { Atencion, ResumenCumplimientoPpa } from '~/features/dashboard/types'
import { BaseService } from '~/core/service'

const RUTAS = {
  kpis: '/dashboard/kpis',
  atencion: '/dashboard/atencion',
  cumplimientoPpaResumen: '/cumplimiento/ppa/resumen',
} as const

export class DashboardService extends BaseService {
  /** Lo que pide atención: contratos por vencer, plantas sin operación, arrendadores sin cliente. */
  obtenerAtencion(): Promise<Atencion> {
    return this.get<Atencion>(RUTAS.atencion)
  }

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
      timeout: 15_000,
    })
  }
}
