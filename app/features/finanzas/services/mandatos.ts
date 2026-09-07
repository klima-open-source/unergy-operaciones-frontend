/** Mandatos de recaudo (vista de Operaciones): carga por ZIP, firma y asignación a inversionista. */
import type {
  InversionistaMandato,
  MandatoOperaciones,
  PeriodoMandatos,
  RespuestaSubidaFirmadoMandato,
  RespuestaSubidaZipMandatos,
  ResumenMandatosOperaciones,
} from '~/features/finanzas/types'
import { BaseService } from '~/core/service'

const BASE = '/mandatos'

const RUTAS = {
  mandatos: BASE,
  mandato: (id: MandatoOperaciones['id']) => `${BASE}/${id}`,
  periodos: `${BASE}/periodos`,
  resumen: `${BASE}/resumen`,
  uploadZip: `${BASE}/upload-zip`,
  uploadFirmado: `${BASE}/upload-firmado`,
  pdf: (id: MandatoOperaciones['id']) => `${BASE}/${id}/pdf`,
  inversionistas: '/mandato-inversionistas',
} as const

export class MandatosService extends BaseService {
  listar(periodo: string): Promise<MandatoOperaciones[]> {
    return this.get<MandatoOperaciones[]>(RUTAS.mandatos, { query: { periodo } })
  }

  listarPeriodos(): Promise<PeriodoMandatos[]> {
    return this.get<PeriodoMandatos[]>(RUTAS.periodos)
  }

  obtenerResumen(periodo: string): Promise<ResumenMandatosOperaciones> {
    return this.get<ResumenMandatosOperaciones>(RUTAS.resumen, { query: { periodo } })
  }

  listarInversionistas(): Promise<InversionistaMandato[]> {
    return this.get<InversionistaMandato[]>(RUTAS.inversionistas)
  }

  subirZip(periodo: string, archivo: File): Promise<RespuestaSubidaZipMandatos> {
    const form = new FormData()
    form.append('periodo', periodo)
    form.append('file', archivo)
    return this.post<RespuestaSubidaZipMandatos>(RUTAS.uploadZip, form)
  }

  subirFirmado(periodo: string, archivo: File): Promise<RespuestaSubidaFirmadoMandato> {
    const form = new FormData()
    form.append('periodo', periodo)
    form.append('file', archivo)
    return this.post<RespuestaSubidaFirmadoMandato>(RUTAS.uploadFirmado, form)
  }

  asignarInversionista(
    id: MandatoOperaciones['id'],
    payload: { inversionista_id: unknown; estado: string },
  ): Promise<unknown> {
    return this.patch<unknown>(RUTAS.mandato(id), payload)
  }

  descargarPdf(id: MandatoOperaciones['id']): Promise<Blob> {
    return this.get<Blob>(RUTAS.pdf(id), { parse: 'blob' })
  }
}
