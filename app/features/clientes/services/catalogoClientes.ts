/**
 * La lista de clientes para los selectores de "parte de un contrato".
 *
 * Cada wizard la cargaba por su cuenta (`todosClientes` en el de servicios, otra
 * copia en el de PPA), y con un selector por parte serían cinco peticiones
 * idénticas por pantalla. Acá se pide UNA vez y se comparte; `agregar()` mete el
 * cliente recién creado para que aparezca en los demás selectores sin recargar.
 */
import type { Cliente } from '~/types/cliente'
import { ClientesService } from '~/features/clientes/services/clientes'

let promesa: Promise<Cliente[]> | null = null
let lista: Cliente[] = []

/** Los clientes, pidiéndolos solo la primera vez. */
export function clientes(recargar = false): Promise<Cliente[]> {
  if (recargar || !promesa) {
    promesa = new ClientesService()
      .listar({ size: 500 })
      .then((filas) => {
        lista = filas
        return lista
      })
      .catch((e) => {
        // Un fallo no debe dejar el caché envenenado: el siguiente selector que
        // se abra vuelve a intentarlo.
        promesa = null
        throw e
      })
  }
  return promesa
}

/** Suma el cliente recién creado, sin volver a pedir la lista entera. */
export function agregar(cliente: Cliente): void {
  if (!cliente?.id) return
  const i = lista.findIndex((c) => c.id === cliente.id)
  if (i >= 0) lista[i] = cliente
  else lista.push(cliente)
}
