/**
 * Agregados de una consulta al SIMEM: KPIs y total por día.
 *
 * Las columnas no son fijas —cada dataset trae las suyas y el SIMEM las cambia
 * sin avisar— así que la de fecha y las numéricas se detectan en vez de
 * escribirse. Fijarlas dejaría la pantalla en blanco el día que XM renombre
 * una, sin decir por qué.
 */

/** De la más específica a la más general: con `Fecha` sola se pierden las horas. */
const COLUMNAS_FECHA = ['FechaHora', 'FechaInicio', 'Fecha']

/**
 * Columnas que traen números pero NO son medidas: códigos y versiones. Sumarlas
 * no significa nada.
 */
const NO_SON_MEDIDA = /^(version|codigo|fecha|unidad|tipo|nombre)/i

export interface Kpis {
  registros: number
  /** Suma de la columna elegida. `null` si no se eligió ninguna. */
  total: number | null
  /** Plantas distintas. `null` si el dataset no baja a planta. */
  plantas: number | null
  /** Plantas con total distinto de cero. */
  conValor: number | null
  /** Plantas que sumaron exactamente cero. */
  enCero: number | null
}

export function columnaDeFecha(columnas: string[]): string | null {
  return COLUMNAS_FECHA.find((c) => columnas.includes(c)) ?? null
}

const aNumero = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v !== 'string' || !v.trim()) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Las columnas que se pueden sumar. */
export function columnasNumericas(filas: Record<string, unknown>[]): string[] {
  if (!filas.length) return []
  return Object.keys(filas[0]!).filter((c) =>
    !NO_SON_MEDIDA.test(c) && filas.some((f) => aNumero(f[c]) !== null),
  )
}

export interface PuntoDiario {
  dia: string
  valor: number
}

/**
 * Suma de la columna por día.
 *
 * Un día que suma cero SÍ aparece: en estos datasets un cero es información —la
 * planta no generó— y omitirlo lo haría parecer un hueco de datos.
 */
export function totalesPorDia(
  filas: Record<string, unknown>[],
  colFecha: string | null,
  colValor: string | null,
): PuntoDiario[] {
  if (!colFecha || !colValor) return []
  const porDia = new Map<string, number>()
  for (const f of filas) {
    const dia = String(f[colFecha] ?? '').slice(0, 10)
    if (!dia) continue
    porDia.set(dia, (porDia.get(dia) ?? 0) + (aNumero(f[colValor]) ?? 0))
  }
  return [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, valor]) => ({ dia, valor }))
}

export function kpisDe(
  filas: Record<string, unknown>[],
  colValor: string | null,
  colPlanta: string | null,
): Kpis {
  const total = colValor
    ? filas.reduce((s, f) => s + (aNumero(f[colValor]) ?? 0), 0)
    : null

  if (!colPlanta) {
    return { registros: filas.length, total, plantas: null, conValor: null, enCero: null }
  }

  const porPlanta = new Map<string, number>()
  for (const f of filas) {
    const p = String(f[colPlanta] ?? '').trim()
    if (!p) continue
    porPlanta.set(p, (porPlanta.get(p) ?? 0) + (colValor ? (aNumero(f[colValor]) ?? 0) : 0))
  }
  const conValor = [...porPlanta.values()].filter((v) => v !== 0).length
  return {
    registros: filas.length,
    total,
    plantas: porPlanta.size,
    conValor,
    enCero: porPlanta.size - conValor,
  }
}

/**
 * La unidad del dataset, si es UNA sola.
 *
 * Si el dataset mezcla unidades devuelve `null`: rotular una suma de kWh y COP
 * con una sola unidad sería mentir.
 */
export function unidadDe(filas: Record<string, unknown>[]): string | null {
  const unidades = new Set<string>()
  for (const f of filas) {
    const u = String(f.UnidadMedida ?? '').trim()
    if (u) unidades.add(u)
    if (unidades.size > 1) return null
  }
  return unidades.size === 1 ? [...unidades][0]! : null
}
