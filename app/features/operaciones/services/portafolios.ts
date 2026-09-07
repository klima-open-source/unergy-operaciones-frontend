/** Los portafolios de proyectos: agrupaciones para los informes consolidados. */
import type { Portafolio, RespuestaPortafolios } from '~/features/operaciones/types'
import { BaseService } from '~/core/service'

const BASE = '/portafolios'

const RUTAS = {
  portafolios: BASE,
  portafolio: (id: Portafolio['id']) => `${BASE}/${id}`,
  asignar: `${BASE}/asignar`,
} as const

export class PortafoliosService extends BaseService {
  listar(): Promise<RespuestaPortafolios> {
    return this.get<RespuestaPortafolios>(RUTAS.portafolios)
  }

  crear(nombre: string): Promise<Portafolio> {
    return this.post<Portafolio>(RUTAS.portafolios, { nombre })
  }

  renombrar(id: Portafolio['id'], nombre: string): Promise<unknown> {
    return this.patch<unknown>(RUTAS.portafolio(id), { nombre })
  }

  eliminar(id: Portafolio['id']): Promise<unknown> {
    return this.delete<unknown>(RUTAS.portafolio(id))
  }

  /** `portafolioId: null` desasigna — el proyecto vuelve a "Sin portafolio". */
  asignarProyecto(proyectoId: number, portafolioId: Portafolio['id'] | null): Promise<unknown> {
    return this.patch<unknown>(RUTAS.asignar, {
      proyecto_id: proyectoId,
      portafolio_id: portafolioId,
    })
  }
}
