/** Catálogo de operadores de red y sus correos de contacto para el reporte CGM. */
import type {
  ContactoOperadorRed,
  OperadorRed,
  PayloadContactoOperadorRed,
  PayloadOperadorRed,
} from '~/features/operadores-red/types'
import { BaseService } from '~/core/service'

const BASE = '/operadores-red'

const RUTAS = {
  operadores: BASE,
  operador: (id: OperadorRed['id']) => `${BASE}/${id}`,
  contactos: (operadorId: OperadorRed['id']) => `${BASE}/${operadorId}/contactos`,
  contacto: (contactoId: ContactoOperadorRed['id']) => `${BASE}/contactos/${contactoId}`,
} as const

export class OperadoresRedService extends BaseService {
  listar(): Promise<OperadorRed[]> {
    return this.get<OperadorRed[]>(RUTAS.operadores)
  }

  obtener(id: OperadorRed['id']): Promise<OperadorRed> {
    return this.get<OperadorRed>(RUTAS.operador(id))
  }

  /**
   * `forzar`: el backend responde 409 cuando el nombre se parece a uno ya
   * registrado (ver `DuplicadoOperadorRed`); repetir la llamada con
   * `forzar: true` lo crea igual.
   */
  crear(payload: PayloadOperadorRed, forzar = false): Promise<OperadorRed> {
    return this.post<OperadorRed>(RUTAS.operadores, payload, { query: { forzar } })
  }

  actualizar(id: OperadorRed['id'], payload: PayloadOperadorRed): Promise<OperadorRed> {
    return this.patch<OperadorRed>(RUTAS.operador(id), payload)
  }

  crearContacto(
    operadorId: OperadorRed['id'],
    payload: PayloadContactoOperadorRed,
  ): Promise<ContactoOperadorRed> {
    return this.post<ContactoOperadorRed>(RUTAS.contactos(operadorId), payload)
  }

  actualizarContacto(
    contactoId: ContactoOperadorRed['id'],
    payload: PayloadContactoOperadorRed,
  ): Promise<unknown> {
    return this.patch<unknown>(RUTAS.contacto(contactoId), payload)
  }

  eliminarContacto(contactoId: ContactoOperadorRed['id']): Promise<unknown> {
    return this.delete<unknown>(RUTAS.contacto(contactoId))
  }
}
