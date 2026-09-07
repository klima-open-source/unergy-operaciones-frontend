/**
 * Mantenimiento (O&M): cálculo mensual por contrato, tasas IPC, factura del
 * proveedor y sus documentos por proyecto. Comparte backend con `arriendos`
 * pero es una entidad distinta (`ArriendosCalculoService`).
 */
import type {
  FacturaOm,
  FilaCalculoOm,
  ItemSeleccionOm,
  PayloadTasaIpc,
  ProyectoOm,
  RespuestaCalculoOm,
  RespuestaSubidaFacturaOm,
  TasaIpc,
} from '~/features/finanzas/types'
import { BaseService } from '~/core/service'

const BASE = '/om'

const RUTAS = {
  calculo: (periodo: string) => `${BASE}/calculo/${periodo}`,
  seleccion: (periodo: string) => `${BASE}/seleccion/${periodo}`,
  seleccionFacturado: (periodo: string, contratoId: FilaCalculoOm['contrato_id']) =>
    `${BASE}/seleccion/${periodo}/${contratoId}/facturado`,
  ipc: `${BASE}/ipc`,
  ipcAño: (año: number) => `${BASE}/ipc/${año}`,
  proyectos: `${BASE}/proyectos`,
  factura: (periodo: string) => `${BASE}/factura/${periodo}`,
  facturaArchivo: (periodo: string) => `${BASE}/factura/${periodo}/file`,
  facturaUpload: (periodo: string) => `${BASE}/factura/${periodo}/upload`,
  facturaEnlace: (periodo: string) => `${BASE}/factura/${periodo}/enlace`,
  sinMatchAsignar: (periodo: string, itemId: string | number) =>
    `${BASE}/factura/${periodo}/sin-match/${itemId}/asignar`,
  documento: (periodo: string, contratoId: FilaCalculoOm['contrato_id']) =>
    `${BASE}/documento/${periodo}/${contratoId}`,
} as const

export class OmService extends BaseService {
  obtenerCalculo(periodo: string): Promise<RespuestaCalculoOm> {
    return this.get<RespuestaCalculoOm>(RUTAS.calculo(periodo))
  }

  guardarSeleccion(periodo: string, items: ItemSeleccionOm[]): Promise<unknown> {
    return this.post<unknown>(RUTAS.seleccion(periodo), { items })
  }

  marcarFacturado(periodo: string, contratoId: FilaCalculoOm['contrato_id']): Promise<unknown> {
    return this.patch<unknown>(RUTAS.seleccionFacturado(periodo, contratoId))
  }

  obtenerIpc(): Promise<TasaIpc[]> {
    return this.get<TasaIpc[]>(RUTAS.ipc)
  }

  guardarIpc(año: number, payload: PayloadTasaIpc): Promise<unknown> {
    return this.put<unknown>(RUTAS.ipcAño(año), payload)
  }

  listarProyectos(): Promise<ProyectoOm[]> {
    return this.get<ProyectoOm[]>(RUTAS.proyectos)
  }

  obtenerFactura(periodo: string): Promise<FacturaOm> {
    return this.get<FacturaOm>(RUTAS.factura(periodo))
  }

  descargarFacturaArchivo(periodo: string): Promise<Blob> {
    return this.get<Blob>(RUTAS.facturaArchivo(periodo), { parse: 'blob' })
  }

  subirFactura(periodo: string, archivo: File): Promise<RespuestaSubidaFacturaOm> {
    const form = new FormData()
    form.append('file', archivo)
    return this.post<RespuestaSubidaFacturaOm>(RUTAS.facturaUpload(periodo), form)
  }

  guardarFacturaEnlace(
    periodo: string,
    payload: { enlace_pdf: string; nombre_archivo: string },
  ): Promise<unknown> {
    return this.put<unknown>(RUTAS.facturaEnlace(periodo), payload)
  }

  asignarSinMatch(
    periodo: string,
    itemId: string | number,
    contratoId: FilaCalculoOm['contrato_id'],
  ): Promise<unknown> {
    return this.patch<unknown>(RUTAS.sinMatchAsignar(periodo, itemId), { contrato_id: contratoId })
  }

  descargarDocumento(periodo: string, contratoId: FilaCalculoOm['contrato_id']): Promise<Blob> {
    return this.get<Blob>(RUTAS.documento(periodo, contratoId), { parse: 'blob' })
  }
}
