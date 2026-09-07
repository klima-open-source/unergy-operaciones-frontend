/** Factura mensual de Starlink: extracción del PDF, guardado y mapeo de sitios a proyecto. */
import type {
  FacturaStarlink,
  PayloadMapeoStarlink,
  ResultadoProcesarPdfStarlink,
} from '~/features/finanzas/types'
import { BaseService } from '~/core/service'

const BASE = '/starlink'

const RUTAS = {
  periodos: `${BASE}/periodos`,
  factura: (periodo: string) => `${BASE}/factura/${periodo}`,
  procesarPdf: `${BASE}/procesar-pdf`,
  excel: `${BASE}/excel`,
  mapeo: `${BASE}/mapeo`,
} as const

export class StarlinkService extends BaseService {
  listarPeriodos(): Promise<string[]> {
    return this.get<string[]>(RUTAS.periodos)
  }

  obtenerFactura(periodo: string): Promise<FacturaStarlink> {
    return this.get<FacturaStarlink>(RUTAS.factura(periodo))
  }

  guardarFactura(periodo: string, payload: FacturaStarlink): Promise<unknown> {
    return this.put<unknown>(RUTAS.factura(periodo), payload)
  }

  procesarPdf(archivo: File): Promise<ResultadoProcesarPdfStarlink> {
    const form = new FormData()
    form.append('file', archivo)
    return this.post<ResultadoProcesarPdfStarlink>(RUTAS.procesarPdf, form)
  }

  descargarExcel(payload: { items?: unknown[]; agrupado?: unknown[] }): Promise<Blob> {
    return this.post<Blob>(RUTAS.excel, payload, { parse: 'blob' })
  }

  actualizarMapeo(payload: PayloadMapeoStarlink): Promise<unknown> {
    return this.put<unknown>(RUTAS.mapeo, payload)
  }
}
