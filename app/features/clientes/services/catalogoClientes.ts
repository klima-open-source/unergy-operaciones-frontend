/**
 * La lista de clientes para los selectores de cliente.
 *
 * Cada wizard la cargaba por su cuenta (`todosClientes` en el de servicios, otra
 * copia en el de PPA), y con un selector por parte serían cinco peticiones
 * idénticas por pantalla. Acá se pide UNA vez y se comparte; `agregar()` mete el
 * cliente recién creado para que aparezca en los demás selectores sin recargar.
 *
 * Viene de `GET /clientes/lista` (todos, en una petición) y vale 5 minutos: así
 * un cliente creado o renombrado desde otra pestaña termina apareciendo.
 */
import type { ClienteLiviano } from '~/types/cliente'
import { ClientesService } from '~/features/clientes/services/clientes'
import { slugify } from '~/utils/string'

const VIGENCIA_MS = 5 * 60_000

let promesa: Promise<ClienteLiviano[]> | null = null
let pedidaEn = 0
let lista: ClienteLiviano[] = []

/** Los clientes, del caché si está vigente. */
export function clientes(recargar = false): Promise<ClienteLiviano[]> {
  if (recargar || !promesa || Date.now() - pedidaEn > VIGENCIA_MS) {
    pedidaEn = Date.now()
    promesa = new ClientesService()
      .listarLiviano()
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

/**
 * El cliente que se llama igual —sin contar tildes, mayúsculas ni puntuación—, o
 * `null` si no hay ninguno o hay más de uno: con dos homónimos, elegir uno al azar
 * ataría el contrato al cliente equivocado.
 */
export function clientePorNombre<T extends ClienteLiviano>(lista: T[], nombre: string): T | null {
  // Sin los guiones de `slugify`: "S.A.S." y "SAS" tienen que ser lo mismo.
  const claveDe = (texto: string) => slugify(texto).replaceAll('-', '')
  const clave = claveDe(nombre)
  if (!clave) return null
  const iguales = lista.filter((c) => claveDe(c.razon_social_nombre ?? '') === clave)
  return iguales.length === 1 ? iguales[0]! : null
}

/** Suma el cliente recién creado, sin volver a pedir la lista entera. */
export function agregar(cliente: ClienteLiviano): void {
  if (!cliente?.id) return
  const i = lista.findIndex((c) => c.id === cliente.id)
  if (i >= 0) lista[i] = cliente
  else lista.push(cliente)
}
