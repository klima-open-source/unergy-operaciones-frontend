/** Contratos PPA: tarifas, compromisos de energía, proyectos vinculados y sus registros GESCON/ASIC. */
import type {
  CompromisoEnergiaPpa,
  ContratoPpa,
  PayloadAsic,
  PayloadAsicModificacion,
  PayloadAsicTerminacion,
  PayloadAsignarResponsablesPpa,
  PayloadPpa,
  PayloadResponsablePpa,
  PlantasInscritasPorMes,
  RegistroAsic,
  ResponsablePpa,
  RespuestaAsicOperacion,
  RespuestaBackfillAsic,
  TarifaPpa,
} from '~/features/contratos/types'
import { comoLista, type ListaODirecto } from '~/types/api'
import { BaseService } from '~/core/service'

const BASE = '/ppa'

const RUTAS = {
  contratos: BASE,
  contrato: (id: ContratoPpa['id']) => `${BASE}/${id}`,
  tarifas: (id: ContratoPpa['id']) => `${BASE}/${id}/tarifas`,
  compromisos: (id: ContratoPpa['id']) => `${BASE}/${id}/compromisos`,
  proyectosVinculados: (id: ContratoPpa['id']) => `${BASE}/${id}/proyectos`,
  responsables: `${BASE}/responsables`,
  responsable: (id: ResponsablePpa['id']) => `${BASE}/responsables/${id}`,
  responsablesAsignar: `${BASE}/responsables/asignar`,
  asic: '/asic',
  asicItem: (id: RegistroAsic['id']) => `/asic/${id}`,
  asicTerminacion: '/asic/terminacion',
  asicModificacion: '/asic/modificacion',
  asicBackfillNombreInterno: '/asic/backfill-nombre-interno',
  asicBackfillTerminaciones: '/asic/backfill-terminaciones',
  plantasInscritasPorMes: (id: ContratoPpa['id']) =>
    `/cumplimiento/ppa/${id}/plantas-inscritas-por-mes`,
} as const

export class PpaService extends BaseService {
  listar(filtros: { proyecto_id?: number; q?: string } = {}): Promise<ContratoPpa[]> {
    return this.get<ContratoPpa[]>(RUTAS.contratos, { query: filtros })
  }

  obtener(id: ContratoPpa['id']): Promise<ContratoPpa> {
    return this.get<ContratoPpa>(RUTAS.contrato(id))
  }

  crear(payload: PayloadPpa): Promise<ContratoPpa> {
    return this.post<ContratoPpa>(RUTAS.contratos, payload)
  }

  actualizar(id: ContratoPpa['id'], payload: PayloadPpa): Promise<ContratoPpa> {
    return this.patch<ContratoPpa>(RUTAS.contrato(id), payload)
  }

  eliminar(id: ContratoPpa['id']): Promise<unknown> {
    return this.delete<unknown>(RUTAS.contrato(id))
  }

  guardarTarifas(id: ContratoPpa['id'], tarifas: TarifaPpa[]): Promise<TarifaPpa[]> {
    return this.put<TarifaPpa[]>(RUTAS.tarifas(id), tarifas)
  }

  guardarCompromisos(
    id: ContratoPpa['id'],
    compromisos: CompromisoEnergiaPpa[],
  ): Promise<CompromisoEnergiaPpa[]> {
    return this.put<CompromisoEnergiaPpa[]>(RUTAS.compromisos(id), compromisos)
  }

  vincularProyecto(id: ContratoPpa['id'], proyectoId: number): Promise<unknown> {
    return this.post<unknown>(RUTAS.proyectosVinculados(id), { proyecto_id: proyectoId })
  }

  listarResponsables(): Promise<ResponsablePpa[]> {
    return this.get<ResponsablePpa[]>(RUTAS.responsables)
  }

  crearResponsable(payload: PayloadResponsablePpa): Promise<ResponsablePpa> {
    return this.post<ResponsablePpa>(RUTAS.responsables, payload)
  }

  actualizarResponsable(
    id: ResponsablePpa['id'],
    payload: PayloadResponsablePpa,
  ): Promise<ResponsablePpa> {
    return this.patch<ResponsablePpa>(RUTAS.responsable(id), payload)
  }

  eliminarResponsable(id: ResponsablePpa['id']): Promise<unknown> {
    return this.delete<unknown>(RUTAS.responsable(id))
  }

  asignarResponsables(payload: PayloadAsignarResponsablesPpa): Promise<unknown> {
    return this.post<unknown>(RUTAS.responsablesAsignar, payload)
  }

  listarPlantasInscritasPorMes(id: ContratoPpa['id']): Promise<PlantasInscritasPorMes[]> {
    return this.get<PlantasInscritasPorMes[]>(RUTAS.plantasInscritasPorMes(id))
  }

  // ── Registros GESCON/ASIC ────────────────────────────────────────────────────

  async listarAsic(
    filtros: {
      proyecto_id?: number
      size?: number
      contrato_interno?: string
      codigo_sic_contrato?: string
    } = {},
  ): Promise<RegistroAsic[]> {
    const data = await this.get<ListaODirecto<RegistroAsic>>(RUTAS.asic, { query: filtros })
    return comoLista(data)
  }

  eliminarAsic(id: RegistroAsic['id']): Promise<unknown> {
    return this.delete<unknown>(RUTAS.asicItem(id))
  }

  crearAsic(payload: PayloadAsic): Promise<RegistroAsic> {
    return this.post<RegistroAsic>(RUTAS.asic, payload)
  }

  actualizarAsic(id: RegistroAsic['id'], payload: PayloadAsic): Promise<RegistroAsic> {
    return this.patch<RegistroAsic>(RUTAS.asicItem(id), payload)
  }

  crearTerminacionAsic(payload: PayloadAsicTerminacion): Promise<RespuestaAsicOperacion> {
    return this.post<RespuestaAsicOperacion>(RUTAS.asicTerminacion, payload)
  }

  crearModificacionAsic(payload: PayloadAsicModificacion): Promise<RespuestaAsicOperacion> {
    return this.post<RespuestaAsicOperacion>(RUTAS.asicModificacion, payload)
  }

  backfillNombreInterno(dryRun: boolean): Promise<RespuestaBackfillAsic> {
    return this.post<RespuestaBackfillAsic>(RUTAS.asicBackfillNombreInterno, null, {
      query: { dry_run: dryRun },
    })
  }

  backfillTerminaciones(dryRun: boolean): Promise<RespuestaBackfillAsic> {
    return this.post<RespuestaBackfillAsic>(RUTAS.asicBackfillTerminaciones, null, {
      query: { dry_run: dryRun },
    })
  }
}
