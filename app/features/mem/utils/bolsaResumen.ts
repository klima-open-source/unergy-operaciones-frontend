/**
 * Los agregados del precio de bolsa del mes.
 *
 * El backend devuelve el detalle hora por hora (`{ día: { hora: precio } }`); de
 * ahí salen el último precio, los promedios, los extremos y la serie diaria.
 *
 * Regla de fondo: **nunca se rellena una hora que falta.** Se promedia sobre las
 * que hay. Un mes en curso tiene días incompletos y eso no invalida el promedio;
 * inventar un cero o repetir la hora anterior sí movería el número sin que nadie
 * se entere. Por lo mismo, «sin datos» devuelve `null` y no `0`: cero es un
 * precio posible.
 */

export type DetalleHorario = Record<string, Record<string, number>>

export interface PuntoDia {
  dia: string
  promedio: number
  horas: number
}

export interface PrecioPuntual {
  dia: string
  hora: string
  precio: number
}

/** Días de cada ventana de comparación. */
const DIAS_VENTANA = 7

const dias = (d: DetalleHorario) => Object.keys(d).sort()

/** Promedio diario de cada día con horas, ordenado por fecha. */
export function serieDiaria(detalle: DetalleHorario): PuntoDia[] {
  return dias(detalle)
    .map((dia) => {
      const horas = Object.values(detalle[dia] ?? {})
      return horas.length
        ? { dia, promedio: horas.reduce((s, v) => s + v, 0) / horas.length, horas: horas.length }
        : null
    })
    .filter((p): p is PuntoDia => p !== null)
}

/** La última hora publicada del último día con datos. */
export function ultimoPrecio(detalle: DetalleHorario): PrecioPuntual | null {
  for (const dia of dias(detalle).reverse()) {
    const horas = Object.keys(detalle[dia] ?? {}).sort()
    const hora = horas.at(-1)
    if (hora) return { dia, hora, precio: detalle[dia]![hora]! }
  }
  return null
}

/**
 * Promedio ponderado POR HORA de los días pedidos.
 *
 * Ponderar por hora y no por día importa: un día de 6 horas publicadas no pesa
 * lo mismo que uno completo, y promediar los promedios diarios daría otro
 * número. Los días que no existen se ignoran, no cuentan como cero.
 */
export function promedio(detalle: DetalleHorario, diasPedidos: string[]): number | null {
  const valores = diasPedidos.flatMap((d) => Object.values(detalle[d] ?? {}))
  return valores.length ? valores.reduce((s, v) => s + v, 0) / valores.length : null
}

/** Cambio porcentual de `actual` contra `previo`. */
export function variacion(actual: number | null, previo: number | null): number | null {
  // Contra cero no se divide: infinito no es una variación que se pueda mostrar.
  if (actual == null || previo == null || previo === 0) return null
  return ((actual - previo) / previo) * 100
}

function extremo(detalle: DetalleHorario, elegir: (a: number, b: number) => boolean): PrecioPuntual | null {
  let mejor: PrecioPuntual | null = null
  for (const [dia, horas] of Object.entries(detalle)) {
    for (const [hora, precio] of Object.entries(horas)) {
      if (!mejor || elegir(precio, mejor.precio)) mejor = { dia, hora, precio }
    }
  }
  return mejor
}

export interface ResumenBolsa {
  ultimo: PrecioPuntual | null
  maximo: PrecioPuntual | null
  minimo: PrecioPuntual | null
  promedioMes: number | null
  promedioMesPrevio: number | null
  variacionMes: number | null
  promedio7d: number | null
  promedio7dPrevio: number | null
  variacion7d: number | null
  serie: PuntoDia[]
}

/**
 * Todo lo que la vista muestra del mes, en una pasada.
 *
 * Las dos ventanas de 7 días se cuentan desde el ÚLTIMO día con datos, no desde
 * hoy: en un mes cerrado «los últimos 7 días» son los del mes, y en uno en curso
 * son los que ya se publicaron. Si no hay ventana anterior completa, la
 * variación queda en `null` en vez de compararse contra medio período.
 */
export function resumirBolsa(
  detalle: DetalleHorario,
  detallePrevio: DetalleHorario | null,
): ResumenBolsa {
  const todos = dias(detalle)
  const recientes = todos.slice(-DIAS_VENTANA)
  const anteriores = todos.slice(-DIAS_VENTANA * 2, -DIAS_VENTANA)

  const promedioMes = promedio(detalle, todos)
  const promedioMesPrevio = detallePrevio
    ? promedio(detallePrevio, dias(detallePrevio))
    : null
  const promedio7d = promedio(detalle, recientes)
  const promedio7dPrevio = promedio(detalle, anteriores)

  return {
    ultimo: ultimoPrecio(detalle),
    maximo: extremo(detalle, (a, b) => a > b),
    minimo: extremo(detalle, (a, b) => a < b),
    promedioMes,
    promedioMesPrevio,
    variacionMes: variacion(promedioMes, promedioMesPrevio),
    promedio7d,
    promedio7dPrevio,
    variacion7d: variacion(promedio7d, promedio7dPrevio),
    serie: serieDiaria(detalle),
  }
}
