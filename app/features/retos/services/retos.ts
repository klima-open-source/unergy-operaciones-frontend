/** Retos Q: los trimestres, sus métricas y los valores semanales de cada una. */
import type {
  MetricaReto,
  PayloadAlternarActivaMetrica,
  PayloadEditarTrimestre,
  PayloadMetricaReto,
  PayloadValorSemanal,
  Reto,
  RespuestaListaRetos,
} from '~/features/retos/types'
import { BaseService } from '~/core/service'

const BASE = '/retos'

const RUTAS = {
  retos: BASE,
  reto: (id: Reto['id']) => `${BASE}/${id}`,
  metricas: (retoId: Reto['id']) => `${BASE}/${retoId}/metricas`,
  metrica: (metricaId: MetricaReto['id']) => `${BASE}/metricas/${metricaId}`,
  valorSemanal: (metricaId: MetricaReto['id'], semanaInicio: string) =>
    `${BASE}/metricas/${metricaId}/valores/${semanaInicio}`,
  copiarMetricas: (retoId: Reto['id'], origenId: Reto['id']) =>
    `${BASE}/${retoId}/metricas/copiar-desde/${origenId}`,
} as const

export class RetosService extends BaseService {
  /** `GET /retos?anio=` autocrea los 4 trimestres de ese año. */
  listarPorAnio(anio: number): Promise<RespuestaListaRetos> {
    return this.get<RespuestaListaRetos>(RUTAS.retos, { query: { anio } })
  }

  obtener(id: Reto['id']): Promise<Reto> {
    return this.get<Reto>(RUTAS.reto(id))
  }

  actualizarTrimestre(id: Reto['id'], payload: PayloadEditarTrimestre): Promise<Reto> {
    return this.patch<Reto>(RUTAS.reto(id), payload)
  }

  crearMetrica(retoId: Reto['id'], payload: PayloadMetricaReto): Promise<MetricaReto> {
    return this.post<MetricaReto>(RUTAS.metricas(retoId), payload)
  }

  actualizarMetrica(
    metricaId: MetricaReto['id'],
    payload: PayloadMetricaReto,
  ): Promise<MetricaReto> {
    return this.patch<MetricaReto>(RUTAS.metrica(metricaId), payload)
  }

  alternarActivaMetrica(
    metricaId: MetricaReto['id'],
    payload: PayloadAlternarActivaMetrica,
  ): Promise<MetricaReto> {
    return this.patch<MetricaReto>(RUTAS.metrica(metricaId), payload)
  }

  eliminarMetrica(metricaId: MetricaReto['id']): Promise<unknown> {
    return this.delete<unknown>(RUTAS.metrica(metricaId))
  }

  /** Devuelve la `MetricaReto` recalculada — no la celda — con el consolidado y el estado al día. */
  guardarValorSemanal(
    metricaId: MetricaReto['id'],
    semanaInicio: string,
    payload: PayloadValorSemanal,
  ): Promise<MetricaReto> {
    return this.put<MetricaReto>(RUTAS.valorSemanal(metricaId, semanaInicio), payload)
  }

  copiarMetricasDesde(retoId: Reto['id'], origenId: Reto['id']): Promise<unknown> {
    return this.post<unknown>(RUTAS.copiarMetricas(retoId, origenId))
  }
}
