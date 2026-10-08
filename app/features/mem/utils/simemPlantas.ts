/**
 * Cruzar las filas del SIMEM con el catálogo de plantas.
 *
 * Los datasets de OEF, disponibilidad y bolsa traen el código de la planta y
 * nada más. Cruzarlos con el catálogo (`capains`) es lo que permite filtrar por
 * tecnología o por tamaño y leer la tabla sin tener los códigos memorizados.
 */
import type { PlantaSimem } from './simemAgentes'
import { plsDe } from './simemAgentes'

/**
 * Los nombres que el SIMEM le da a la columna del código de planta. Cambian
 * entre datasets, así que se detecta en vez de fijarse.
 */
const COLUMNAS_PLANTA = ['CodigoPlanta', 'CodigoRecurso', 'CodigoCentral']

export interface PlantaEnriquecida {
  codigo: string
  nombre: string
  tecnologia: string
  capacidadKw: number
  agente: string
  unidades: string[]
  pls: string
}

export interface FilaEnriquecida {
  /** La fila del SIMEM, intacta: la tabla pinta sus columnas tal cual. */
  fila: Record<string, unknown>
  /** El código tal como viene en la fila, esté o no en el catálogo. */
  codigo: string | null
  /** `null` si el dataset no baja a planta, o si el código no está en el catálogo. */
  planta: PlantaEnriquecida | null
}

export interface FiltrosPlanta {
  /** Código SIC del agente DUEÑO de la planta, según el catálogo. */
  agente?: string
  tecnologia?: string
  capMin?: number
  capMax?: number
  codigos?: Set<string>
}

export function columnaDePlanta(columnas: string[]): string | null {
  return columnas.find((c) => COLUMNAS_PLANTA.includes(c)) ?? null
}

/**
 * Cada fila con su planta resuelta.
 *
 * Una planta que no está en el catálogo **no se descarta**: se devuelve con
 * `planta: null`. Perder filas por no reconocer un código sería peor que
 * mostrarlas peladas — el catálogo es una foto y siempre va a ir atrás de XM.
 */
export function enriquecerFilas(
  filas: Record<string, unknown>[],
  catalogo: Record<string, PlantaSimem>,
): FilaEnriquecida[] {
  if (!filas.length) return []
  const col = columnaDePlanta(Object.keys(filas[0]!))
  if (!col) return filas.map((fila) => ({ fila, codigo: null, planta: null }))

  return filas.map((fila) => {
    const codigo = String(fila[col] ?? '').trim()
    const p = catalogo[codigo]
    return {
      fila,
      codigo,
      planta: p
        ? {
            codigo,
            nombre: p.nm,
            tecnologia: p.tc,
            capacidadKw: p.kw || 0,
            agente: p.ag,
            unidades: p.un || [],
            pls: plsDe(p.un),
          }
        : null,
    }
  })
}

/**
 * Filtros que dependen de la planta.
 *
 * El agente sale del CATÁLOGO, no de la fila: varios de estos datasets traen
 * solo el código de planta, y sin esto el filtro por agente no haría nada.
 *
 * Agente, tecnología y capacidad exigen una planta RESUELTA: sin catálogo no se sabe si
 * cumple, y afirmar que sí sería inventar. El filtro por código, en cambio, mira
 * el código crudo de la fila: lo que se pidió fue ese código, y si existe en los
 * datos tiene que poder verse aunque el catálogo no lo conozca.
 *
 * Sin filtros activos se muestra todo.
 */
export function filtrarPorPlanta(
  filas: FilaEnriquecida[],
  f: FiltrosPlanta,
): FilaEnriquecida[] {
  const hayFiltro = !!f.agente || !!f.tecnologia || f.capMin != null
    || f.capMax != null || !!f.codigos?.size
  if (!hayFiltro) return filas

  return filas.filter(({ planta, codigo }) => {
    if (f.codigos?.size && !(codigo && f.codigos.has(codigo))) return false
    const porPlanta = !!f.agente || !!f.tecnologia || f.capMin != null || f.capMax != null
    if (!porPlanta) return true
    if (!planta) return false
    if (f.agente && planta.agente.toUpperCase() !== f.agente.toUpperCase()) return false
    if (f.tecnologia && planta.tecnologia !== f.tecnologia) return false
    if (f.capMin != null && planta.capacidadKw < f.capMin) return false
    if (f.capMax != null && planta.capacidadKw > f.capMax) return false
    return true
  })
}
