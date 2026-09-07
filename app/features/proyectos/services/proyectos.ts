/** La planta: su ficha, sus inversionistas, sus servicios contratados y sus punteros de contacto. */
import type { Proyecto, ProyectoEditable, ProyectoInfoTecnica } from '~/types/proyecto'
import { comoLista, type ListaODirecto, type Paginado } from '~/types/api'
import type {
  AreaContactoOverride,
  ContratoServicioResumenProyecto,
  FronteraProyectoResumen,
  InversionistaProyecto,
  InversorProyecto,
  PayloadActualizarInversionista,
  PayloadActualizarProyecto,
  PayloadAreaContactoOverride,
  PayloadConfirmarPendiente,
  PayloadInversionista,
  PayloadInversorProyecto,
  PayloadServicioToggle,
  ProyectoConDetalle,
  ProyectoConServicioRepresentacion,
  ProyectoPendiente,
  ReporteBackfillInversores,
} from '~/features/proyectos/types'
import { BaseService } from '~/core/service'

const BASE = '/proyectos'

const RUTAS = {
  proyectos: BASE,
  proyecto: (id: Proyecto['id']) => `${BASE}/${id}`,
  infoTecnica: (id: Proyecto['id']) => `${BASE}/${id}/info-tecnica`,
  inversionistas: (id: Proyecto['id']) => `${BASE}/${id}/inversionistas`,
  inversionista: (id: Proyecto['id'], invId: InversionistaProyecto['id']) =>
    `${BASE}/${id}/inversionistas/${invId}`,
  inversores: (id: Proyecto['id']) => `${BASE}/${id}/inversores`,
  inversor: (id: Proyecto['id'], inversorId: InversorProyecto['id']) =>
    `${BASE}/${id}/inversores/${inversorId}`,
  servicios: (id: Proyecto['id']) => `${BASE}/${id}/servicios`,
  areaContactos: (id: Proyecto['id']) => `${BASE}/${id}/area-contactos`,
  areaContacto: (id: Proyecto['id'], tipo: string) => `${BASE}/${id}/area-contactos/${tipo}`,
  pendientes: `${BASE}/pendientes`,
  confirmarPendiente: (clave: string) => `${BASE}/pendientes/${clave}/confirmar`,
  ignorarPendiente: (clave: string) => `${BASE}/pendientes/${clave}/ignorar`,
  backfillInversores: `${BASE}/inversores/backfill-minigranja`,
  vincularSunFactory: (proyectoId: number, sunfactoryProjectId: string) =>
    `${BASE}/${proyectoId}/vincular-sunfactory/${sunfactoryProjectId}`,
  fronteras: '/fronteras',
  contratosServicio: '/contratos-servicio',
} as const

export class ProyectosService extends BaseService {
  async listar({
    page = 1,
    size = 500,
    tipo_proyecto,
  }: { page?: number; size?: number; tipo_proyecto?: string } = {}): Promise<ProyectoConDetalle[]> {
    const data = await this.get<ListaODirecto<ProyectoConDetalle>>(RUTAS.proyectos, {
      query: tipo_proyecto ? { page, size, tipo_proyecto } : { page, size },
    })
    return comoLista(data)
  }

  /**
   * Igual que `listar`, pero sin desenvolver `Paginado` (para avisar cuando la
   * página no trae todo) y con los filtros de la vista de lista: estado, tipo,
   * portafolio y PPA (por contrato especifico, `ppaIds`, o `sinPpa` para "sin
   * ningún contrato" — se combinan con OR, igual que en GET /proyectos).
   *
   * El querystring se arma a mano (no con la opción `query` de `BaseService`)
   * porque `ppa_id` viaja repetido (`ppa_id=12&ppa_id=45`, lo que espera
   * FastAPI para `list[int]`) y no hay forma de confirmar cómo serializa
   * `air` un array dentro de `query` sin poder instalar el paquete en este
   * entorno — ver nota en ProyectosListView.vue::load().
   */
  listarPaginado({
    page = 1,
    size = 500,
    estado,
    tipo_proyecto,
    portafolio_id,
    ppaIds = [],
    sinPpa = false,
  }: {
    page?: number
    size?: number
    estado?: string
    tipo_proyecto?: string
    portafolio_id?: number
    ppaIds?: number[]
    sinPpa?: boolean
  } = {}): Promise<Paginado<ProyectoConDetalle>> {
    const params = new URLSearchParams({ page: String(page), size: String(size) })
    if (estado) params.set('estado', estado)
    if (tipo_proyecto) params.set('tipo_proyecto', tipo_proyecto)
    if (portafolio_id) params.set('portafolio_id', String(portafolio_id))
    for (const id of ppaIds) params.append('ppa_id', String(id))
    if (sinPpa) params.set('sin_ppa', 'true')
    return this.get<Paginado<ProyectoConDetalle>>(`${RUTAS.proyectos}?${params}`)
  }

  obtener(id: Proyecto['id']): Promise<ProyectoConDetalle> {
    return this.get<ProyectoConDetalle>(RUTAS.proyecto(id))
  }

  /** Las plantas con contrato de representación, con el resumen de ese contrato ya embebido. */
  async listarConServicioRepresentacion(): Promise<ProyectoConServicioRepresentacion[]> {
    const data = await this.get<ListaODirecto<ProyectoConServicioRepresentacion>>(RUTAS.proyectos, {
      query: { servicio: 'representacion', size: 500 },
    })
    return comoLista(data)
  }

