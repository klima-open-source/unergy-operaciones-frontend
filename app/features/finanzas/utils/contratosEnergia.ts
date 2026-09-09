/**
 * Reglas del formulario de contratos de energía.
 *
 * El `percentage` de la API es una **fracción 0–1**, no un porcentaje. La guía
 * lo documenta como «solo PLG», pero los contratos que existen dicen que lo
 * llevan todos: los 21 `no_contract` y 3 de los 9 PLC, siempre en 1.0, y los 77
 * PLG con valores que sí varían (0.2, 0.5, 0.8, 1.0).
 *
 * Y la API lo asigna sola cuando se omite: el contrato 130 se creó sin mandarlo
 * y quedó en 1.0. Por eso el campo se muestra siempre —antes estaba oculto
 * fuera de PLG y no había forma de verlo— y fuera de PLG se sugiere 1.0, que es
 * lo que va a quedar guardado de todos modos.
 */

/** Todo el despacho. La API lo quiere como fracción: 1, no 100. */
export const PORCENTAJE_COMPLETO = 1

/** PLG (pay-as-generated): el único tipo donde el porcentaje es una decisión. */
const PLG = 'ppa_pay_as_generated'

/**
 * Qué porcentaje proponer al elegir un tipo de contrato.
 * @returns `null` cuando no hay nada que sugerir y lo decide quien llena.
 */
export function porcentajeSugerido(tipoContrato: string | null | undefined): number | null {
  if (!tipoContrato || tipoContrato === PLG) return null
  return PORCENTAJE_COMPLETO
}
