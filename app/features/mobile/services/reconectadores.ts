/** Reconectadores remotos (Solenium): estado por proyecto y envío de comandos ON/OFF. */
import type {
  EstadoInterruptorReconectadores,
  EstadoReconectador,
  PayloadComandoReconectador,
} from '~/features/mobile/types'
import { BaseService } from '~/core/service'

const BASE = '/reconectadores'

const RUTAS = {
  estados: `${BASE}/estados`,
  interruptor: `${BASE}/interruptor`,
  comando: (proyectoId: number | string) => `${BASE}/${proyectoId}/comando`,
} as const

export class ReconectadoresService extends BaseService {
  obtenerEstados(): Promise<EstadoReconectador[]> {
    return this.get<EstadoReconectador[]>(RUTAS.estados)
  }

  obtenerInterruptor(): Promise<EstadoInterruptorReconectadores> {
    return this.get<EstadoInterruptorReconectadores>(RUTAS.interruptor)
  }

  /** Solo admin: el backend responde 403 a cualquier otro rol. */
  cambiarInterruptor(habilitado: boolean): Promise<EstadoInterruptorReconectadores> {
    return this.post<EstadoInterruptorReconectadores>(RUTAS.interruptor, { habilitado })
  }

  enviarComando(
    proyectoId: number | string,
    payload: PayloadComandoReconectador,
  ): Promise<unknown> {
    return this.post<unknown>(RUTAS.comando(proyectoId), payload)
  }
}
