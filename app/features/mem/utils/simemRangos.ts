/**
 * Partir un rango de fechas en bloques para consultar al SIMEM.
 *
 * El servicio devuelve 502 cuando se le pide demasiado de una vez. Cuánto
 * aguanta depende de la granularidad del dataset: los horarios traen 24 filas
 * por día y por eso el bloque es corto; los mensuales traen una por mes y
 * aguantan un año.
 *
 * Los límites vienen calibrados contra el servicio real desde el HTML suelto
 * que se usaba antes; no son un número redondo elegido al azar.
 */

/** Datasets con granularidad MENSUAL: una fila por mes, aguantan rangos largos. */
const MENSUALES = new Set(['A8F4C0', 'EEDA4A', 'FB23CF', 'C8381F', 'E60CE2', 'D35CB4'])

/**
 * Datasets de generación y disponibilidad: ~47.000 filas POR DÍA, y entre 3 y 6
 * segundos cada consulta (medido el 2026-10-08). Generación programada llegó a
 * 1,44 millones de filas en una semana. Van de a UN día: con bloques de 28 una
 * sola llamada pediría más de un millón de filas y el SIMEM responde 502 o el
 * navegador se cae. De paso, el progreso se ve avanzar.
 */
const PESADOS = new Set(['055A4D', 'E17D25', '2D5AFE', 'AB7D7F', '24F4EC', '9E77E5'])

/** Conservador a propósito: con más días el SIMEM responde 502 por volumen. */
const DIAS_HORARIO = 28
const DIAS_MENSUAL = 365
const DIAS_PESADO = 1

/**
 * Tope de días que la vista deja pedir de un dataset pesado. A 47.000 filas por
 * día, una semana ya son ~330.000: más que eso no se puede ni mostrar ni
 * exportar con sentido.
 */
export const DIAS_MAXIMO_PESADO = 7

const UN_DIA_MS = 86_400_000

const aFecha = (iso: string) => new Date(`${iso}T00:00:00Z`)
const aIso = (d: Date) => d.toISOString().slice(0, 10)

export interface BloqueFechas {
  inicio: string
  fin: string
}

export function esMensual(datasetId: string): boolean {
  return MENSUALES.has(datasetId.toUpperCase())
}

export function esPesado(datasetId: string): boolean {
  return PESADOS.has(datasetId.toUpperCase())
}

/**
 * Días que abarca el bloque para ese dataset.
 *
 * Un dataset desconocido se trata como horario: pedir de menos solo cuesta una
 * llamada más, pedir de más devuelve 502.
 */
export function tamanoBloque(datasetId: string): number {
  // Pesado manda sobre todo lo demás: el bloque chico nunca rompe, el grande sí.
  if (esPesado(datasetId)) return DIAS_PESADO
  return esMensual(datasetId) ? DIAS_MENSUAL : DIAS_HORARIO
}

export function diasEntre(inicio: string, fin: string): number {
  return Math.round((aFecha(fin).getTime() - aFecha(inicio).getTime()) / UN_DIA_MS)
}

/**
 * El rango partido en bloques contiguos de a lo sumo `maxDias`.
 *
 * Los bloques cubren el rango EXACTO, sin huecos ni solapes: un día repetido
 * duplicaría filas y uno saltado las perdería, y las dos cosas pasan calladas.
 * Un rango invertido devuelve lista vacía en vez de girar para siempre.
 */
export function partirRango(inicio: string, fin: string, maxDias: number): BloqueFechas[] {
  const bloques: BloqueFechas[] = []
  const ultimo = aFecha(fin)
  let actual = aFecha(inicio)

  while (actual <= ultimo) {
    const finBloque = new Date(actual)
    finBloque.setUTCDate(finBloque.getUTCDate() + maxDias - 1)
    if (finBloque > ultimo) finBloque.setTime(ultimo.getTime())
    bloques.push({ inicio: aIso(actual), fin: aIso(finBloque) })
    actual = new Date(finBloque)
    actual.setUTCDate(actual.getUTCDate() + 1)
  }
  return bloques
}
