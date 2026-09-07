/**
 * Cálculo de arriendos del período: las filas que arma el backend a partir de
 * contratos e indexaciones, y la selección de cuáles se facturan.
 */
import type {
  FilaCalculoArriendo,
  ItemSeleccionArriendo,
  PayloadTasaIpc,
  RespuestaCalculoArriendos,
  TasaIpc,
} from '~/features/finanzas/types'
import { BaseService } from '~/core/service'

const BASE = '/arriendos'

const RUTAS = {
  calculo: (periodo: string) => `${BASE}/calculo/${periodo}`,
  seleccion: (periodo: string) => `${BASE}/seleccion/${periodo}`,
  seleccionFacturado: (periodo: string, id: FilaCalculoArriendo['id']) =>
    `${BASE}/seleccion/${periodo}/${id}/facturado`,
  ipc: `${BASE}/ipc`,
  ipcAño: (año: number) => `${BASE}/ipc/${año}`,
} as const

export class ArriendosCalculoService extends BaseService {
  obtenerCalculo(periodo: string): Promise<RespuestaCalculoArriendos> {
    return this.get<RespuestaCalculoArriendos>(RUTAS.calculo(periodo))
  }

  guardarSeleccion(periodo: string, items: ItemSeleccionArriendo[]): Promise<unknown> {
    return this.post<unknown>(RUTAS.seleccion(periodo), { items })
  }

  marcarFacturado(periodo: string, id: FilaCalculoArriendo['id']): Promise<unknown> {
    return this.patch<unknown>(RUTAS.seleccionFacturado(periodo, id))
  }

  obtenerIpc(): Promise<TasaIpc[]> {
    return this.get<TasaIpc[]>(RUTAS.ipc)
  }

  guardarIpc(año: number, payload: PayloadTasaIpc): Promise<unknown> {
    return this.put<unknown>(RUTAS.ipcAño(año), payload)
  }
}
