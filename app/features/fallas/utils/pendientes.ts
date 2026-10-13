// ──────────────────────────────────────────────────────────────────────────
// Pestaña Pendientes de Gestión de Fallas.
//
// Qué es pendiente lo decide el backend (`Falla.en_pendientes`: sin cerrar, y
// en garantía o de tracker/string/medidor/estación). Acá solo se filtra por
// los filtros rápidos de la pestaña y se ordena: por proyecto, y dentro de
// cada proyecto de la identificada más reciente a la más antigua.
// ──────────────────────────────────────────────────────────────────────────

import type { EquipoFalla, Falla } from '~/features/fallas/types'

type FallaPendiente = Pick<
  Falla,
  'en_pendientes' | 'equipo' | 'en_garantia' | 'proyecto' | 'fecha_identificacion'
>

export interface FiltrosPendientes {
  /** Solo las de este equipo; `null` = todos. */
  equipo?: EquipoFalla | null
  soloGarantia?: boolean
}

function compararPendientes(a: FallaPendiente, b: FallaPendiente): number {
  const porProyecto = (a.proyecto?.nombre_comercial ?? '').localeCompare(
    b.proyecto?.nombre_comercial ?? '',
    'es',
  )
  if (porProyecto) return porProyecto
  // `YYYY-MM-DD` ordena como texto; las que no tienen fecha van al final.
  const fa = a.fecha_identificacion?.slice(0, 10) ?? ''
  const fb = b.fecha_identificacion?.slice(0, 10) ?? ''
  if (fa === fb) return 0
  if (!fa) return 1
  if (!fb) return -1
  return fa < fb ? 1 : -1
}

/** Las fallas marcadas como pendientes, con los filtros rápidos aplicados y ordenadas. */
export function fallasPendientes<T extends FallaPendiente>(
  fallas: readonly T[],
  { equipo = null, soloGarantia = false }: FiltrosPendientes = {},
): T[] {
  return fallas
    .filter(
      (f) =>
        f.en_pendientes === true &&
        (!equipo || f.equipo === equipo) &&
        (!soloGarantia || f.en_garantia === true),
    )
    .sort(compararPendientes)
}
