/**
 * `hoyColombia` — la fecha de hoy en Bogotá.
 *
 * `new Date().toISOString().slice(0, 10)` da la fecha en UTC, y Colombia es
 * UTC−5: entre las 19:00 y la medianoche de Bogotá el servidor ya está en el
 * día siguiente. En la ficha de Representación eso adelantaba un día la
 * indexación — la víspera del aniversario ya mostraba la tarifa nueva.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { hoyColombia, msHastaMedianocheColombia } from './fecha'

afterEach(() => {
  vi.useRealTimers()
})

function enBogota(iso: string) {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(iso))
}

describe('hoyColombia', () => {
  it('a las 20:00 de Bogotá sigue siendo el mismo día', () => {
    // 2026-12-22T01:00Z son las 20:00 del 21-dic en Bogotá.
    enBogota('2026-12-22T01:00:00Z')
    expect(hoyColombia()).toBe('2026-12-21')
  })

  it('cambia de día a la medianoche de Bogotá, no a la de UTC', () => {
    enBogota('2026-12-22T04:59:00Z') // 23:59 del 21-dic en Bogotá
    expect(hoyColombia()).toBe('2026-12-21')

    enBogota('2026-12-22T05:01:00Z') // 00:01 del 22-dic en Bogotá
    expect(hoyColombia()).toBe('2026-12-22')
  })

  it('a media mañana coincide con la fecha UTC', () => {
    enBogota('2026-09-10T15:00:00Z') // 10:00 en Bogotá
    expect(hoyColombia()).toBe('2026-09-10')
  })

  it('devuelve el formato YYYY-MM-DD', () => {
    enBogota('2026-09-10T15:00:00Z')
    expect(hoyColombia()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('msHastaMedianocheColombia', () => {
  it('a las 23:59 de Bogotá falta un minuto', () => {
    // 04:59Z = 23:59 en Bogotá.
    expect(msHastaMedianocheColombia(Date.parse('2026-12-22T04:59:00Z'))).toBe(60_000)
  })

  it('justo a la medianoche de Bogotá falta un día entero', () => {
    expect(msHastaMedianocheColombia(Date.parse('2026-12-22T05:00:00Z'))).toBe(86_400_000)
  })

  it('a la medianoche de UTC (19:00 en Bogotá) faltan cinco horas', () => {
    expect(msHastaMedianocheColombia(Date.parse('2026-12-22T00:00:00Z'))).toBe(5 * 3_600_000)
  })
})
