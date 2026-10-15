// ──────────────────────────────────────────────────────────────────────────
// Pestaña Pendientes de Gestión de Fallas.
//
// Qué es pendiente lo decide el backend (`Falla.en_pendientes`: sin cerrar, y
// en garantía o de tracker/string/medidor/estación). Acá solo se ordena —por
// proyecto, y dentro de cada proyecto de la identificada más reciente a la más
// antigua— y se aplican los filtros rápidos de la pestaña.
// ──────────────────────────────────────────────────────────────────────────

import type { EquipoFalla, Falla } from '~/features/fallas/types'
import { compararTextoDesc } from '~/features/fallas/utils/ordenFallas'

type FallaPendiente = Pick<
  Falla,
  'en_pendientes' | 'equipo' | 'en_garantia' | 'proyecto' | 'fecha_identificacion'
>

export interface FiltrosPendientes {
  /** Solo las de este equipo; `null` = todos. */
  equipo?: EquipoFalla | null
  soloGarantia?: boolean
}

export function esPendiente(falla: Pick<Falla, 'en_pendientes'>): boolean {
  return falla.en_pendientes === true
}

function compararPendientes(a: FallaPendiente, b: FallaPendiente): number {
  return (
    (a.proyecto?.nombre_comercial ?? '').localeCompare(b.proyecto?.nombre_comercial ?? '', 'es') ||
    compararTextoDesc(a.fecha_identificacion?.slice(0, 10), b.fecha_identificacion?.slice(0, 10))
  )
}

/** Las fallas marcadas como pendientes, ordenadas. No altera la lista recibida. */
export function fallasPendientes<T extends FallaPendiente>(fallas: readonly T[]): T[] {
  return fallas.filter(esPendiente).sort(compararPendientes)
}

/** Si una pendiente pasa los filtros rápidos de la pestaña (no reordena nada). */
export function cumpleFiltrosPendientes(
  falla: FallaPendiente,
  { equipo = null, soloGarantia = false }: FiltrosPendientes,
): boolean {
  return (!equipo || falla.equipo === equipo) && (!soloGarantia || falla.en_garantia === true)
}
