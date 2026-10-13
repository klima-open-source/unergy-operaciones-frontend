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

/** Una fila del registro de unidades del SIMEM (dataset 670221). */
export interface UnidadSimem {
  CodigoPlanta?: string
  CodigoUnidadGeneracion?: string
  NombreUnidad?: string
  FPO?: string
  EstadoRecurso?: string
}

/**
 * Le pega al catálogo lo que el `capains` no trae: las unidades `Uns` y la
 * fecha de entrada en operación. Y agrega las plantas que al `capains` se le
 * escapan.
 *
 * Esas plantas existen: el 2026-10-08, XM liquidaba OEF de `3QPE` (GD BOCAS DEL
 * PALO) y `5ISY` (GD BLANCA ENERGY III), las dos en operación, y ninguna estaba
 * en el archivo. Sin esto salen sin nombre en las tablas y parecen un dato
 * perdido.
 *
 * El `capains` MANDA sobre el nombre: es el oficial. A las plantas que solo
 * existen en el registro de unidades no se les inventa agente ni capacidad —no
 * están en esa fuente, y un cero afirmaría algo falso.
 */
export function completarConUnidades(
  capains: Record<string, PlantaSimem>,
  unidades: UnidadSimem[],
): Record<string, PlantaSimem> {
  const porPlanta = new Map<string, { un: string[], nombre: string, fpo: string }>()
  for (const u of unidades) {
    const planta = limpiar(u.CodigoPlanta)
    const unidad = limpiar(u.CodigoUnidadGeneracion)
    if (!planta || !unidad) continue
    const previo = porPlanta.get(planta)
    if (previo) {
      if (!previo.un.includes(unidad)) previo.un.push(unidad)
      if (!previo.fpo) previo.fpo = limpiar(u.FPO)
    } else {
      porPlanta.set(planta, {
        un: [unidad],
        // "GD BOCAS DEL PALO 1" es la UNIDAD; la planta es el nombre sin ese
        // número final. Si no termina en número, se deja igual.
        nombre: limpiar(u.NombreUnidad).replace(/\s+\d+$/, ''),
        fpo: limpiar(u.FPO),
      })
    }
  }

  const salida: Record<string, PlantaSimem> = { ...capains }
  for (const [planta, datos] of porPlanta) {
    const base = salida[planta]
    salida[planta] = base
      ? { ...base, un: datos.un, ...(datos.fpo ? { fpo: datos.fpo } : {}) }
      : {
          ag: '',
          nm: datos.nombre,
          tc: '',
          un: datos.un,
          ...(datos.fpo ? { fpo: datos.fpo } : {}),
        }
  }
  return salida
}
