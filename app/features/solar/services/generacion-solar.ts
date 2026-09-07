/** Monitoreo en vivo de generación solar (datos de Solenium). */
import type {
  DetalleMonitoreoSolar,
  GeneracionHoyProyecto,
  HistorialGeneracionProyecto,
  PotenciaInversores,
  RespuestaGeneracionHoy,
  RespuestaMonitoreoSolar,
  RespuestaResumenGeneracionDia,
} from '~/features/solar/types'
import { BaseService } from '~/core/service'

const BASE = '/generacion-solar'

const RUTAS = {
  monitoring: `${BASE}/monitoring`,
  monitoringDetalle: (proyectoId: number) => `${BASE}/monitoring/${proyectoId}`,
  invertersPower: (proyectoId: number) => `${BASE}/monitoring/${proyectoId}/inverters-power`,
  generacionHoy: `${BASE}/generacion-hoy`,
  resumenDia: `${BASE}/resumen-dia`,
  historialProyecto: (proyectoId: number) => `${BASE}/proyecto/${proyectoId}/historial`,
} as const

export class GeneracionSolarService extends BaseService {
  obtenerMonitoreo(): Promise<RespuestaMonitoreoSolar> {
    return this.get<RespuestaMonitoreoSolar>(RUTAS.monitoring)
  }

  /**
   * `incluirSnapshot` agrega el snapshot eléctrico del medidor (voltaje,
   * corriente y potencia por fase) — lo que necesita el diagrama fasorial.
   * Cuesta una llamada extra por nodo, así que las tarjetas no lo piden.
   */
  obtenerDetalle(proyectoId: number, incluirSnapshot = false): Promise<DetalleMonitoreoSolar> {
    return this.get<DetalleMonitoreoSolar>(RUTAS.monitoringDetalle(proyectoId), {
      query: incluirSnapshot ? { incluir_snapshot: true } : undefined,
    })
  }

  obtenerPotenciaInversores(
    proyectoId: number,
    filtros?: { dateFrom: string; dateTo: string },
  ): Promise<PotenciaInversores> {
    return this.get<PotenciaInversores>(RUTAS.invertersPower(proyectoId), {
      query: filtros ? { date_from: filtros.dateFrom, date_to: filtros.dateTo } : undefined,
    })
  }

  async obtenerGeneracionHoy(): Promise<GeneracionHoyProyecto[]> {
    const data = await this.get<RespuestaGeneracionHoy>(RUTAS.generacionHoy)
    return data.proyectos ?? []
  }

  /** Igual que `obtenerGeneracionHoy`, sin desenvolver: `MonitoreoView.vue` también necesita `.total`. */
  obtenerGeneracionHoyCompleta(): Promise<RespuestaGeneracionHoy> {
    return this.get<RespuestaGeneracionHoy>(RUTAS.generacionHoy)
  }

  /** Top de generación de hoy por medidor e inversor (`MobileResumenView.vue`). */
  obtenerResumenDia(): Promise<RespuestaResumenGeneracionDia> {
    return this.get<RespuestaResumenGeneracionDia>(RUTAS.resumenDia)
  }

  obtenerHistorialProyecto(
    proyectoId: number,
    filtros: { fecha_inicio: string; fecha_fin: string; granularidad: string },
  ): Promise<HistorialGeneracionProyecto> {
    return this.get<HistorialGeneracionProyecto>(RUTAS.historialProyecto(proyectoId), {
      query: filtros,
    })
  }
}
