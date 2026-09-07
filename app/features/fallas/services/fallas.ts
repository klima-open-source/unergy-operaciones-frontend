/**
 * Fallas operativas: catálogo, CRUD, seguimientos, adjuntos y notificación.
 *
 * El backend expone dos rutas distintas para adjuntar archivos a una falla
 * (`/archivos`, `/attachments`) porque dos vistas legacy las fueron
 * agregando por separado — no se unifican acá, cada método refleja el
 * endpoint real que usa su vista.
 */
import type {
  ArchivoFalla,
  CatalogosFalla,
  CategoriaFalla,
  Falla,
  FiltrosListaFallas,
  PayloadFalla,
  PayloadSeguimiento,
  ResultadoNotificacionFalla,
  ResumenGeneracionMonitoreo,
  RespuestaActividadHoyFallas,
  RespuestaEstructuraFallas,
  RespuestaListaFallas,
  OperadorMapa,
  DatosMapa,
} from '~/features/fallas/types'
import { BaseService } from '~/core/service'

const BASE = '/fallas'

const RUTAS = {
  fallas: BASE,
  falla: (id: Falla['id']) => `${BASE}/${id}`,
  catalogos: `${BASE}/catalogos`,
  estructura: `${BASE}/estructura`,
  actividadHoy: `${BASE}/actividad-hoy`,
  seguimientos: (id: Falla['id']) => `${BASE}/${id}/seguimientos`,
  archivos: (id: Falla['id']) => `${BASE}/${id}/archivos`,
  archivo: (id: Falla['id'], archivoId: ArchivoFalla['id']) =>
    `${BASE}/${id}/archivos/${archivoId}`,
  attachments: (id: Falla['id']) => `${BASE}/${id}/attachments`,
  notificar: (id: Falla['id']) => `${BASE}/${id}/notificar`,
  resumenGeneracion: '/monitoreo/resumen-generacion',
  mapaOperadores: '/mapa/operadores',
  mapa: '/mapa',
} as const

export class FallasService extends BaseService {
  obtenerCatalogos(): Promise<CatalogosFalla> {
    return this.get<CatalogosFalla>(RUTAS.catalogos)
  }

  // ── Estructura de clasificación (`FallaCreateSheet.vue`, mobile) ─────────────

  async obtenerEstructura(): Promise<CategoriaFalla[]> {
    const data = await this.get<RespuestaEstructuraFallas>(RUTAS.estructura)
    return data.categorias ?? []
  }

  /** Fallas creadas y cambios de estado de hoy (`MobileResumenView.vue`). */
  obtenerActividadHoy(): Promise<RespuestaActividadHoyFallas> {
    return this.get<RespuestaActividadHoyFallas>(RUTAS.actividadHoy)
  }

  listar(filtros: FiltrosListaFallas = {}): Promise<RespuestaListaFallas> {
    return this.get<RespuestaListaFallas>(RUTAS.fallas, { query: { ...filtros } })
  }

  obtener(id: Falla['id']): Promise<Falla> {
    return this.get<Falla>(RUTAS.falla(id))
  }

  crear(payload: PayloadFalla): Promise<Falla> {
    return this.post<Falla>(RUTAS.fallas, payload)
  }

  actualizar(id: Falla['id'], payload: PayloadFalla): Promise<Falla> {
    return this.patch<Falla>(RUTAS.falla(id), payload)
  }

  eliminar(id: Falla['id']): Promise<unknown> {
    return this.delete<unknown>(RUTAS.falla(id))
  }

  crearSeguimiento(id: Falla['id'], payload: PayloadSeguimiento): Promise<unknown> {
    return this.post<unknown>(RUTAS.seguimientos(id), payload)
  }

  notificar(id: Falla['id']): Promise<ResultadoNotificacionFalla> {
    return this.post<ResultadoNotificacionFalla>(RUTAS.notificar(id))
  }

  // ── Archivos (`FallaArchivos.vue`) ────────────────────────────────────────────

  listarArchivos(id: Falla['id']): Promise<ArchivoFalla[]> {
    return this.get<ArchivoFalla[]>(RUTAS.archivos(id))
  }

  subirArchivo(
    id: Falla['id'],
    archivo: File,
    onProgreso?: (porcentaje: number) => void,
  ): Promise<ArchivoFalla> {
    const form = new FormData()
    form.append('archivo', archivo)
    return this.postFormData<ArchivoFalla>(RUTAS.archivos(id), form, onProgreso)
  }

  eliminarArchivo(id: Falla['id'], archivoId: ArchivoFalla['id']): Promise<unknown> {
    return this.delete<unknown>(RUTAS.archivo(id, archivoId))
  }

  // ── Adjuntos (`FallaDetailView.vue`) ──────────────────────────────────────────

  subirAdjunto(id: Falla['id'], archivo: File): Promise<unknown> {
    const form = new FormData()
    form.append('archivo', archivo)
    return this.postFormData<unknown>(RUTAS.attachments(id), form)
  }

  // ── Monitoreo (`MonitoreoView.vue`) ───────────────────────────────────────────

  obtenerResumenGeneracion(filtros: {
    date_from: string
    date_to: string
  }): Promise<ResumenGeneracionMonitoreo> {
    return this.get<ResumenGeneracionMonitoreo>(RUTAS.resumenGeneracion, { query: filtros })
  }

  // ── Mapa (`FallasMapView.vue`) ─────────────────────────────────────────────────

  listarOperadoresMapa(): Promise<OperadorMapa[]> {
    return this.get<OperadorMapa[]>(RUTAS.mapaOperadores)
  }

  obtenerMapa(operator: string): Promise<DatosMapa> {
    return this.get<DatosMapa>(RUTAS.mapa, { query: { operator } })
  }
}
