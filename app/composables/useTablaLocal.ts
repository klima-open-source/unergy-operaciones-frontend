import { computed, ref, watch, type Ref } from 'vue'
import type { DataTableRow, DataTableSort } from '~/components/blocks/DataTable.vue'

/** El valor de `fila` en una ruta con puntos (`'proyecto.nombre_comercial'`). */
export function valorEnRuta(fila: DataTableRow, ruta: string): unknown {
  let actual: unknown = fila
  for (const parte of ruta.split('.')) {
    if (actual == null || typeof actual !== 'object') return undefined
    actual = (actual as Record<string, unknown>)[parte]
  }
  return actual
}

function comparar(x: unknown, y: unknown): number {
  if (typeof x === 'number' && typeof y === 'number') return x - y
  return String(x).localeCompare(String(y), 'es', { numeric: true, sensitivity: 'base' })
}

/** Copia ordenada de `filas`; los vacíos van siempre al final, en cualquier dirección. */
export function ordenarFilas<T extends DataTableRow>(filas: T[], orden: DataTableSort | null): T[] {
  if (!orden) return filas
  const signo = orden.direction === 'asc' ? 1 : -1
  return [...filas].sort((a, b) => {
    const x = valorEnRuta(a, orden.key)
    const y = valorEnRuta(b, orden.key)
    const xVacio = x == null || x === ''
    const yVacio = y == null || y === ''
    if (xVacio && yVacio) return 0
    if (xVacio) return 1
    if (yVacio) return -1
    return comparar(x, y) * signo
  })
}

/**
 * Orden y paginación en el cliente para `blocks/DataTable`, que los deja a quien
 * lo usa. La página vuelve a 1 cuando cambian las filas (un filtro, una
 * búsqueda) o el orden: quedarse en la página 4 de una lista que ahora tiene 2
 * mostraría una tabla vacía.
 */
export function useTablaLocal<T extends DataTableRow>(
  filas: Ref<T[]>,
  ordenInicial: DataTableSort,
  porPagina: Ref<number>,
) {
  const orden = ref<DataTableSort>(ordenInicial)
  const pagina = ref(1)

  const ordenadas = computed(() => ordenarFilas(filas.value, orden.value))
  const filasPagina = computed(() =>
    ordenadas.value.slice((pagina.value - 1) * porPagina.value, pagina.value * porPagina.value),
  )
  const total = computed(() => filas.value.length)

  watch([filas, orden, porPagina], () => {
    pagina.value = 1
  })

  return { orden, pagina, filasPagina, total }
}
