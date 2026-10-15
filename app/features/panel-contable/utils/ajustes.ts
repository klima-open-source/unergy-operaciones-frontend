/**
 * El panel de AJUSTE de una reliquidación.
 *
 * Cuando XM publica una versión corregida de un mes, el estado de resultados que
 * se emite para esa reliquidación **ya viene con la diferencia** contra la
 * versión anterior: acá no se resta nada. Lo que cambia es qué se contabiliza —
 * solo ingresos y comercialización— y cómo se lee.
 *
 * Espejo de `apps/contabilidad/services/ajustes.py`. Si allá cambia el prefijo o
 * la primera versión, acá también.
 */

import { GrupoLinea, ModoCargaEr, TipoPanel, VersionAjuste } from '~/features/panel-contable/types'
import type { LineaPanel, TipoAjuste, TipoPanelDatos } from '~/features/panel-contable/types'

/** Lo que antecede a la versión en el `tipo` del panel. */
const PREFIJO_AJUSTE = 'ajuste_'

/** Los únicos grupos que un ajuste contabiliza. */
export const GRUPOS_AJUSTE: readonly GrupoLinea[] = [
  GrupoLinea.INGRESOS,
  GrupoLinea.COMERCIALIZACION,
]

export const VERSIONES_AJUSTE: readonly VersionAjuste[] = Object.values(VersionAjuste)

export const tipoDeAjuste = (version: VersionAjuste): TipoAjuste =>
  `${PREFIJO_AJUSTE}${version}`

const esVersionDeAjuste = (v: string): v is VersionAjuste =>
  (VERSIONES_AJUSTE as readonly string[]).includes(v)

/** La versión que lleva un tipo de ajuste, o `null` si el tipo no es uno. */
export function versionDeAjuste(tipo: TipoPanelDatos | string): VersionAjuste | null {
  if (!tipo.startsWith(PREFIJO_AJUSTE)) return null
  const version = tipo.slice(PREFIJO_AJUSTE.length)
  return esVersionDeAjuste(version) ? version : null
}

export const esAjuste = (tipo: TipoPanelDatos | string): boolean =>
  versionDeAjuste(tipo) !== null

/**
 * El tipo de panel que toca pedirle al backend.
 *
 * Fuera de la pestaña de ajustes la versión no pinta nada, así que se ignora en
 * vez de colarse en la petición.
 */
export function tipoDeDatos(
  esPestanaDeAjustes: boolean,
  version: VersionAjuste,
  tipoBase: TipoPanel,
): TipoPanelDatos {
  return esPestanaDeAjustes ? tipoDeAjuste(version) : tipoBase
}

/**
 * El `tipo` que el backend entiende, a partir de lo que eligió quien sube el ER.
 *
 * La versión solo pinta cuando se está subiendo un ajuste; en los otros dos
 * modos se ignora en vez de colarse en la petición.
 */
export function tipoDeModo(modo: ModoCargaEr, version: VersionAjuste): TipoPanelDatos {
  switch (modo) {
    case ModoCargaEr.AJUSTE:
      return tipoDeAjuste(version)
    case ModoCargaEr.OFICIAL:
      return TipoPanel.OFICIAL
    default:
      return TipoPanel.PRELIQUIDACION
  }
}

/**
 * Las líneas que un ajuste muestra.
 *
 * Un panel de ajuste ya se guardó recortado, así que esto normalmente no quita
 * nada: está para que un panel viejo —o uno cargado antes de la regla— no
 * aparezca con costos que no se deben volver a contabilizar.
 */
export const lineasDeAjuste = (lineas: LineaPanel[]): LineaPanel[] =>
  lineas.filter((l) => GRUPOS_AJUSTE.includes(l.grupo))

/**
 * Suma de una lista de líneas.
 *
 * Los costos ya vienen en negativo desde el backend, así que el total es una
 * SUMA con signo y nunca una resta entre grupos: restar grupos fue el bug que
 * infló los valores a pagar del espejo del Panel.
 */
export const sumar = (lineas: LineaPanel[]): number =>
  lineas.reduce((s, l) => s + (l.valor_cop ?? 0), 0)

/** Las líneas de un grupo, en el orden en que vinieron. */
export const lineasDe = (lineas: LineaPanel[], grupo: GrupoLinea): LineaPanel[] =>
  lineas.filter((l) => l.grupo === grupo)

/**
 * ¿Este ajuste no mueve nada?
 *
 * Un proyecto cuya reliquidación no cambió ninguna cifra no tiene nada que
 * contabilizar, y conviene poder esconderlo para que la vista muestre solo lo
 * que hay que registrar.
 */
export const ajusteEnCero = (lineas: LineaPanel[]): boolean =>
  lineasDeAjuste(lineas).every((l) => !l.valor_cop)
