/** Archivos generados de estado de resultados / cruce de facturas, proxeados desde Drive. */
import type {
  ArchivoEstadoResultados,
  FiltrosArchivosEstadoResultados,
  RespuestaArchivosEstadoResultados,
} from '~/features/finanzas/types'
import { BaseService } from '~/core/service'

const BASE = '/estados-resultados'

const RUTAS = {
  archivos: `${BASE}/archivos`,
  archivosZip: `${BASE}/archivos-zip`,
  descargar: (id: ArchivoEstadoResultados['id']) => `${BASE}/archivos/${id}/descargar`,
} as const

export class EstadosResultadosService extends BaseService {
  listarArchivos(
    filtros: FiltrosArchivosEstadoResultados,
  ): Promise<RespuestaArchivosEstadoResultados> {
    return this.get<RespuestaArchivosEstadoResultados>(RUTAS.archivos, { query: { ...filtros } })
  }

  descargarArchivo(id: ArchivoEstadoResultados['id']): Promise<Blob> {
    return this.get<Blob>(RUTAS.descargar(id), { parse: 'blob' })
  }

  descargarZip(filtros: FiltrosArchivosEstadoResultados): Promise<Blob> {
    return this.get<Blob>(RUTAS.archivosZip, { query: { ...filtros }, parse: 'blob' })
  }
}
