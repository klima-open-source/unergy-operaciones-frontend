/**
 * Códigos de agente del SIMEM: el catálogo de plantas cruzado con el registro
 * de agentes.
 *
 * Portado del HTML suelto que se usaba por fuera de la plataforma. El catálogo
 * de plantas viene del archivo `capains` de XM y viaja como JSON estático
 * (`~/features/mem/data/plantasSimem.json`); la razón social y las actividades
 * salen en vivo del dataset 972263 del SIMEM.
 *
 * Acá vive lo único que tiene reglas: derivar el código `Pls`, agrupar por
 * agente y filtrar. El pintado y la llamada HTTP quedan fuera para poder
 * probarlo.
 */

/** Una planta del catálogo `capains`. */
export interface PlantaSimem {
  /** Código SIC del agente dueño. */
  ag: string
  /** Nombre de la planta. */
  nm: string
  /** Capacidad en kW. */
  kw?: number
  /** Tecnología: SOL, AGUA, GASMBT, CARBON, VIENTO, OTROS… */
  tc: string
  /** Unidades de generación en el SIMEM (`Uns…` solares, `Unh…` hidráulicas). */
  un?: string[]
  /** Despacho: ND (no centralizado) | DC (centralizado). */
  dp?: string
  /** Fecha de puesta en operación. */
  fpo?: string
}

export interface AgenteSimem {
  nombre: string
  actividades: string[]
}

export interface PlantaDeAgente {
  codigo: string
  nombre: string
  capacidadKw: number
  tecnologia: string
  unidades: string[]
  pls: string
  despacho?: string
  fpo?: string
}

export interface FilaAgente {
  codigo: string
  nombre: string
  actividades: string[]
  plantas: PlantaDeAgente[]
  capacidadKw: number
  tecnologias: string[]
  esUnergy: boolean
}

export interface FiltrosAgentes {
  q: string
  tecnologia: string
  soloUnergy: boolean
  actividad: string
}

export const TECNOLOGIAS: Record<string, string> = {
  SOL: 'Solar',
  AGUA: 'Hidráulica',
  GASMBT: 'Gas',
  CARBON: 'Carbón',
  VIENTO: 'Eólica',
  ACPM: 'ACPM',
  BIOM: 'Biomasa',
  FOIL: 'Fuel oil',
  OTROS: 'Otros',
}

/**
 * El código `Pls` del SRC a partir del `Uns` del SIMEM: el mismo número **menos
 * uno**, conservando el ancho.
 *
 * Verificado contra XM en 4 de 4 solares de una sola unidad. Solo aplica con
 * UNA unidad y solo a los `Uns`: con varias no hay a cuál corresponder, y las
 * hidráulicas (`Unh`) y térmicas (`Unt`) no siguen esta regla.
 *
 * Devuelve `''` cuando no aplica — no es un error, es que ese código no existe.
 */
export function plsDe(unidades: string[] | undefined | null): string {
  if (!unidades || unidades.length !== 1) return ''
  const uns = unidades[0]!
  if (!/^Uns\d+$/.test(uns)) return ''
  const digitos = uns.slice(3)
  return 'Pls' + String(Number.parseInt(digitos, 10) - 1).padStart(digitos.length, '0')
}

function aPlanta(codigo: string, p: PlantaSimem): PlantaDeAgente {
  return {
    codigo,
    nombre: p.nm,
    capacidadKw: p.kw || 0,
    tecnologia: p.tc,
    unidades: p.un || [],
    pls: plsDe(p.un),
    despacho: p.dp,
    fpo: p.fpo,
  }
}

function resumir(codigo: string, nombre: string, actividades: string[],
  plantas: PlantaDeAgente[], esUnergy: boolean): FilaAgente {
  return {
    codigo,
    nombre,
    actividades,
    plantas,
    capacidadKw: plantas.reduce((s, p) => s + p.capacidadKw, 0),
    tecnologias: [...new Set(plantas.map((p) => p.tecnologia))],
    esUnergy,
  }
}

/**
 * Una fila por agente, con sus plantas.
 *
 * El universo es la UNIÓN del registro del SIMEM y del catálogo de plantas: hay
 * agentes registrados sin plantas (comercializadores puros) y plantas de
 * agentes que el registro del día no trae. Quedarse con uno solo de los dos
 * perdería información en los dos sentidos.
 *
 * Los de Unergy van primero: es la lista que se mira todos los días.
 */
export function agentesDesdeCatalogo(
  catalogo: Record<string, PlantaSimem>,
  agentes: Record<string, AgenteSimem>,
  unergy: Set<string>,
): FilaAgente[] {
  const plantasPorAgente = new Map<string, PlantaDeAgente[]>()
  for (const [codigo, p] of Object.entries(catalogo)) {
    const lista = plantasPorAgente.get(p.ag)
    if (lista) lista.push(aPlanta(codigo, p))
    else plantasPorAgente.set(p.ag, [aPlanta(codigo, p)])
  }

  const codigos = new Set([...Object.keys(agentes), ...plantasPorAgente.keys()])
  return [...codigos]
    .map((codigo) => {
      const info = agentes[codigo]
      const plantas = plantasPorAgente.get(codigo) || []
      // Sin actividades en el registro pero con plantas, genera: es lo único
      // que se puede afirmar, y dejarlo vacío lo sacaría del filtro.
      const actividades = info?.actividades?.length
        ? info.actividades
        : (plantas.length ? ['Generador'] : [])
      return resumir(codigo, info?.nombre || '—', actividades, plantas, unergy.has(codigo))
    })
    .sort((a, b) =>
      (a.esUnergy === b.esUnergy ? 0 : a.esUnergy ? -1 : 1) || a.codigo.localeCompare(b.codigo),
    )
}

function coincidePlanta(p: PlantaDeAgente, q: string): boolean {
  return p.nombre.toUpperCase().includes(q)
    || p.codigo.toUpperCase().includes(q)
    || p.unidades.some((u) => u.toUpperCase().includes(q))
    || (!!p.pls && p.pls.toUpperCase().includes(q))
}

/**
 * Aplica los filtros de pantalla.
 *
 * La búsqueda tiene dos modos a propósito: si el texto coincide con el AGENTE
 * se muestran todas sus plantas —se está buscando la empresa—; si coincide con
 * plantas, se muestran solo esas —se está buscando la planta—. Mostrar las 40
 * plantas de un agente porque una coincidió escondería la que se buscaba.
 */
export function filtrarAgentes(filas: FilaAgente[], f: FiltrosAgentes): FilaAgente[] {
  const q = (f.q || '').trim().toUpperCase()
  let rows = filas

  if (f.actividad) rows = rows.filter((r) => r.actividades.includes(f.actividad))
  if (f.soloUnergy) rows = rows.filter((r) => r.esUnergy)

  if (f.tecnologia) {
    rows = rows
      .map((r) => resumir(r.codigo, r.nombre, r.actividades,
        r.plantas.filter((p) => p.tecnologia === f.tecnologia), r.esUnergy))
      // Un agente sin plantas de esa tecnología no es un resultado vacío: no
      // pertenece al filtro.
      .filter((r) => r.plantas.length > 0)
  }

  if (q) {
    rows = rows
      .map((r) => {
        if (r.codigo.includes(q) || r.nombre.toUpperCase().includes(q)) return r
        const plantas = r.plantas.filter((p) => coincidePlanta(p, q))
        return plantas.length
          ? resumir(r.codigo, r.nombre, r.actividades, plantas, r.esUnergy)
          : null
      })
      .filter((r): r is FilaAgente => r !== null)
  }

  return rows
}
