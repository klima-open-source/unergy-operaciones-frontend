// ──────────────────────────────────────────────────────────────────────────
// Pestañas de estado de la lista de fallas.
//
// Operaciones no trabaja con los seis estados del catálogo sino con cuatro
// grupos: "en espera" se gestiona igual que "en gestión", y una falla "sin
// solución" sigue abierta para el equipo (no se dio por cerrada, se dejó de
// poder resolver). Por eso las pestañas no son los estados tal cual.
// ──────────────────────────────────────────────────────────────────────────

import type { Falla } from '~/features/fallas/types'
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
