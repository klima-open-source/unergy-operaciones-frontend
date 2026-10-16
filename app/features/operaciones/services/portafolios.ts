/** Los portafolios: agrupaciones de plantas para los informes consolidados. Un proyecto está en uno solo. */
import type {
  Portafolio,
  RespuestaAsignarPortafolio,
  RespuestaPortafolios,
} from '~/features/operaciones/types'
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

  /**
   * `forzar`: el backend responde 409 con `duplicado_nombre` cuando el nombre se
   * parece a otro portafolio; repetir con `forzar: true` lo crea igual.
   */
  crear(nombre: string, forzar = false): Promise<Portafolio> {
    return this.post<Portafolio>(RUTAS.portafolios, { nombre }, { query: { forzar } })
  }

  renombrar(id: Portafolio['id'], nombre: string, forzar = false): Promise<unknown> {
    return this.patch<unknown>(RUTAS.portafolio(id), { nombre }, { query: { forzar } })
  }

  eliminar(id: Portafolio['id']): Promise<unknown> {
    return this.delete<unknown>(RUTAS.portafolio(id))
  }

  /**
   * Pone la planta en ese portafolio y la saca del que tenía (`null` = en
   * ninguno). Un proyecto está en un solo portafolio.
   */
  asignarProyecto(
    proyectoId: number,
    portafolioId: Portafolio['id'] | null,
  ): Promise<RespuestaAsignarPortafolio> {
    return this.patch<RespuestaAsignarPortafolio>(RUTAS.asignar, {
      proyecto_id: proyectoId,
      portafolio_id: portafolioId,
    })
  }
}
