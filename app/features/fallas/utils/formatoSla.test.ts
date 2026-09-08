import { describe, expect, it } from 'vitest'

import { formatoLimiteSla } from './formatoSla'

describe('formatoLimiteSla', () => {
  it('no muestra "(0 días)" en los límites de menos de un día', () => {
    // El bug: una crítica de 8 h se veía "8h (0d)" porque el backend manda la
    // división entera por 24 y la vista la imprimía tal cual.
    expect(formatoLimiteSla(8)).toBe('8 h')
    expect(formatoLimiteSla(4)).toBe('4 h')
    expect(formatoLimiteSla(23)).toBe('23 h')
  })

  it('los cuatro límites por defecto de prioridad', () => {
    expect(formatoLimiteSla(8)).toBe('8 h')            // crítica
    expect(formatoLimiteSla(24)).toBe('24 h (1 día)')  // grave
    expect(formatoLimiteSla(72)).toBe('72 h (3 días)') // media
    expect(formatoLimiteSla(168)).toBe('168 h (7 días)') // leve
  })

  it('un día va en singular', () => {
    expect(formatoLimiteSla(24)).toBe('24 h (1 día)')
  })

  it('no trunca los límites personalizados que no caen en días enteros', () => {
    // Antes "36h (1d)": día y medio truncado a uno.
    expect(formatoLimiteSla(36)).toBe('36 h (1,5 días)')
    expect(formatoLimiteSla(30)).toBe('30 h (1,3 días)')
  })

  it('sin límite util devuelve un texto, no "NaN"', () => {
    expect(formatoLimiteSla(null)).toBe('Sin límite')
    expect(formatoLimiteSla(undefined)).toBe('Sin límite')
    expect(formatoLimiteSla(0)).toBe('Sin límite')
    expect(formatoLimiteSla(-5)).toBe('Sin límite')
  })
})
