import { describe, expect, it } from 'vitest'

import { formatoEnergia, formatoPctAfectado } from './formatoImpacto'

describe('formatoEnergia', () => {
  it('debajo de 1.000 kWh va en kWh con un decimal', () => {
    expect(formatoEnergia(12.34)).toBe('12,3 kWh')
    expect(formatoEnergia(0)).toBe('0,0 kWh')
    expect(formatoEnergia(999.94)).toBe('999,9 kWh')
  })

  it('desde 1.000 kWh pasa a MWh con dos decimales', () => {
    expect(formatoEnergia(1000)).toBe('1,00 MWh')
    expect(formatoEnergia(1234.5)).toBe('1,23 MWh')
    expect(formatoEnergia(15678)).toBe('15,68 MWh')
  })

  it('sin dato muestra una raya', () => {
    expect(formatoEnergia(null)).toBe('—')
    expect(formatoEnergia(undefined)).toBe('—')
  })
})

describe('formatoPctAfectado', () => {
  it('muestra el porcentaje con a lo sumo un decimal', () => {
    expect(formatoPctAfectado(66)).toBe('66 %')
    expect(formatoPctAfectado(33.333)).toBe('33,3 %')
  })

  it('sin dato muestra una raya', () => {
    expect(formatoPctAfectado(null)).toBe('—')
  })
})
