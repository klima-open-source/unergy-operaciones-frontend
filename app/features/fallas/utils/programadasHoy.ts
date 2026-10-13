// Fallas programadas para hoy: el aviso de arriba de Gestión de Fallas. Es el
// mismo criterio de la tarea diaria del backend que deja el aviso en la campana
// (`monitoreo.avisar_fallas_programadas`): sin cerrar, en estado programado y
// con la fecha programada igual a hoy en Colombia.

import type { Falla } from '~/features/fallas/types'
import { EstadoFallaCodigo } from '~/features/fallas/types'

type FallaProgramable = Pick<Falla, 'estado' | 'fecha_programada' | 'proyecto' | 'codigo_interno'>

/**
 * @param hoy `YYYY-MM-DD` en hora de Colombia (`hoyColombia()` de `~/utils/fecha`).
 *            Se recibe para que la función sea pura y se pueda probar.
 */
export function fallasProgramadasHoy<T extends FallaProgramable>(
  fallas: readonly T[],
  hoy: string,
): T[] {
  return fallas
    .filter(
      (f) =>
        !f.estado?.es_estado_final &&
        f.estado?.codigo === EstadoFallaCodigo.PROGRAMADO &&
        f.fecha_programada?.slice(0, 10) === hoy,
    )
    .sort(
      (a, b) =>
        (a.proyecto?.nombre_comercial ?? '').localeCompare(b.proyecto?.nombre_comercial ?? '', 'es') ||
        (a.codigo_interno ?? '').localeCompare(b.codigo_interno ?? ''),
    )
}
