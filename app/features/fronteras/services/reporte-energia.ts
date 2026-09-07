/**
 * Reporte Energía: la clasificación diaria (por frontera) que decide qué fuente
 * reportar a XM, su corrección manual, y el envío del reporte a Quoia.
 */
import type {
  CurvaTipica,
  DetalleReporteEnergia,
  EstadoEjecucionReporteEnergia,
  EstadoQuoiaReporte,
  ExclusionReporteEnergia,
  FilaReporteEnergia,
  PayloadActualizarExclusion,
  PayloadCrearExclusion,
  PayloadGuardarCurva,
  ResultadoEnvioReporteEnergia,
  ResumenHistoricoReporteEnergia,
  ResumenReporteEnergiaDia,
  RespuestaCargaExcelTerceros,
} from '~/features/fronteras/types'
import { BaseService } from '~/core/service'

const BASE = '/reporte-energia'

const RUTAS = {
  resumen: `${BASE}/resumen`,
  resumenHistorico: `${BASE}/resumen-historico`,
  fronteras: `${BASE}/fronteras`,
  frontera: (id: number) => `${BASE}/fronteras/${id}`,
  exclusiones: (id: number) => `${BASE}/fronteras/${id}/exclusiones`,
  exclusionResolver: (exclusionId: number) => `${BASE}/exclusiones/${exclusionId}/resolver`,
  exclusion: (exclusionId: number) => `${BASE}/exclusiones/${exclusionId}`,
  curvaTipica: (id: number) => `${BASE}/fronteras/${id}/curva-tipica`,
  rellenarHorario: (id: number) => `${BASE}/fronteras/${id}/rellenar-horario`,
  deshacerRelleno: (id: number) => `${BASE}/fronteras/${id}/deshacer-relleno`,
  recuperarMedidor: (id: number) => `${BASE}/fronteras/${id}/recuperar-medidor`,
  revisarRespaldo: (id: number) => `${BASE}/fronteras/${id}/revisar-respaldo`,
  validar: (id: number) => `${BASE}/fronteras/${id}/validar`,
  cargarExcelTerceros: (id: number) => `${BASE}/fronteras/${id}/cargar-excel-terceros`,
  ejecutar: `${BASE}/ejecutar`,
  ejecutarCancelar: `${BASE}/ejecutar/cancelar`,
  ejecutarEstado: `${BASE}/ejecutar/estado`,
  excel: `${BASE}/excel`,
  enviar: `${BASE}/enviar`,
  estadoQuoia: `${BASE}/estado-quoia`,
} as const

export class ReporteEnergiaService extends BaseService {
  obtenerResumen(fecha: string): Promise<ResumenReporteEnergiaDia> {
    return this.get<ResumenReporteEnergiaDia>(RUTAS.resumen, { query: { fecha } })
  }

  obtenerResumenHistorico(desde: string, hasta: string): Promise<ResumenHistoricoReporteEnergia> {
    return this.get<ResumenHistoricoReporteEnergia>(RUTAS.resumenHistorico, {
      query: { desde, hasta },
    })
  }

  listarFronteras(fecha: string): Promise<FilaReporteEnergia[]> {
    return this.get<FilaReporteEnergia[]>(RUTAS.fronteras, { query: { fecha } })
  }

  obtenerDetalle(id: number, fecha: string): Promise<DetalleReporteEnergia> {
    return this.get<DetalleReporteEnergia>(RUTAS.frontera(id), { query: { fecha } })
  }

  guardarCurva(
    id: number,
    fecha: string,
    payload: PayloadGuardarCurva,
  ): Promise<DetalleReporteEnergia> {
    return this.patch<DetalleReporteEnergia>(RUTAS.frontera(id), payload, { query: { fecha } })
  }

  listarExclusiones(id: number): Promise<ExclusionReporteEnergia[]> {
    return this.get<ExclusionReporteEnergia[]>(RUTAS.exclusiones(id))
  }

  crearExclusion(id: number, payload: PayloadCrearExclusion): Promise<unknown> {
    return this.post<unknown>(RUTAS.exclusiones(id), payload)
  }

