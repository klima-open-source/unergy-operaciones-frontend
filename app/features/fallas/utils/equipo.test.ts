import { describe, expect, it } from 'vitest'

import { EquipoFalla } from '~/features/fallas/types'
import { EQUIPOS_FALLA, esEquipoFalla, etiquetaEquipo } from './equipo'

describe('etiquetaEquipo', () => {
  it('traduce cada equipo', () => {
    expect(etiquetaEquipo(EquipoFalla.INVERSOR)).toBe('Inversor')
    expect(etiquetaEquipo(EquipoFalla.ESTACION_METEOROLOGICA)).toBe('Estación meteorológica')
  })

  it('todos los equipos tienen etiqueta', () => {
    for (const e of EQUIPOS_FALLA) expect(etiquetaEquipo(e)).not.toBe('—')
    expect(EQUIPOS_FALLA).toHaveLength(6)
  })

  it('sin equipo o con un código desconocido muestra un guion', () => {
    expect(etiquetaEquipo(null)).toBe('—')
    expect(etiquetaEquipo(undefined)).toBe('—')
    expect(etiquetaEquipo('transformador')).toBe('—')
  })
})

describe('esEquipoFalla', () => {
  it('reconoce solo los códigos del enum', () => {
    expect(esEquipoFalla('tracker')).toBe(true)
    expect(esEquipoFalla('Tracker')).toBe(false)
    expect(esEquipoFalla(3)).toBe(false)
  })
})
