import { describe, expect, it } from 'vitest'

import { iso, rangoDelMes } from './rangoMes'

describe('iso', () => {
  it('usa la fecha local, no la de UTC', () => {
    // En Colombia (UTC-5) esto es el 1 de septiembre a las 00:00 local, que en
    // UTC ya es el 1 a las 05:00 -- pero a las 00:00 del día 1 hora local,
    // `toISOString()` daría "2026-08-31". Ese corrimiento dejaría el día 1
    // fuera del rango pedido.
    const medianoche = new Date(2026, 8, 1, 0, 0, 0)
    expect(iso(medianoche)).toBe('2026-09-01')
  })

  it('rellena mes y dia con cero', () => {
    expect(iso(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('rangoDelMes', () => {
  it('va del primero al ultimo dia del mes', () => {
    expect(rangoDelMes(new Date(2026, 8, 1))).toEqual({
      desde: '2026-09-01',
      hasta: '2026-09-30',
    })
  })

  it('acierta el ultimo dia de un mes de 31', () => {
    expect(rangoDelMes(new Date(2026, 0, 1)).hasta).toBe('2026-01-31')
  })

  it('acierta febrero en un año normal', () => {
    expect(rangoDelMes(new Date(2026, 1, 1)).hasta).toBe('2026-02-28')
  })

  it('acierta febrero en un año bisiesto', () => {
    expect(rangoDelMes(new Date(2028, 1, 1)).hasta).toBe('2028-02-29')
  })

  it('no depende del dia que traiga la fecha, solo del mes', () => {
    expect(rangoDelMes(new Date(2026, 8, 17))).toEqual(rangoDelMes(new Date(2026, 8, 1)))
  })

  it('diciembre no se pasa al año siguiente', () => {
    expect(rangoDelMes(new Date(2026, 11, 1))).toEqual({
      desde: '2026-12-01',
      hasta: '2026-12-31',
    })
  })
})
