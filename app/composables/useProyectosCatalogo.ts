/**
 * El catálogo de plantas, cargado UNA vez y compartido por toda la aplicación.
 *
 * Diecinueve vistas llamaban a `ProyectosService.listar({ size: 500 })` al
 * montarse — `FallasListView`, `FronterasView`, `CostosView`, `MonitoreoView`,
 * los wizards de contratos, las vistas móviles, `CumplimientoV2View`… — y casi
 * todas para lo mismo: llenar un `<Select>` de plantas.
 *
 * Cada una de esas llamadas no era una petición, era **dos**. El backend
 * recorta todo listado a 100 filas (`TOPE_FILAS` en `api/pagination.py`), así
 * que la primera traía 100 y `completarPaginas` salía a buscar el resto. Y cada
 * fila es el serializer completo de `ProyectoConDetalle`, con sus cinco
 * relaciones anidadas —inversionistas, info técnica, inversores, contactos de
 * área y contratos PPA— para pintar un nombre en un desplegable. Navegar entre
 * cuatro vistas volvía a pagar el catálogo entero cuatro veces, idéntico.
 *
 * Acá se pide una vez y se guarda en `useState`, que en Nuxt es estado
 * compartido de verdad: sobrevive a que la vista se desmonte y a la navegación.
 *
 * **La forma de lo que devuelve es la misma que la de `listar()`**: el mismo
 * array de `ProyectoConDetalle`. Es a propósito — así cada vista cambia una
 * línea y no toca nada más, y si hace falta volver atrás también es una línea.
 *
 * ## Dos decisiones que conviene entender
 *
 * **Vigencia de 60 s, sin invalidación explícita.** Las plantas se crean y se
 * editan en media docena de sitios, y acoplarlos todos a este caché es más
 * código del que vale. Con el TTL, una planta nueva aparece en los desplegables
 * al minuto. Si alguna vez hace falta que aparezca YA, `refrescar()` lo fuerza.
 *
 * **La petición en vuelo se comparte.** Dos componentes que monten a la vez
 * —que es justo lo que pasa: una vista y su formulario— entran los dos en
 * `cargar()` antes de que el primero haya respondido. Sin esto, se piden dos
 * catálogos completos para tirar uno.
 */
import type { ProyectoConDetalle } from '~/features/proyectos/types'
import { logger } from '~/core/logger'
import { ProyectosService } from '~/features/proyectos/services/proyectos'

const SCOPE = 'proyectos-catalogo'

/** Cuánto vale una carga antes de volver a pedirla. */
const VIGENCIA_MS = 60_000

const servicio = new ProyectosService()

/**
 * La petición en curso, si hay una.
 *
 * Va en módulo y no en `useState` porque una promesa no es serializable: esto
 * es del cliente, y ahí el módulo se evalúa una vez.
 */
let enVuelo: Promise<ProyectoConDetalle[]> | null = null

export function useProyectosCatalogo() {
  const proyectos = useState<ProyectoConDetalle[]>('proyectos-catalogo', () => [])
  const cargadoEn = useState<number>('proyectos-catalogo-ts', () => 0)
  const cargando = useState<boolean>('proyectos-catalogo-cargando', () => false)

  function estaVigente(): boolean {
    return proyectos.value.length > 0 && Date.now() - cargadoEn.value < VIGENCIA_MS
  }

  async function pedir(): Promise<ProyectoConDetalle[]> {
    cargando.value = true
    try {
      const lista = await servicio.listar({ size: 500 })
      proyectos.value = lista
      cargadoEn.value = Date.now()
      return lista
    } catch (err) {
      // Se registra y se devuelve lo que haya. Un desplegable vacío es mejor
      // que una vista que no monta: el que necesite distinguirlo mira `.length`.
      logger.error(SCOPE, err)
      return proyectos.value
    } finally {
      cargando.value = false
      enVuelo = null
    }
  }

  /** El catálogo, del caché si está vigente y de la red si no. */
  async function cargar(): Promise<ProyectoConDetalle[]> {
    if (estaVigente()) return proyectos.value
    if (enVuelo) return enVuelo
    enVuelo = pedir()
    return enVuelo
  }

  /** Lo vuelve a pedir aunque esté vigente. Para después de crear o editar. */
  async function refrescar(): Promise<ProyectoConDetalle[]> {
    cargadoEn.value = 0
    return cargar()
  }

  return { proyectos, cargando, cargar, refrescar }
}