  resolverExclusion(exclusionId: number): Promise<unknown> {
    return this.post<unknown>(RUTAS.exclusionResolver(exclusionId))
  }

  actualizarExclusion(exclusionId: number, payload: PayloadActualizarExclusion): Promise<unknown> {
    return this.patch<unknown>(RUTAS.exclusion(exclusionId), payload)
  }

  obtenerCurvaTipica(id: number, fecha: string): Promise<CurvaTipica> {
    return this.get<CurvaTipica>(RUTAS.curvaTipica(id), { query: { fecha } })
  }

  rellenarHorario(id: number, fecha: string): Promise<DetalleReporteEnergia> {
    return this.post<DetalleReporteEnergia>(RUTAS.rellenarHorario(id), undefined, {
      query: { fecha },
    })
  }

  deshacerRelleno(id: number, fecha: string): Promise<DetalleReporteEnergia> {
    return this.post<DetalleReporteEnergia>(RUTAS.deshacerRelleno(id), undefined, {
      query: { fecha },
    })
  }

  /** Interroga el medidor físico por WebSocket — puede tardar hasta 90 s. */
  recuperarMedidor(id: number, fecha: string): Promise<DetalleReporteEnergia> {
    return this.post<DetalleReporteEnergia>(RUTAS.recuperarMedidor(id), undefined, {
      query: { fecha },
      signal: () => AbortSignal.timeout(120_000),
    })
  }

  revisarRespaldo(id: number, fecha: string): Promise<DetalleReporteEnergia> {
    return this.post<DetalleReporteEnergia>(RUTAS.revisarRespaldo(id), undefined, {
      query: { fecha },
    })
  }

  validar(id: number, fecha: string): Promise<unknown> {
    return this.post<unknown>(RUTAS.validar(id), undefined, { query: { fecha } })
  }

  cargarExcelTerceros(id: number, archivo: File): Promise<RespuestaCargaExcelTerceros> {
    const form = new FormData()
    form.append('archivo', archivo)
    return this.postFormData<RespuestaCargaExcelTerceros>(RUTAS.cargarExcelTerceros(id), form)
  }

  eliminarExcelTerceros(id: number, fecha: string): Promise<unknown> {
    return this.delete<unknown>(RUTAS.cargarExcelTerceros(id), { query: { fecha } })
  }

  ejecutarClasificacion(fecha: string): Promise<unknown> {
    return this.post<unknown>(RUTAS.ejecutar, undefined, { query: { fecha } })
  }

  /** Cooperativo: el backend revisa la señal entre frontera y frontera, nunca corta a media frontera. */
  cancelarClasificacion(fecha: string): Promise<unknown> {
    return this.post<unknown>(RUTAS.ejecutarCancelar, undefined, { query: { fecha } })
  }

  obtenerEstadoEjecucion(fecha: string): Promise<EstadoEjecucionReporteEnergia> {
    return this.get<EstadoEjecucionReporteEnergia>(RUTAS.ejecutarEstado, { query: { fecha } })
  }

  descargarExcel(fecha: string): Promise<Blob> {
    return this.get<Blob>(RUTAS.excel, { query: { fecha }, parse: 'blob' })
  }

  /** El envío a Quoia puede tardar varios minutos con muchas fronteras. */
  enviarReporte(fecha: string): Promise<ResultadoEnvioReporteEnergia> {
    return this.post<ResultadoEnvioReporteEnergia>(RUTAS.enviar, undefined, {
      query: { fecha },
      signal: () => AbortSignal.timeout(300_000),
    })
  }

  obtenerEstadoQuoia(fecha: string): Promise<EstadoQuoiaReporte> {
    return this.get<EstadoQuoiaReporte>(RUTAS.estadoQuoia, { query: { fecha } })
  }

  /** Vuelve a consultar Quoia por el estado de lo ya enviado — no es instantáneo. */
  revisarEstadoQuoia(fecha: string): Promise<EstadoQuoiaReporte> {
    return this.post<EstadoQuoiaReporte>(RUTAS.estadoQuoia, undefined, {
      query: { fecha },
      signal: () => AbortSignal.timeout(180_000),
    })
  }
}
