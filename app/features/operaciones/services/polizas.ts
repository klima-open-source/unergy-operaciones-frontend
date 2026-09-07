/** Pólizas de responsabilidad civil de las plantas: una fila por proyecto. */
import type { Poliza, PayloadPoliza } from '~/features/operaciones/types'
import { BaseService } from '~/core/service'

const BASE = '/polizas'

export class PolizasService extends BaseService {
  listar(): Promise<Poliza[]> {
    return this.get<Poliza[]>(BASE)
  }

  guardar(proyectoId: Poliza['proyecto_id'], payload: PayloadPoliza): Promise<unknown> {
    return this.put<unknown>(`${BASE}/${proyectoId}`, payload)
  }
}
