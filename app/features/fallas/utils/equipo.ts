// Etiquetas del equipo afectado por una falla (`Falla.equipo`). El backend
// manda el código; acá vive la única traducción a texto de la plataforma.

import { EquipoFalla } from '~/features/fallas/types'

export const ETIQUETA_EQUIPO: Record<EquipoFalla, string> = {
  [EquipoFalla.INVERSOR]: 'Inversor',
  [EquipoFalla.SMARTLOGGER]: 'Smartlogger',
  [EquipoFalla.TRACKER]: 'Tracker',
  [EquipoFalla.STRING]: 'String',
  [EquipoFalla.MEDIDOR]: 'Medidor',
  [EquipoFalla.ESTACION_METEOROLOGICA]: 'Estación meteorológica',
}

/** Los equipos en el orden en que se ofrecen en un filtro. */
export const EQUIPOS_FALLA: EquipoFalla[] = Object.values(EquipoFalla)

export function esEquipoFalla(valor: unknown): valor is EquipoFalla {
  return EQUIPOS_FALLA.includes(valor as EquipoFalla)
}

/** La etiqueta del equipo; `'—'` si la falla no es de un equipo (o el código es desconocido). */
export function etiquetaEquipo(equipo: string | null | undefined): string {
  return esEquipoFalla(equipo) ? ETIQUETA_EQUIPO[equipo] : '—'
}
