/**
 * El centro de alertas: los KPIs operativos que resumen la portada y las
 * inconsistencias de contratos PPA en GESCON.
 */
import type { KpisOperativos } from '~/types/dashboard'
import type { AlertasContratosPpa } from '~/features/alertas/types'
import { BaseService } from '~/core/service'

const RUTAS = {
  kpis: '/dashboard/kpis',
  contratosPpa: '/alertas/contratos-ppa',
} as const

export class AlertasService extends BaseService {
  obtenerKpis(): Promise<KpisOperativos> {
    return this.get<KpisOperativos>(RUTAS.kpis)
  }

  /** Proyectos sin contrato activo en GESCON (huérfanos) o con más de uno (duplicados). */
  obtenerContratosPpa(): Promise<AlertasContratosPpa> {
    return this.get<AlertasContratosPpa>(RUTAS.contratosPpa)
  }
}