  /**
   * `forzar`: el backend responde 409 (ver `DuplicadoProyecto`) cuando el
   * nombre se parece a uno ya registrado; repetir con `forzar: true` lo crea igual.
   */
  crear(payload: ProyectoEditable, forzar = false): Promise<ProyectoConDetalle> {
    return this.post<ProyectoConDetalle>(RUTAS.proyectos, payload, { query: { forzar } })
  }

  actualizar(id: Proyecto['id'], payload: PayloadActualizarProyecto): Promise<ProyectoConDetalle> {
    return this.patch<ProyectoConDetalle>(RUTAS.proyecto(id), payload)
  }

  eliminar(id: Proyecto['id']): Promise<unknown> {
    return this.delete<unknown>(RUTAS.proyecto(id))
  }

  guardarInfoTecnica(id: Proyecto['id'], payload: ProyectoInfoTecnica): Promise<unknown> {
    return this.put<unknown>(RUTAS.infoTecnica(id), payload)
  }

  async listarInversionistas(id: Proyecto['id']): Promise<InversionistaProyecto[]> {
    const data = await this.get<ListaODirecto<InversionistaProyecto>>(RUTAS.inversionistas(id))
    return comoLista(data)
  }

  agregarInversionista(id: Proyecto['id'], payload: PayloadInversionista): Promise<unknown> {
    return this.post<unknown>(RUTAS.inversionistas(id), payload)
  }

  actualizarInversionista(
    id: Proyecto['id'],
    invId: InversionistaProyecto['id'],
    payload: PayloadActualizarInversionista,
  ): Promise<unknown> {
    return this.patch<unknown>(RUTAS.inversionista(id, invId), payload)
  }

  eliminarInversionista(id: Proyecto['id'], invId: InversionistaProyecto['id']): Promise<unknown> {
    return this.delete<unknown>(RUTAS.inversionista(id, invId))
  }

  // ── Inversores (equipo de la planta, no inversionistas) ───────────────────────

  listarInversores(id: Proyecto['id']): Promise<InversorProyecto[]> {
    return this.get<InversorProyecto[]>(RUTAS.inversores(id))
  }

  crearInversor(id: Proyecto['id'], payload: PayloadInversorProyecto): Promise<InversorProyecto> {
    return this.post<InversorProyecto>(RUTAS.inversores(id), payload)
  }

  actualizarInversor(
    id: Proyecto['id'],
    inversorId: InversorProyecto['id'],
    payload: PayloadInversorProyecto,
  ): Promise<InversorProyecto> {
    return this.patch<InversorProyecto>(RUTAS.inversor(id, inversorId), payload)
  }

  eliminarInversor(id: Proyecto['id'], inversorId: InversorProyecto['id']): Promise<unknown> {
    return this.delete<unknown>(RUTAS.inversor(id, inversorId))
  }

  alternarServicio(id: Proyecto['id'], payload: PayloadServicioToggle): Promise<unknown> {
    return this.patch<unknown>(RUTAS.servicios(id), payload)
  }

  listarAreaContactos(id: Proyecto['id']): Promise<AreaContactoOverride[]> {
    return this.get<AreaContactoOverride[]>(RUTAS.areaContactos(id))
  }

  guardarAreaContacto(
    id: Proyecto['id'],
    tipo: string,
    payload: PayloadAreaContactoOverride,
  ): Promise<AreaContactoOverride> {
    return this.put<AreaContactoOverride>(RUTAS.areaContacto(id, tipo), payload)
  }

  eliminarAreaContacto(id: Proyecto['id'], tipo: string): Promise<unknown> {
    return this.delete<unknown>(RUTAS.areaContacto(id, tipo))
  }

  // ── Proyectos pendientes (Sun Factory / Quoia) ────────────────────────────────

  listarPendientes(): Promise<ProyectoPendiente[]> {
    return this.get<ProyectoPendiente[]>(RUTAS.pendientes)
  }

  confirmarPendiente(
    clave: string,
    payload: PayloadConfirmarPendiente,
    forzar = false,
  ): Promise<unknown> {
    return this.post<unknown>(RUTAS.confirmarPendiente(clave), payload, { query: { forzar } })
  }

  ignorarPendiente(clave: string): Promise<unknown> {
    return this.post<unknown>(RUTAS.ignorarPendiente(clave), {})
  }

  vincularSunFactory(proyectoId: number, sunfactoryProjectId: string): Promise<unknown> {
    return this.post<unknown>(RUTAS.vincularSunFactory(proyectoId, sunfactoryProjectId))
  }

  /** `dryRun: true` solo previsualiza — no siembra nada. */
  backfillInversores({
    dryRun,
    soloMinigranja,
  }: {
    dryRun: boolean
    soloMinigranja: boolean
  }): Promise<ReporteBackfillInversores> {
    return this.post<ReporteBackfillInversores>(RUTAS.backfillInversores, null, {
      query: { dry_run: dryRun, solo_minigranja: soloMinigranja },
    })
  }

  // ── Fronteras y contratos de servicio del proyecto ───────────────────────────
  // Los slices `fronteras` y `contratos` todavía no están migrados; se quedan
  // aquí, junto a su único consumidor, hasta que les toque su ola.

  async listarFronterasDelProyecto(proyectoId: Proyecto['id']): Promise<FronteraProyectoResumen[]> {
    const data = await this.get<ListaODirecto<FronteraProyectoResumen>>(RUTAS.fronteras, {
      query: { proyecto_id: proyectoId },
    })
    return comoLista(data)
  }

  listarContratosServicioInline(
    tipo: string,
    proyectoId: Proyecto['id'],
  ): Promise<ContratoServicioResumenProyecto[]> {
    return this.get<ContratoServicioResumenProyecto[]>(RUTAS.contratosServicio, {
      query: { tipo, proyecto_id: proyectoId },
    })
  }
}
