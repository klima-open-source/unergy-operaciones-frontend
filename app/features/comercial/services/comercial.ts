/** El CRM comercial: pipeline de oportunidades y ofertas, hasta la firma del PPA. */
import type { ProyectoEditable } from '~/types/proyecto'
import type { ProyectoConDetalle } from '~/features/proyectos/types'
import type {
  ConfigComercial,
  FiltrosCrearProyectoDesdeCRM,
  Oferta,
  Oportunidad,
  PayloadCrearOferta,
  PayloadEditarOferta,
  PayloadEditarOportunidad,
  PayloadFirmarOferta,
  PayloadGestion,
  PayloadRegistrarOportunidad,
  RespuestaFirmarOferta,
} from '~/features/comercial/types'
import { BaseService } from '~/core/service'

const BASE = '/comercial'

const RUTAS = {
  ofertas: `${BASE}/ofertas`,
  oferta: (id: Oferta['id']) => `${BASE}/ofertas/${id}`,
  ofertaEstado: (id: Oferta['id']) => `${BASE}/ofertas/${id}/estado`,
  ofertaSeguimiento: (id: Oferta['id']) => `${BASE}/ofertas/${id}/seguimiento`,
  ofertaFirmar: (id: Oferta['id']) => `${BASE}/ofertas/${id}/firmar`,
  config: `${BASE}/config`,
  registrar: `${BASE}/registrar`,
  oportunidad: (id: Oportunidad['id']) => `${BASE}/oportunidades/${id}`,
  oportunidadOfertas: (id: Oportunidad['id']) => `${BASE}/oportunidades/${id}/ofertas`,
  oportunidadGestiones: (id: Oportunidad['id']) => `${BASE}/oportunidades/${id}/gestiones`,
  oportunidadProyectos: (id: Oportunidad['id']) => `${BASE}/oportunidades/${id}/proyectos`,
} as const

export class ComercialService extends BaseService {
  listarOfertas(): Promise<Oferta[]> {
    return this.get<Oferta[]>(RUTAS.ofertas)
  }

  obtenerConfig(): Promise<ConfigComercial> {
    return this.get<ConfigComercial>(RUTAS.config)
  }

  cambiarEstadoOferta(id: Oferta['id'], estado: string): Promise<Oferta> {
    return this.post<Oferta>(RUTAS.ofertaEstado(id), { estado })
  }

  actualizarOferta(id: Oferta['id'], cambios: PayloadEditarOferta): Promise<Oferta> {
    return this.patch<Oferta>(RUTAS.oferta(id), cambios)
  }

  registrarSeguimientoOferta(id: Oferta['id']): Promise<Oferta> {
    return this.post<Oferta>(RUTAS.ofertaSeguimiento(id))
  }

  eliminarOferta(id: Oferta['id']): Promise<unknown> {
    return this.delete<unknown>(RUTAS.oferta(id))
  }

  firmarOferta(id: Oferta['id'], payload: PayloadFirmarOferta): Promise<RespuestaFirmarOferta> {
    return this.post<RespuestaFirmarOferta>(RUTAS.ofertaFirmar(id), payload)
  }

  crearOferta(oportunidadId: Oportunidad['id'], payload: PayloadCrearOferta): Promise<Oferta> {
    return this.post<Oferta>(RUTAS.oportunidadOfertas(oportunidadId), payload)
  }

  /** Registro completo (cliente + oportunidad + ofertas) en una sola transacción. */
  registrar(payload: PayloadRegistrarOportunidad): Promise<Oportunidad> {
    return this.post<Oportunidad>(RUTAS.registrar, payload)
  }

  obtenerOportunidad(id: Oportunidad['id']): Promise<Oportunidad> {
    return this.get<Oportunidad>(RUTAS.oportunidad(id))
  }

  actualizarOportunidad(
    id: Oportunidad['id'],
    payload: PayloadEditarOportunidad,
  ): Promise<unknown> {
    return this.patch<unknown>(RUTAS.oportunidad(id), payload)
  }

  registrarGestion(oportunidadId: Oportunidad['id'], payload: PayloadGestion): Promise<unknown> {
    return this.post<unknown>(RUTAS.oportunidadGestiones(oportunidadId), payload)
  }

  /** Crea la planta desde el CRM y la vincula a la oportunidad (y a `oferta_id`, si viene). */
  crearProyectoDesdeCRM(
    oportunidadId: Oportunidad['id'],
    payload: ProyectoEditable,
    filtros: FiltrosCrearProyectoDesdeCRM = {},
  ): Promise<ProyectoConDetalle> {
    return this.post<ProyectoConDetalle>(RUTAS.oportunidadProyectos(oportunidadId), payload, {
      query: { ...filtros },
    })
  }
}
