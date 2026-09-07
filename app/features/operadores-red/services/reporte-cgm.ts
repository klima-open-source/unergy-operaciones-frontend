/** Envío del reporte CGM (operadores de red + clientes con vínculo CGM) y su historial. */
import type {
  EnvioInforme,
  FronteraCgm,
  PayloadEnvioCgm,
  RespuestaEnvioCgm,
} from '~/features/operadores-red/types'
import { BaseService } from '~/core/service'

const RUTAS = {
  fronteras: '/fronteras',
  enviar: '/reporte-cgm/enviar',
  historialEnvios: '/informes/envios',
} as const

/** "Operaciones Unergy" (todas las fronteras) puede tardar >150 s el último día del mes. */
const TIMEOUT_ENVIO_MS = 300_000

export class ReporteCgmService extends BaseService {
  /** Las fronteras vivas, con sus vínculos de operador y clientes CGM. */
  listarFronteras(): Promise<FronteraCgm[]> {
    return this.get<FronteraCgm[]>(RUTAS.fronteras, {
      query: { limit: 500, incluir_clientes_cgm: true },
    })
  }

  enviar(payload: PayloadEnvioCgm): Promise<RespuestaEnvioCgm> {
    return this.post<RespuestaEnvioCgm>(RUTAS.enviar, payload, {
      signal: () => AbortSignal.timeout(TIMEOUT_ENVIO_MS),
    })
  }

  listarHistorialEnvios(): Promise<EnvioInforme[]> {
    return this.get<EnvioInforme[]>(RUTAS.historialEnvios, {
      query: { tipo: 'reporte_cgm', limit: 500 },
    })
  }
}
