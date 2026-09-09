import { describe, expect, it } from 'vitest'
import { entraEnConfiguracion } from './proyectosLiquidaciones'

// El filtro era una lista blanca de tipos: ['gd', 'minigranja']. Escondía
// proyectos que sí hay que configurar, y de dos formas distintas:
//
//   · AGGE Extractora Monterrey — en operación, pero con `tipo_proyecto` NULL
//     (el único de la base así), porque su tipo real, biomasa, no existe entre
//     las opciones del modelo. La lista blanca lo dejaba fuera.
//   · cualquier proyecto marcado 'otro' o 'movilidad_electrica'.
//
// La regla de negocio es al revés: entra todo lo que esté en operación salvo
// autoconsumo, que se liquida por otra vía.
describe('entraEnConfiguracion', () => {
  const enOperacion = (tipo: string | null) => ({ tipo_proyecto: tipo, estado: 'en_operacion' })

  it('deja fuera autoconsumo, que es la única exclusión por tipo', () => {
    expect(entraEnConfiguracion(enOperacion('autoconsumo'))).toBe(false)
  })

  it('admite cualquier otro tipo, incluidos los que la lista blanca escondía', () => {
    for (const tipo of ['gd', 'minigranja', 'otro', 'movilidad_electrica']) {
      expect(entraEnConfiguracion(enOperacion(tipo))).toBe(true)
    }
  })

  it('admite el tipo vacío: es el caso de AGGE Extractora Monterrey', () => {
    expect(entraEnConfiguracion(enOperacion(null))).toBe(true)
    expect(entraEnConfiguracion(enOperacion(undefined as unknown as null))).toBe(true)
  })

  it('sigue exigiendo que esté en operación', () => {
    expect(entraEnConfiguracion({ tipo_proyecto: 'gd', estado: 'en_desarrollo' })).toBe(false)
    expect(entraEnConfiguracion({ tipo_proyecto: 'gd', estado: 'cancelado' })).toBe(false)
  })
})
