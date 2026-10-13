// ──────────────────────────────────────────────────────────────────────────
// Pestañas de estado de la lista de fallas.
//
// Operaciones no trabaja con los seis estados del catálogo sino con cuatro
// grupos: "en espera" se gestiona igual que "en gestión", y una falla "sin
// solución" sigue abierta para el equipo (no se dio por cerrada, se dejó de
// poder resolver). Por eso las pestañas no son los estados tal cual.
// ──────────────────────────────────────────────────────────────────────────

import type { CatalogoItemFalla, Falla } from '~/features/fallas/types'
import { EstadoFallaCodigo, GrupoEstadoFalla } from '~/features/fallas/types'

/** Un grupo concreto: todos menos `TODAS`, que no agrupa nada. */
export type GrupoEstadoConcreto = Exclude<GrupoEstadoFalla, GrupoEstadoFalla.TODAS>

const GRUPO_POR_ESTADO: Record<EstadoFallaCodigo, GrupoEstadoConcreto> = {
  [EstadoFallaCodigo.ABIERTA]: GrupoEstadoFalla.ABIERTA,
  [EstadoFallaCodigo.SIN_SOLUCION]: GrupoEstadoFalla.ABIERTA,
  [EstadoFallaCodigo.EN_GESTION]: GrupoEstadoFalla.EN_GESTION,
  [EstadoFallaCodigo.EN_ESPERA]: GrupoEstadoFalla.EN_GESTION,
  [EstadoFallaCodigo.PROGRAMADO]: GrupoEstadoFalla.PROGRAMADO,
  [EstadoFallaCodigo.CERRADA]: GrupoEstadoFalla.CERRADA,
}

function esCodigoConocido(codigo: string): codigo is EstadoFallaCodigo {
  return codigo in GRUPO_POR_ESTADO
}

/**
 * La pestaña a la que pertenece una falla.
 *
 * Un estado que no está en el catálogo conocido (uno nuevo en el backend, o
 * una falla sin estado) no se pierde: cae en Cerrada si es final y en Abierta
 * si no, que es lo que el equipo tiene que mirar.
 */
export function grupoEstadoFalla(falla: Pick<Falla, 'estado'>): GrupoEstadoConcreto {
  const codigo = falla.estado?.codigo
  if (codigo && esCodigoConocido(codigo)) return GRUPO_POR_ESTADO[codigo]
  return falla.estado?.es_estado_final ? GrupoEstadoFalla.CERRADA : GrupoEstadoFalla.ABIERTA
}

export function perteneceAGrupo(falla: Pick<Falla, 'estado'>, grupo: GrupoEstadoFalla): boolean {
  return grupo === GrupoEstadoFalla.TODAS || grupoEstadoFalla(falla) === grupo
}

export function esGrupoEstadoFalla(valor: unknown): valor is GrupoEstadoFalla {
  return Object.values(GrupoEstadoFalla).includes(valor as GrupoEstadoFalla)
}

/** "En espera" se nombra "En gestión" (decisión de Operaciones, 2026-10-13). */
const ETIQUETA_POR_ESTADO: Partial<Record<EstadoFallaCodigo, string>> = {
  [EstadoFallaCodigo.EN_ESPERA]: 'En gestión',
}

/** Estados que ya no se ofrecen al elegir: las fallas viejas los conservan. */
const ESTADOS_NO_SELECCIONABLES = new Set<string>([EstadoFallaCodigo.EN_ESPERA])

/** La etiqueta con que se muestra un estado, aplicando los renombres del equipo. */
export function etiquetaEstado(estado: Pick<CatalogoItemFalla, 'codigo' | 'etiqueta'> | null | undefined): string {
  if (!estado) return '—'
  const codigo = estado.codigo
  const renombre = codigo && esCodigoConocido(codigo) ? ETIQUETA_POR_ESTADO[codigo] : undefined
  return renombre ?? estado.etiqueta ?? '—'
}

/**
 * Los estados que se pueden elegir en un selector. `actualId` se conserva
 * aunque no sea seleccionable, para que una falla vieja no quede con el
 * selector en blanco.
 */
export function estadosSeleccionables(
  estados: CatalogoItemFalla[],
  actualId?: number | null,
): CatalogoItemFalla[] {
  return estados.filter(
    (e) => e.id === actualId || !ESTADOS_NO_SELECCIONABLES.has(e.codigo ?? ''),
  )
}
