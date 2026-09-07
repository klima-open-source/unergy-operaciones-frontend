/**
 * Documentos de arriendos: cuentas de cobro y facturas del período.
 *
 * El backend genera una copia renombrada por cada predio de la cuenta de cobro
 * —incluidos los que no hicieron match—, así que subir un archivo puede producir
 * varios documentos.
 */
import type { DocumentoArriendo, SubidaCuentaCobro } from '~/features/finanzas/types'
import { BaseService } from '~/core/service'

const BASE = '/arriendos/documentos'

const RUTAS = {
  periodo: (periodo: string) => `${BASE}/${periodo}`,
  archivo: (docId: number) => `${BASE}/file/${docId}`,
  subirCuentaCobro: `${BASE}/upload-cuenta-cobro`,
} as const

export class ArriendosDocsService extends BaseService {
  listarPorPeriodo(periodo: string): Promise<DocumentoArriendo[]> {
    return this.get<DocumentoArriendo[]>(RUTAS.periodo(periodo))
  }

  subirCuentaCobro({
    file,
    fileSecundario,
    periodo,
    pagoId,
    codigoContrato,
    tipoDocumento,
    numeroCuentaCobro,
    nombreArrendatario,
    predios,
  }: SubidaCuentaCobro): Promise<unknown> {
    const form = new FormData()
    form.append('periodo', periodo)
    form.append('pago_id', String(pagoId))
    form.append('codigo_contrato', codigoContrato)
    form.append('tipo_documento', tipoDocumento)
    form.append('predios', JSON.stringify(predios))
    if (numeroCuentaCobro) form.append('numero_cuenta_cobro', numeroCuentaCobro)
    if (nombreArrendatario) form.append('nombre_arrendatario', nombreArrendatario)
    form.append('file', file, file.name)
    if (fileSecundario) form.append('file_secundario', fileSecundario, fileSecundario.name)

    // Sin `Content-Type` a mano: el interceptor lo quita para que el navegador
    // ponga el boundary del multipart.
    return this.post<unknown>(RUTAS.subirCuentaCobro, form)
  }

  /** El PDF crudo, para dárselo al navegador. */
  descargarArchivo(docId: number): Promise<Blob> {
    return this.get<Blob>(RUTAS.archivo(docId), { parse: 'blob' })
  }
}
