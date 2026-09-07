/** Informes mensuales: operacionales, FMO y de portafolio — su ciclo de revisión y envío. */
import type {
  ComentarioInforme,
  FiltrosListaInformes,
  Informe,
  PayloadGuardarInforme,
  RespuestaCompuestoInforme,
  RespuestaEnviarInforme,
} from '~/features/operaciones/types'
import { BaseService } from '~/core/service'

const BASE = '/informes/'

const RUTAS = {
  informes: BASE,
  informe: (id: Informe['id']) => `${BASE}${id}`,
  compuesto: (id: Informe['id']) => `${BASE}${id}/compuesto`,
  seccion: (id: Informe['id']) => `${BASE}${id}/seccion`,
  estado: (id: Informe['id']) => `${BASE}${id}/estado`,
  enviar: (id: Informe['id']) => `${BASE}${id}/enviar`,
  comentarios: (id: Informe['id']) => `${BASE}${id}/comentarios`,
  comentarioResolver: (id: Informe['id'], comentarioId: ComentarioInforme['id']) =>
    `${BASE}${id}/comentarios/${comentarioId}/resolver`,
  comentario: (id: Informe['id'], comentarioId: ComentarioInforme['id']) =>
    `${BASE}${id}/comentarios/${comentarioId}`,
} as const

export class InformesService extends BaseService {
  listar(filtros: FiltrosListaInformes = {}): Promise<Informe[]> {
    return this.get<Informe[]>(RUTAS.informes, { query: { ...filtros } })
  }

  obtener(id: Informe['id']): Promise<Informe> {
    return this.get<Informe>(RUTAS.informe(id))
  }

  /** También hace de "guardar": el backend crea uno nuevo si no existe para ese período/proyecto, o lo reemplaza si ya existía. */
  guardar(payload: PayloadGuardarInforme): Promise<Informe> {
    return this.post<Informe>(RUTAS.informes, payload)
  }

  eliminar(id: Informe['id']): Promise<unknown> {
    return this.delete<unknown>(RUTAS.informe(id))
  }

  obtenerCompuesto(id: Informe['id']): Promise<RespuestaCompuestoInforme> {
    return this.get<RespuestaCompuestoInforme>(RUTAS.compuesto(id))
  }

  /** Write-back de la sección de un proyecto dentro de un informe de portafolio. */
  guardarSeccion(
    id: Informe['id'],
    payload: { sub_project: string; html_content: string },
  ): Promise<unknown> {
    return this.patch<unknown>(RUTAS.seccion(id), payload)
  }

  cambiarEstado(id: Informe['id'], estado: string): Promise<Informe> {
    return this.patch<Informe>(RUTAS.estado(id), { estado })
  }

  enviar(id: Informe['id']): Promise<RespuestaEnviarInforme> {
    return this.post<RespuestaEnviarInforme>(RUTAS.enviar(id), {})
  }

  agregarComentario(id: Informe['id'], mensaje: string): Promise<Informe> {
    return this.post<Informe>(RUTAS.comentarios(id), { mensaje })
  }

  resolverComentario(
    id: Informe['id'],
    comentarioId: ComentarioInforme['id'],
    respuesta: string | null,
  ): Promise<Informe> {
    return this.patch<Informe>(RUTAS.comentarioResolver(id, comentarioId), { respuesta })
  }

  eliminarComentario(id: Informe['id'], comentarioId: ComentarioInforme['id']): Promise<Informe> {
    return this.delete<Informe>(RUTAS.comentario(id, comentarioId))
  }
}
