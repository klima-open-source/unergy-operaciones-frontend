/**
 * Los contratos de servicio: mantenimiento, arriendo, internet, representación
 * y REC — una sola tabla en el backend, con sus arrendadores, facturas
 * e indexación calculada.
 */
import type {
  Arrendador,
  ContratoServicio,
  DuplicadosRepresentacion,
  FacturaContratoServicio,
  PayloadArrendador,
  PayloadContratoServicio,
  PayloadFacturaContratoServicio,
  RespuestaFusionarRepresentacion,
  SerieIndexacionCalculada,
  TipoServicioContrato,
} from '~/features/contratos/types'
import { BaseService } from '~/core/service'

const BASE = '/contratos-servicio'

const RUTAS = {
  contratos: BASE,
  contrato: (id: ContratoServicio['id']) => `${BASE}/${id}`,
  duplicadosRepresentacion: `${BASE}/duplicados-representacion`,
  fusionarRepresentacion: `${BASE}/fusionar-representacion`,
  facturas: (id: ContratoServicio['id']) => `${BASE}/${id}/facturas`,
  factura: (id: ContratoServicio['id'], facturaId: FacturaContratoServicio['id']) =>
    `${BASE}/${id}/facturas/${facturaId}`,
  indexacionOm: (id: ContratoServicio['id']) => `/om/indexacion/${id}`,
  indexacionArriendo: (id: ContratoServicio['id']) => `/arriendos/indexacion/${id}`,
  arrendadores: (id: ContratoServicio['id']) => `/arriendos/contratos/${id}/arrendadores`,
  arrendador: (arrendadorId: Arrendador['id']) => `/arriendos/arrendadores/${arrendadorId}`,
} as const

export class ContratosServicioService extends BaseService {
  listar(
    filtros: { tipo?: TipoServicioContrato; proyecto_id?: number; limit?: number } = {},
  ): Promise<ContratoServicio[]> {
    return this.get<ContratoServicio[]>(RUTAS.contratos, { query: filtros })
  }

  /**
   * `forzar`: el backend responde 409 con `duplicado_contrato` cuando la planta
   * ya tiene un contrato vigente de ese servicio (mismo patrón que clientes,
   * proyectos y fronteras). Es un aviso y no un bloqueo --hay razones reales
   * para dos contratos parecidos-- y sin este parámetro no habría forma de
   * salir de él.
   */
  crear(payload: PayloadContratoServicio, forzar = false): Promise<ContratoServicio> {
    return this.post<ContratoServicio>(RUTAS.contratos, payload, { query: { forzar } })
  }

  actualizar(
    id: ContratoServicio['id'],
    payload: PayloadContratoServicio,
  ): Promise<ContratoServicio> {
    return this.patch<ContratoServicio>(RUTAS.contrato(id), payload)
  }

  eliminar(id: ContratoServicio['id']): Promise<unknown> {
    return this.delete<unknown>(RUTAS.contrato(id))
  }

  // ── Duplicados de representación ──────────────────────────────────────────────

  buscarDuplicadosRepresentacion(): Promise<DuplicadosRepresentacion> {
    return this.get<DuplicadosRepresentacion>(RUTAS.duplicadosRepresentacion)
  }

  /** Sin `ids`: fusiona todos los grupos limpios de una vez. */
  fusionarRepresentacion(ids?: number[]): Promise<RespuestaFusionarRepresentacion> {
    return this.post<RespuestaFusionarRepresentacion>(
      RUTAS.fusionarRepresentacion,
      ids ? { ids } : {},
    )
  }

  // ── Facturas (mantenimiento: Solenium / inversionista) ────────────────────────

  listarFacturas(id: ContratoServicio['id']): Promise<FacturaContratoServicio[]> {
    return this.get<FacturaContratoServicio[]>(RUTAS.facturas(id))
  }

  crearFactura(
    id: ContratoServicio['id'],
    payload: PayloadFacturaContratoServicio,
  ): Promise<FacturaContratoServicio> {
    return this.post<FacturaContratoServicio>(RUTAS.facturas(id), payload)
  }

  eliminarFactura(
    id: ContratoServicio['id'],
    facturaId: FacturaContratoServicio['id'],
  ): Promise<unknown> {
    return this.delete<unknown>(RUTAS.factura(id, facturaId))
  }

  // ── Indexación calculada (O&M / arriendo) ─────────────────────────────────────

  /** Motor de aniversario + IPC desde la fecha de inicio O&M — la calcula el backend. */
  obtenerIndexacionOm(id: ContratoServicio['id']): Promise<SerieIndexacionCalculada> {
    return this.get<SerieIndexacionCalculada>(RUTAS.indexacionOm(id))
  }

  /** `arrendadorId`: la serie individual de ese arrendador (usa su propio `valor_base`). */
  obtenerIndexacionArriendo(
    id: ContratoServicio['id'],
    arrendadorId?: Arrendador['id'],
  ): Promise<SerieIndexacionCalculada> {
    return this.get<SerieIndexacionCalculada>(RUTAS.indexacionArriendo(id), {
      query: arrendadorId ? { arrendador_id: arrendadorId } : undefined,
    })
  }

  // ── Arrendadores ───────────────────────────────────────────────────────────────

  async listarArrendadores(id: ContratoServicio['id']): Promise<Arrendador[]> {
    const data = await this.get<Arrendador[] | null>(RUTAS.arrendadores(id))
    return data || []
  }

  crearArrendador(id: ContratoServicio['id'], payload: PayloadArrendador): Promise<Arrendador> {
    return this.post<Arrendador>(RUTAS.arrendadores(id), payload)
  }

  actualizarArrendador(
    arrendadorId: Arrendador['id'],
    payload: PayloadArrendador,
  ): Promise<Arrendador> {
    return this.put<Arrendador>(RUTAS.arrendador(arrendadorId), payload)
  }

  eliminarArrendador(arrendadorId: Arrendador['id']): Promise<unknown> {
    return this.delete<unknown>(RUTAS.arrendador(arrendadorId))
  }
}
