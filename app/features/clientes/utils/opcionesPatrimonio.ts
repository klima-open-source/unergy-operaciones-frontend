import type { PatrimonioGeneral } from '~/features/clientes/types'

/**
 * Las opciones del selector "A través de patrimonio": cada fiduciaria y, debajo,
 * sus patrimonios con la fiduciaria delante, para que se distingan los de dos
 * fiduciarias distintas. `value` es el id en texto, como lo pide el `Select`.
 */
export function opcionesPatrimonio(generales: PatrimonioGeneral[]) {
  return generales.flatMap((g) => [
    { value: String(g.id), label: g.nombre },
    ...g.subpatrimonios.map((sub) => ({
      value: String(sub.id),
      label: `${g.nombre} › ${sub.codigo ? `${sub.codigo} ` : ''}${sub.nombre}`,
    })),
  ])
}
