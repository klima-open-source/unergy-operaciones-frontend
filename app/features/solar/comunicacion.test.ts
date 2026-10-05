import { describe, expect, it } from 'vitest'
import {
  avisosConsultas,
  detalleComunicacion,
  fuentesSinComunicacion,
  haceDesde,
  nivelComunicacion,
} from './comunicacion'

const AHORA = new Date('2026-10-05T14:00:00-05:00')
const bien = { sin_comunicacion: false, ultimo_dato: '2026-10-05T13:45:00-05:00' }
const caida = { sin_comunicacion: true, ultimo_dato: null }

describe('nivel de comunicación', () => {
  it('sin evaluar mientras el sondeo no ha corrido', () => {
    expect(nivelComunicacion(null)).toBe('evaluando')
    expect(nivelComunicacion({})).toBe('evaluando')
  })

  it('una fuente caída es parcial; todas las que tiene, ninguna', () => {
    // Puya, 2026-10-05: inversores sin un dato, medidor al día.
    expect(nivelComunicacion({ inversores: caida, medidor: bien })).toBe('parcial')
    expect(nivelComunicacion({ inversores: caida, medidor: caida })).toBe('ninguna')
    expect(nivelComunicacion({ inversores: bien, medidor: bien })).toBe('ok')
  })

  it('una planta sin medidor solo cuenta sus inversores', () => {
    expect(nivelComunicacion({ inversores: caida, medidor: null })).toBe('ninguna')
    expect(nivelComunicacion({ inversores: bien, medidor: null })).toBe('ok')
  })

  it('lista las fuentes caídas en orden fijo', () => {
    expect(fuentesSinComunicacion({ medidor: caida, inversores: caida })).toEqual([
      'inversores',
      'medidor',
    ])
    expect(fuentesSinComunicacion({ inversores: bien, medidor: null })).toEqual([])
  })
})

describe('textos', () => {
  it('dice hace cuánto llegó cada dato', () => {
    expect(haceDesde('2026-10-05T13:40:00-05:00', AHORA)).toBe('hace 20 min')
    expect(haceDesde('2026-10-05T10:30:00-05:00', AHORA)).toBe('hace 3 h')
    expect(haceDesde(null, AHORA)).toBe('')
    expect(detalleComunicacion({ inversores: caida, medidor: bien }, AHORA)).toBe(
      'Inversores: sin datos hoy · Medidor: último dato hace 15 min',
    )
    expect(detalleComunicacion({ inversores: bien, medidor: null }, AHORA)).toBe(
      'Inversores: último dato hace 15 min · Medidor: no tiene',
    )
  })

  it('avisa solo de los servicios cuya última consulta falló', () => {
    expect(
      avisosConsultas(
        {
          inversores: { fallo: true, consultado_en: '2026-10-05T13:40:00-05:00' },
          medidor: { fallo: false, consultado_en: '2026-10-05T13:40:00-05:00' },
        },
        AHORA,
      ),
    ).toEqual(['⚠ SolarView no respondió en la última consulta (hace 20 min).'])
    expect(avisosConsultas(null, AHORA)).toEqual([])
  })
})
