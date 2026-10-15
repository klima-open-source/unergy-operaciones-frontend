// ──────────────────────────────────────────────────────────────────────────
// Orden de la lista de fallas: de la más reciente a la más antigua.
//
// Manda la fecha de identificación (es la que el equipo reconoce: "la del
// martes"). Dentro del mismo día, la hora de identificación; y si tampoco
// hay hora, cuándo se registró. Lo que no tiene fecha va al final.
// ──────────────────────────────────────────────────────────────────────────

import type { Falla } from '~/features/fallas/types'

type FallaOrdenable = Pick<Falla, 'fecha_identificacion' | 'hora_identificacion' | 'created_at'>

/** Descendente, con los vacíos al final. Las fechas `YYYY-MM-DD` y horas `HH:MM[:SS]` ordenan como texto. */
export function compararTextoDesc(a: string | null | undefined, b: string | null | undefined): number {
  if (a === b) return 0
  if (!a) return 1
  if (!b) return -1
  return a < b ? 1 : -1
}

/** `created_at` trae zona horaria: se compara como instante, no como texto. */
function compararInstanteDesc(a: string | null | undefined, b: string | null | undefined): number {
  const ta = a ? Date.parse(a) : Number.NaN
  const tb = b ? Date.parse(b) : Number.NaN
  if (Number.isNaN(ta) && Number.isNaN(tb)) return 0
  if (Number.isNaN(ta)) return 1
  if (Number.isNaN(tb)) return -1
  return tb - ta
}

export function compararFallasRecientes(a: FallaOrdenable, b: FallaOrdenable): number {
  return (
    compararTextoDesc(a.fecha_identificacion?.slice(0, 10), b.fecha_identificacion?.slice(0, 10)) ||
    compararTextoDesc(a.hora_identificacion, b.hora_identificacion) ||
    compararInstanteDesc(a.created_at, b.created_at)
  )
}
