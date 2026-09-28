import { describe, expect, it } from 'vitest'
import { viernesDeEstaSemana } from './formatters'

describe('viernesDeEstaSemana', () => {
  it('un lunes avanza hasta el viernes de la misma semana', () => {
    const lunes = new Date(2026, 5, 8) // 2026-06-08 es lunes
    expect(viernesDeEstaSemana(lunes)).toEqual(new Date(2026, 5, 12))
  })

  it('el propio viernes se queda igual', () => {
    const viernes = new Date(2026, 5, 12)
    expect(viernesDeEstaSemana(viernes)).toEqual(new Date(2026, 5, 12))
  })

  it('un sábado retrocede al viernes anterior', () => {
    const sabado = new Date(2026, 5, 13)
    expect(viernesDeEstaSemana(sabado)).toEqual(new Date(2026, 5, 12))
  })

  it('un domingo avanza al viernes siguiente (la semana de JS empieza en domingo)', () => {
    const domingo = new Date(2026, 5, 14)
    expect(viernesDeEstaSemana(domingo)).toEqual(new Date(2026, 5, 19))
  })
})
