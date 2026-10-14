/**
 * Filtros de la vista de Verificación de costos.
 *
 * Cada proyecto dice si recibe los conceptos del generador y los del
 * comercializador, y ese dato tiene **tres** estados, no dos: `true`, `false` y
 * `null` — este último significa que el proyecto no cruza con la API de
 * Liquidaciones, así que no se sabe. Tratar el `null` como un "no" diría que un
 * proyecto no cobra cuando en realidad no lo pudimos consultar.
 */

/** Qué se quiere ver en una columna de costos. */
export enum FiltroCostos {
  TODOS = 'todos',
  ACTIVOS = 'si',
  INACTIVOS = 'no',
  SIN_DATO = 'sin_dato',
}

export const OPCIONES_FILTRO_COSTOS: { value: FiltroCostos, label: string }[] = [
  { value: FiltroCostos.TODOS, label: 'Todos' },
  { value: FiltroCostos.ACTIVOS, label: 'Con costos' },
  { value: FiltroCostos.INACTIVOS, label: 'Sin costos' },
  { value: FiltroCostos.SIN_DATO, label: 'Sin dato' },
]

/** Una fila de la tabla, en lo que a estos filtros respecta. */
export interface FilaVerificacion {
  nombre_comercial?: string | null
  from_generator?: boolean | null
  from_commercializer?: boolean | null
}

export interface FiltrosVerificacion {
  texto: string
  generador: FiltroCostos
  comercializador: FiltroCostos
}

const coincide = (valor: boolean | null | undefined, filtro: FiltroCostos): boolean => {
  switch (filtro) {
    case FiltroCostos.ACTIVOS:
      return valor === true
    case FiltroCostos.INACTIVOS:
      return valor === false
    // `null` y `undefined` son lo mismo acá: la API no dijo nada de este proyecto.
    case FiltroCostos.SIN_DATO:
      return valor == null
    default:
      return true
  }
}

/**
 * Las filas que pasan los tres filtros a la vez.
 *
 * El texto busca solo en el nombre comercial, que es lo que la tabla muestra:
 * buscar además en campos que no se ven haría aparecer filas sin motivo visible.
 */
export function filtrarVerificacion(
  filas: FilaVerificacion[], filtros: FiltrosVerificacion,
): FilaVerificacion[] {
  const termino = filtros.texto.trim().toLowerCase()
  return filas.filter((f) =>
    (!termino || (f.nombre_comercial || '').toLowerCase().includes(termino))
    && coincide(f.from_generator, filtros.generador)
    && coincide(f.from_commercializer, filtros.comercializador),
  )
}

/** ¿Hay algún filtro puesto? Sirve para ofrecer limpiarlos. */
export const hayFiltros = (filtros: FiltrosVerificacion): boolean =>
  !!filtros.texto.trim()
  || filtros.generador !== FiltroCostos.TODOS
  || filtros.comercializador !== FiltroCostos.TODOS
