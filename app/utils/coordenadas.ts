/**
 * Lectura y validación de coordenadas escritas o pegadas a mano.
 *
 * Una coordenada nunca lleva separador de miles, así que el punto y la coma se
 * leen siempre como decimal: `6.244203` y `6,244203` son lo mismo. Por eso las
 * coordenadas no usan `NumberField`, que con el formato es-CO lee el punto como
 * miles y convierte `6.244203` en 6.244.203.
 */

/** Decimales que se guardan: 6 son ~11 cm, más de lo que distingue un GPS. */
export const DECIMALES_COORDENADA = 6

/** Rango de Colombia (con un margen), para avisar de signos olvidados o pares invertidos. */
export const RANGO_COLOMBIA = {
  latitud: { min: -4.3, max: 13.5 },
  longitud: { min: -82, max: -66 },
} as const

export interface ParCoordenadas {
  latitud: number
  longitud: number
}

const NUMERO = /^-?\d{1,3}(?:[.,]\d+)?$/

function redondear(n: number): number {
  const f = 10 ** DECIMALES_COORDENADA
  return Math.round(n * f) / f
}

/**
 * Un número de coordenada. `null` si el texto está vacío; `undefined` si no se
 * puede leer como coordenada (p. ej. `6.244.203` o `abc`).
 */
export function leerCoordenada(texto: string): number | null | undefined {
  const limpio = texto.trim()
  if (limpio === '') return null
  if (!NUMERO.test(limpio)) return undefined
  return redondear(Number(limpio.replace(',', '.')))
}

/**
 * Las dos coordenadas juntas, como las copia Google Maps (`6.244203, -75.581211`).
 * `null` si el texto no es un par.
 *
 * La coma separa el par solo cuando los dos números usan punto decimal o cuando
 * va seguida de un espacio: `6,24` sola es una latitud con coma decimal, no el
 * par (6, 24).
 */
export function leerPar(texto: string): ParCoordenadas | null {
  const limpio = texto.trim()
  const conPunto = limpio.match(/^(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/)
  const otroSeparador = limpio.match(/^(-?\d{1,3}(?:[.,]\d+)?)(?:\s*;\s*|,\s+|\s+)(-?\d{1,3}(?:[.,]\d+)?)$/)
  const m = conPunto ?? otroSeparador
  if (!m) return null
  const latitud = leerCoordenada(m[1]!)
  const longitud = leerCoordenada(m[2]!)
  if (latitud == null || longitud == null) return null
  return { latitud, longitud }
}

/** El número como se muestra en el campo: coma decimal, sin separador de miles. */
export function mostrarCoordenada(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return ''
  const n = Number(valor)
  return Number.isFinite(n) ? String(redondear(n)).replace('.', ',') : ''
}

/** Avisos (no bloquean el guardado): el punto existe pero no cae en Colombia. */
export function avisosCoordenadas(latitud: number | null, longitud: number | null): string[] {
  const avisos: string[] = []
  const { latitud: rLat, longitud: rLon } = RANGO_COLOMBIA
  const latFuera = latitud != null && (latitud < rLat.min || latitud > rLat.max)
  const lonFuera = longitud != null && (longitud < rLon.min || longitud > rLon.max)
  if (latitud != null && longitud != null && latFuera && lonFuera
      && longitud >= rLat.min && longitud <= rLat.max && latitud >= rLon.min && latitud <= rLon.max) {
    return ['Parece que la latitud y la longitud están invertidas.']
  }
  if (longitud != null && lonFuera && -longitud >= rLon.min && -longitud <= rLon.max) {
    avisos.push('A la longitud le falta el signo menos: en Colombia es negativa.')
  } else if (lonFuera) {
    avisos.push(`La longitud no cae en Colombia (${rLon.min} a ${rLon.max}).`)
  }
  if (latFuera) avisos.push(`La latitud no cae en Colombia (${rLat.min} a ${rLat.max}).`)
  return avisos
}

/** Enlace a Google Maps con el punto, para comprobarlo de un clic. */
export function enlaceGoogleMaps(latitud: number, longitud: number): string {
  return `https://www.google.com/maps?q=${latitud},${longitud}`
}
