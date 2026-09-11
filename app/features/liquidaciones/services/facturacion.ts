/**
 * `/facturacion`: la facturación de energía del período — resumen, despacho,
 * agrupaciones, orden manual y marcado de emitidas. Solo lo consume
 * `panels/FacturacionPanel.vue`.
 *
 * El IPP mensual (`/ppa/ipp/mensual`) vive acá y no en `PpaService` — lo único
 * que lo consume es este mismo panel, para indexar la tarifa PPA del período.
 */
import type {
  AgrupacionFacturacion,
  IppMensual,
  PayloadEmitidaFacturacion,
  RespuestaBolsaFacturacion,
  RespuestaCargaDespacho,
  RespuestaCumplimientoFacturacion,
  RespuestaDespachoDias,
  RespuestaFacturacion,
  RespuestaFacturacionDespacho,
} from '~/features/liquidaciones/types'
import type { RespuestaVsDespachos } from '~/features/liquidaciones/utils/vsDespachos'
import { BaseService } from '~/core/service'

const RUTAS = {
  facturacion: '/facturacion',
  despacho: '/facturacion/despacho',
  despachoDias: '/facturacion/despacho/dias',
  agrupaciones: '/facturacion/agrupaciones',
  orden: '/facturacion/orden',
  emitida: '/facturacion/emitida',
  bolsa: '/facturacion/bolsa',
  cumplimiento: '/facturacion/cumplimiento',
  cumplimientoExport: '/facturacion/cumplimiento/export',
  vsDespachos: '/facturacion/vs-despachos',
  ippMensual: '/ppa/ipp/mensual',
} as const

export class FacturacionService extends BaseService {
  obtener(periodo: string): Promise<RespuestaFacturacion> {
    return this.get<RespuestaFacturacion>(RUTAS.facturacion, { query: { periodo } })
  }

  obtenerDespacho(periodo: string): Promise<RespuestaFacturacionDespacho> {
    return this.get<RespuestaFacturacionDespacho>(RUTAS.despacho, { query: { periodo } })
  }

  /** Carga el Excel de despacho del período. */
  subirDespacho(periodo: string, archivo: File): Promise<RespuestaCargaDespacho> {
    const form = new FormData()
    form.append('archivo', archivo)
    return this.postFormData<RespuestaCargaDespacho>(`${RUTAS.despacho}?periodo=${periodo}`, form)
  }

  obtenerDespachoDias(filtros: {
    periodo: string
    contrato: string
  }): Promise<RespuestaDespachoDias> {
    return this.get<RespuestaDespachoDias>(RUTAS.despachoDias, { query: filtros })
  }

  /** Reasigna uno o más contratos a una factura agrupada (o los saca, con `nombre: ''`). */
  guardarAgrupaciones(rows: AgrupacionFacturacion[]): Promise<unknown> {
    return this.put<unknown>(RUTAS.agrupaciones, rows)
  }

  guardarOrden(nombres: string[]): Promise<unknown> {
    return this.put<unknown>(RUTAS.orden, { nombres })
  }

  restablecerOrden(): Promise<unknown> {
    return this.delete<unknown>(RUTAS.orden)
  }

  marcarEmitida(payload: PayloadEmitidaFacturacion): Promise<unknown> {
    return this.put<unknown>(RUTAS.emitida, payload)
  }

  obtenerBolsa(periodo: string): Promise<RespuestaBolsaFacturacion> {
    return this.get<RespuestaBolsaFacturacion>(RUTAS.bolsa, { query: { periodo } })
  }

  guardarBolsa(periodo: string, valor: number | null): Promise<unknown> {
    return this.put<unknown>(RUTAS.bolsa, { periodo, valor })
  }

  obtenerCumplimiento(periodo: string): Promise<RespuestaCumplimientoFacturacion> {
    return this.get<RespuestaCumplimientoFacturacion>(RUTAS.cumplimiento, { query: { periodo } })
  }

  /**
   * Lo que DEBE entrar por proyecto contra lo ya liquidado en despachos.
   * Consulta la API de Liquidaciones del lado del servidor, así que tarda más
   * que el resto del panel.
   */
  obtenerVsDespachos(periodo: string): Promise<RespuestaVsDespachos> {
    return this.get<RespuestaVsDespachos>(RUTAS.vsDespachos, { query: { periodo } })
  }

  /** Excel formulado del valor a indemnizar (3 hojas), generado en el backend. */
  descargarCumplimientoExport(periodo: string): Promise<Blob> {
    return this.get<Blob>(RUTAS.cumplimientoExport, { query: { periodo }, parse: 'blob' })
  }

  // ── IPP mensual (PPA) ─────────────────────────────────────────────────────────

  listarIppMensual(): Promise<IppMensual[]> {
    return this.get<IppMensual[]>(RUTAS.ippMensual)
  }

  guardarIppMensual(entradas: IppMensual[]): Promise<unknown> {
    return this.put<unknown>(RUTAS.ippMensual, entradas)
  }
}
