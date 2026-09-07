/** El informe de puesta en marcha (O&M): su ficha por proyecto y las evidencias adjuntas por sección. */
import type {
  ArchivoEvidencia,
  DetalleInformeOm,
  FichaInformeOm,
  ProyectoInformeOm,
} from '~/features/operaciones/types'
import { BaseService } from '~/core/service'

const BASE = '/informe-om'

const RUTAS = {
  proyectos: `${BASE}/proyectos`,
  informe: (id: number) => `${BASE}/${id}`,
  evidenciaArchivos: (basePath: string, proyectoId: number, seccion: string) =>
    `/${basePath}/${proyectoId}/archivos/${seccion}`,
  evidenciaArchivo: (basePath: string, proyectoId: number, seccion: string, archivoId: number) =>
    `/${basePath}/${proyectoId}/archivos/${seccion}/${archivoId}`,
} as const

export class InformeOmService extends BaseService {
  listarProyectos(): Promise<ProyectoInformeOm[]> {
    return this.get<ProyectoInformeOm[]>(RUTAS.proyectos)
  }

  obtener(id: number): Promise<DetalleInformeOm> {
    return this.get<DetalleInformeOm>(RUTAS.informe(id))
  }

  guardar(id: number, ficha: FichaInformeOm): Promise<DetalleInformeOm> {
    return this.put<DetalleInformeOm>(RUTAS.informe(id), ficha)
  }

  /**
   * `EvidenciaUploader.vue` es genérico sobre `basePath` (hoy siempre
   * `informe-om`, su único consumidor) — el service refleja esa misma
   * genericidad en vez de fijarla.
   */
  subirEvidencia(
    basePath: string,
    proyectoId: number,
    seccion: string,
    archivo: File,
  ): Promise<ArchivoEvidencia> {
    const form = new FormData()
    form.append('archivo', archivo)
    return this.postFormData<ArchivoEvidencia>(
      RUTAS.evidenciaArchivos(basePath, proyectoId, seccion),
      form,
    )
  }

  eliminarEvidencia(
    basePath: string,
    proyectoId: number,
    seccion: string,
    archivoId: number,
  ): Promise<unknown> {
    return this.delete<unknown>(RUTAS.evidenciaArchivo(basePath, proyectoId, seccion, archivoId))
  }
}
