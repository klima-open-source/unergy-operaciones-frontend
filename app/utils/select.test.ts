import { describe, expect, it } from 'vitest'
import { VALOR_SELECT_VACIO, aValorSelect, deValorSelect } from './select'

describe('valor de Select con opción vacía', () => {
  it('el centinela nunca es un string vacío (Reka UI lo rechaza)', () => {
    expect(VALOR_SELECT_VACIO).not.toBe('')
  })

  it('el estado vacío se muestra como centinela y vuelve a vacío', () => {
    expect(aValorSelect('')).toBe(VALOR_SELECT_VACIO)
    expect(aValorSelect(null)).toBe(VALOR_SELECT_VACIO)
    expect(aValorSelect(undefined)).toBe(VALOR_SELECT_VACIO)
    expect(deValorSelect(VALOR_SELECT_VACIO)).toBe('')
  })

  it('un valor real pasa intacto en ambos sentidos', () => {
    expect(aValorSelect('mensual')).toBe('mensual')
    expect(deValorSelect('mensual')).toBe('mensual')
    expect(deValorSelect(3)).toBe('3')
  })
})
