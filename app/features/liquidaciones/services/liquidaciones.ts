/**
 * `/liquidaciones`: la base propia del backend — el detalle operativo de cada
 * liquidación de proyecto, su informe en HTML y los resúmenes que espejan el
 * Panel Contable. Distinto de `LiquidacionesApiService`, que habla con el
 * proxy a la API de Liquidaciones de Unergy (`/liquidaciones-api`).
 */
import type {
  InformeLiquidacion,
  Liquidacion,
  PayloadActualizarLiquidacion,
  PayloadCrearLiquidacion,
  RespuestaResumenPanel,
  RespuestaResumenPanelRango,
} from '~/features/liquidaciones/types'
import { BaseService } from '~/core/service'

const BASE = '/liquidaciones'

const RUTAS = {
  liquidaciones: BASE,
  liquidacion: (id: Liquidacion['id']) => `${BASE}/${id}`,
  informe: (id: Liquidacion['id']) => `${BASE}/${id}/informe`,
  resumenPanel: `${BASE}/resumen-panel`,
  resumenPanelRango: `${BASE}/resumen-panel-rango`,
} as const

export class LiquidacionesService extends BaseService {
  obtener(id: Liquidacion['id']): Promise<Liquidacion> {
    return this.get<Liquidacion>(RUTAS.liquidacion(id))
  }

  crear(payload: PayloadCrearLiquidacion): Promise<Liquidacion> {
    return this.post<Liquidacion>(RUTAS.liquidaciones, payload)
  }

  actualizar(id: Liquidacion['id'], payload: PayloadActualizarLiquidacion): Promise<unknown> {
    return this.patch<unknown>(RUTAS.liquidacion(id), payload)
  }

  obtenerInforme(id: Liquidacion['id']): Promise<InformeLiquidacion> {
    return this.get<InformeLiquidacion>(RUTAS.informe(id))
  }

  guardarInforme(id: Liquidacion['id'], htmlContent: string): Promise<InformeLiquidacion> {
    return this.put<InformeLiquidacion>(RUTAS.informe(id), { html_content: htmlContent })
  }

  /** Espejo del Panel Contable para un único período. */
  obtenerResumenPanel(filtros: { periodo: string; tipo: string }): Promise<RespuestaResumenPanel> {
    return this.get<RespuestaResumenPanel>(RUTAS.resumenPanel, { query: filtros })
  }

  /** Igual que `obtenerResumenPanel`, pero para un rango — una entrada por período. */
  obtenerResumenPanelRango(filtros: {
    periodo_desde: string
    periodo_hasta: string
    tipo: string
  }): Promise<RespuestaResumenPanelRango> {
    return this.get<RespuestaResumenPanelRango>(RUTAS.resumenPanelRango, { query: filtros })
  }
}
