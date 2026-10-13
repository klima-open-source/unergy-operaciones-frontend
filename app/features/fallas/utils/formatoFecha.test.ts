import { describe, expect, it } from 'vitest'

import { formatoFechaDia } from './formatoFecha'

describe('formatoFechaDia', () => {
  it('no corre el día por la zona horaria', () => {
    expect(formatoFechaDia('2026-10-13')).toContain('13')
    expect(formatoFechaDia('2026-10-13T23:30:00-05:00')).toContain('13')
  })

  it('vacío o inválido muestra un guion', () => {
    expect(formatoFechaDia(null)).toBe('—')
    expect(formatoFechaDia('')).toBe('—')
    expect(formatoFechaDia('no-es-fecha')).toBe('—')
  })
})
