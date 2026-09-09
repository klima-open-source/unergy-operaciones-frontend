/**
 * Qué proyectos hay que configurar para liquidaciones.
 *
 * La regla es por EXCLUSIÓN, no por lista blanca: entra todo lo que esté en
 * operación salvo autoconsumo, que se liquida por otra vía.
 *
 * Antes era `['gd', 'minigranja'].includes(tipo)`, y eso escondía proyectos que
 * sí hay que configurar. El caso que lo destapó fue **AGGE Extractora
 * Monterrey**: en operación, pero con `tipo_proyecto` NULL —el único de la base
 * así— porque su tipo real, biomasa, no está entre las opciones del modelo
 * (`minigranja`, `autoconsumo`, `gd`, `movilidad_electrica`, `otro`). Con la
 * lista blanca era invisible, y no había forma de llegar a él desde la pantalla.
 */

/** Lo mínimo que hace falta para decidir; el registro real trae mucho más. */
interface ProyectoLiquidaciones {
  tipo_proyecto?: string | null
  estado?: string | null
}

/** El único tipo que no se configura acá: se liquida por otra vía. */
export const TIPO_EXCLUIDO = 'autoconsumo'

export const ESTADO_OPERATIVA = 'en_operacion'

export function entraEnConfiguracion(p: ProyectoLiquidaciones): boolean {
  return p.estado === ESTADO_OPERATIVA && p.tipo_proyecto !== TIPO_EXCLUIDO
}
