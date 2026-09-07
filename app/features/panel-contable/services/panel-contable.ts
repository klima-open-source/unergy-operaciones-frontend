/** Panel contable: armado del estado de resultados por período y proyecto. */
import type {
  FiltrosPanel,
  PanelContable,
  PayloadClasificacion,
  RespuestaArmarPeriodo,
  RespuestaCargarEr,
  RespuestaClasificacion,
  RespuestaConsecutivosUsados,
  RespuestaContraste,
  RespuestaDiferencia,
  RespuestaPaneles,
  RespuestaReasignarConsecutivos,
} from '~/features/panel-contable/types'
import { BaseService } from '~/core/service'

const BASE = '/panel-contable'

const RUTAS = {
  paneles: BASE,
  panel: (id: number) => `${BASE}/${id}`,
  cargarPeriodo: `${BASE}/cargar-periodo`,
  contraste: `${BASE}/contraste`,
  estadoResultados: (id: number) => `${BASE}/${id}/estado-resultados`,
  consecutivosUsados: `${BASE}/consecutivos-usados`,
  soporte: (id: number) => `${BASE}/${id}/soporte`,
  clasificacion: `${BASE}/clasificacion`,
  diferencia: `${BASE}/diferencia`,
  cargarEr: `${BASE}/cargar-er`,
  reasignarConsecutivos: `${BASE}/reasignar-consecutivos`,
  mapeoCelda: `${BASE}/mapeo-celda`,
  aliasFuente: `${BASE}/alias-fuente`,
  fuenteIngreso: `${BASE}/fuente-ingreso`,
} as const

export class PanelContableService extends BaseService {
  listar(filtros: FiltrosPanel): Promise<RespuestaPaneles> {
    return this.get<RespuestaPaneles>(RUTAS.paneles, { query: { ...filtros } })
  }

  armarPeriodo(payload: FiltrosPanel): Promise<RespuestaArmarPeriodo> {
    return this.post<RespuestaArmarPeriodo>(RUTAS.cargarPeriodo, payload)
  }

  obtenerContraste(filtros: FiltrosPanel): Promise<RespuestaContraste> {
    return this.get<RespuestaContraste>(RUTAS.contraste, { query: { ...filtros } })
  }

  descargarEstadoResultados(id: number, inversionista?: string | null): Promise<Blob> {
    return this.get<Blob>(RUTAS.estadoResultados(id), {
      query: inversionista ? { inversionista } : undefined,
      parse: 'blob',
    })
  }

  obtenerConsecutivosUsados(): Promise<RespuestaConsecutivosUsados> {
    return this.get<RespuestaConsecutivosUsados>(RUTAS.consecutivosUsados)
  }

  subirSoporte(
    id: number,
    payload: { archivo: File; grupo: string; concepto: string },
  ): Promise<{ archivo_url?: string; archivo_nombre?: string }> {
    const form = new FormData()
    form.append('archivo', payload.archivo)
    form.append('grupo', payload.grupo)
    form.append('concepto', payload.concepto)
    return this.post<{ archivo_url?: string; archivo_nombre?: string }>(RUTAS.soporte(id), form)
  }

  eliminarSoporte(id: number, grupo: string, concepto: string): Promise<unknown> {
    return this.delete<unknown>(RUTAS.soporte(id), { query: { grupo, concepto } })
  }

  obtenerClasificacion(periodo: string): Promise<RespuestaClasificacion> {
    return this.get<RespuestaClasificacion>(RUTAS.clasificacion, { query: { periodo } })
  }

  guardarClasificacion(payload: PayloadClasificacion): Promise<unknown> {
    return this.post<unknown>(RUTAS.clasificacion, payload)
  }

  obtenerDiferencia(periodo: string): Promise<RespuestaDiferencia> {
    return this.get<RespuestaDiferencia>(RUTAS.diferencia, { query: { periodo } })
  }

  cargarEr(form: FormData): Promise<RespuestaCargarEr> {
    return this.post<RespuestaCargarEr>(RUTAS.cargarEr, form)
  }

  actualizarPanel(id: number, payload: Record<string, unknown>): Promise<PanelContable> {
    return this.patch<PanelContable>(RUTAS.panel(id), payload)
  }

  reasignarConsecutivos(payload: {
    periodo: string
    tipo: string
    consecutivo_ingresos_inicial: number
    consecutivo_costos_inicial: number
    solo_faltantes: boolean
  }): Promise<RespuestaReasignarConsecutivos> {
    return this.post<RespuestaReasignarConsecutivos>(RUTAS.reasignarConsecutivos, payload)
  }

  mapearCelda(payload: {
    proyecto_id: number
    periodo: string
    tipo: string
    concepto: string
    hoja: string
    celda: string
  }): Promise<PanelContable> {
    return this.post<PanelContable>(RUTAS.mapeoCelda, payload)
  }

  renombrarFuente(payload: {
    proyecto_id: number
    periodo: string
    tipo: string
    columna_origen: string
    etiqueta: string
  }): Promise<PanelContable> {
    return this.post<PanelContable>(RUTAS.aliasFuente, payload)
  }

  agregarFuenteIngreso(payload: {
    proyecto_id: number
    periodo: string
    tipo: string
    etiqueta: string
    hoja: string
    celda: string
  }): Promise<PanelContable> {
    return this.post<PanelContable>(RUTAS.fuenteIngreso, payload)
  }

  quitarFuenteIngreso(payload: {
    proyecto_id: number
    periodo: string
    tipo: string
    columna_origen: string
  }): Promise<PanelContable> {
    return this.delete<PanelContable>(RUTAS.fuenteIngreso, { body: payload })
  }
}
