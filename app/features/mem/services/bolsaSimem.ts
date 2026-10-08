/**
 * Precio de bolsa del mes según SIMEM, leído de NUESTRO backend.
 *
 * A diferencia del resto de la vista SIMEM —que llama a simem.co directo— este
 * número viene del backend a propósito: es el mismo que usa el valor a
 * indemnizar (dataset 709b84, con la regla de tomar el PTB cuando no hay
 * PB_Nal). Recalcularlo acá los separaría el día que cambie una regla.
 *
 * Tampoco es el precio de bolsa de EVO que muestra «Precio de Bolsa»: esa es
 * otra fuente y otra pantalla.
 */
import { BaseService } from '~/core/service'

export interface BolsaSimemMes {
  periodo: string
  /** PNBA del mes en COP/kWh. `null` si el SIMEM no respondió. */
  precio_bolsa: number | null
  horas: number
  dias: number
  /** Horas tomadas del PTB por no haber PB_Nal: el precio superó el de escasez. */
  horas_ptb: number
  techo: number | null
  horas_techadas: number
  /** `{ 'YYYY-MM-DD': { '00': precio, … } }`. */
  detalle: Record<string, Record<string, number>>
}

export class BolsaSimemService extends BaseService {
  obtenerMes(periodo: string): Promise<BolsaSimemMes> {
    return this.get<BolsaSimemMes>('/facturacion/bolsa-simem', { query: { periodo } })
  }
}
