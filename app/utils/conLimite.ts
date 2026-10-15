/**
 * `Promise.allSettled` sobre `items`, pero con a lo sumo `limite` en vuelo.
 *
 * Para las vistas que piden algo por planta: todas a la vez era una ráfaga de
 * decenas de peticiones simultáneas al Worker y al backend (y cada una, una
 * consulta a una API externa); una por una, una espera innecesaria. El orden
 * del resultado es el de `items`.
 */
export async function conLimite<T, R>(
  items: readonly T[],
  limite: number,
  tarea: (item: T, indice: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const resultados: PromiseSettledResult<R>[] = new Array(items.length)
  let siguiente = 0
  async function trabajador(): Promise<void> {
    while (siguiente < items.length) {
      const i = siguiente++
      try {
        resultados[i] = { status: 'fulfilled', value: await tarea(items[i]!, i) }
      } catch (reason) {
        resultados[i] = { status: 'rejected', reason }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limite), items.length) }, trabajador))
  return resultados
}
