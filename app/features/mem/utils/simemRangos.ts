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

/** Conservador a propósito: con más días el SIMEM responde 502 por volumen. */
const DIAS_HORARIO = 28
const DIAS_MENSUAL = 365

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

/**
 * Días que abarca el bloque para ese dataset.
 *
 * Un dataset desconocido se trata como horario: pedir de menos solo cuesta una
 * llamada más, pedir de más devuelve 502.
 */
export function tamanoBloque(datasetId: string): number {
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
