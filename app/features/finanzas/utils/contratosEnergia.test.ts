import { describe, expect, it } from 'vitest'
import { PORCENTAJE_COMPLETO, porcentajeSugerido } from './contratosEnergia'

// El formulario ocultaba el porcentaje salvo en PLG, siguiendo la guía de la
// API («percentage: opcional, fracción 0–1. Solo PLG»). Pero los 107 contratos
// que existen dicen otra cosa:
//
//   no_contract            21 de 21 lo llevan, siempre 1.0
//   ppa_pay_as_contracted   3 de  9,          siempre 1.0
//   ppa_pay_as_generated   77 de 77, y ahí sí varía: 0.2, 0.5, 0.8, 1.0
//
// O sea: en PLG es un dato de negocio, y en el resto es 1.0 — que es además lo
// que la API asigna sola cuando se omite (el contrato 130 salió con 1.0 sin
// haberlo enviado). Se muestra siempre, y fuera de PLG se sugiere 1.0 en vez de
// dejarlo vacío, para que coincida con lo que va a quedar guardado.
describe('porcentajeSugerido', () => {
  it('en PLG no sugiere nada: ahí el valor es una decisión de negocio', () => {
    expect(porcentajeSugerido('ppa_pay_as_generated')).toBeNull()
  })

  it('en los demás tipos sugiere 1.0, que es lo que la API asigna sola', () => {
    expect(porcentajeSugerido('no_contract')).toBe(PORCENTAJE_COMPLETO)
    expect(porcentajeSugerido('ppa_pay_as_contracted')).toBe(PORCENTAJE_COMPLETO)
  })

  it('sin tipo elegido todavía, no sugiere nada', () => {
    expect(porcentajeSugerido(null)).toBeNull()
    expect(porcentajeSugerido('')).toBeNull()
  })

  it('el completo es 1, no 100: la API lo quiere como fracción', () => {
    expect(PORCENTAJE_COMPLETO).toBe(1)
  })
})
