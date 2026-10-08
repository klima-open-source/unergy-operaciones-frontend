/**
 * Leer el archivo `capains` de XM: el catálogo de plantas del mercado.
 *
 * Llega por el FTP de XM como `capainsMMDD.tx1` y es un CSV separado por `;`.
 * Trae UNA FILA POR (planta, submercado), así que las plantas se repiten: hay
 * que agrupar por código, no contar filas.
 *
 * No trae las unidades `Uns` ni la fecha de entrada en operación; eso se le pega
 * aparte desde el SIMEM. Este módulo lee solo lo que el archivo tiene.
 */
import type { PlantaSimem } from './simemAgentes'

/** Las columnas, en el orden en que XM las escribe. */
const COLUMNAS = [
  'AGENTE', 'PLANTA', 'NOMBRE', 'CAPACIDAD INSTALADA', 'DESPACHO CENTRAL',
  'TIPO', 'TIPO TECNOLOGIA', 'EXPLOTACION COMERCIAL',
] as const

/** Lo mínimo que tiene que decir la cabecera para creerle al archivo. */
const CABECERA_ESPERADA = ['AGENTE', 'PLANTA', 'NOMBRE']

const limpiar = (v: string | undefined) => (v ?? '').trim()

/**
 * `{ códigoPlanta: datos }` a partir del contenido del archivo.
 *
 * Un archivo que no sea un `capains` devuelve `{}` en vez de basura: este
 * catálogo reemplaza al que está en uso, y medio catálogo mal leído sería peor
 * que ninguno.
 */
export function parsearCapains(contenido: string): Record<string, PlantaSimem> {
  const lineas = contenido.split(/\r?\n/).filter((l) => l.trim())
  if (!lineas.length) return {}

  const cabecera = lineas[0]!.split(';').map((c) => limpiar(c).toUpperCase())
  if (!CABECERA_ESPERADA.every((c, i) => cabecera[i] === c)) return {}

  const plantas: Record<string, PlantaSimem> = {}
  for (const linea of lineas.slice(1)) {
    const campos = linea.split(';')
    const codigo = limpiar(campos[COLUMNAS.indexOf('PLANTA')])
    if (!codigo) continue
    // La primera fila de cada planta manda; las demás solo repiten submercado.
    if (plantas[codigo]) continue

    const kw = Number.parseFloat(limpiar(campos[COLUMNAS.indexOf('CAPACIDAD INSTALADA')]))
    plantas[codigo] = {
      ag: limpiar(campos[COLUMNAS.indexOf('AGENTE')]),
      nm: limpiar(campos[COLUMNAS.indexOf('NOMBRE')]),
      // Una capacidad ilegible queda en 0 y no tumba el archivo entero: el
      // nombre y el agente de esa planta siguen sirviendo.
      kw: Number.isFinite(kw) ? kw : 0,
      dp: limpiar(campos[COLUMNAS.indexOf('DESPACHO CENTRAL')]),
      tp: limpiar(campos[COLUMNAS.indexOf('TIPO')]),
      tc: limpiar(campos[COLUMNAS.indexOf('TIPO TECNOLOGIA')]),
    }
  }
  return plantas
}

/**
 * La fecha del archivo, sacada de su nombre (`capains1006.tx1` → 06 de octubre).
 *
 * El año no está en el nombre: lo pone quien llama (la carpeta del FTP sí lo
 * tiene). Un nombre que no cuadre devuelve `null` en vez de una fecha inventada.
 */
export function fechaDeNombre(nombre: string, anio: number): string | null {
  const m = /capains(\d{2})(\d{2})\./i.exec(nombre.replace(/\\/g, '/').split('/').pop() ?? '')
  if (!m) return null
  const mes = Number(m[1])
  const dia = Number(m[2])
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null
  return `${anio}-${m[1]}-${m[2]}`
}
