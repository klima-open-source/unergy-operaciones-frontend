import { describe, expect, it } from 'vitest'

import { calcSla } from './slaContractual'

const cerrada = { codigo: 'cerrada' }
const abierta = { codigo: 'abierta' }

describe('calcSla — días abiertos', () => {
  it('usa dias_abierta del backend, que ya mira fecha_resolucion', () => {
    // El bug: se calculaba `Date.now() - fecha_identificacion`, asi que una
    // falla cerrada en 1 dia pero identificada hace 3 meses imprimia "90d" en
    // la columna "DIAS ABIERTA" del informe que se le manda al cliente.
    const r = calcSla({
      fecha_identificacion: '2026-06-01',
      dias_abierta: 1,
      estado: cerrada,
      clasificacion: { categoria: 'red' },
    })
    expect(r.dias).toBe(1)
  })

  it('sin fecha de identificación no inventa días', () => {
    expect(calcSla({ fecha_identificacion: null, dias_abierta: 40 }).dias).toBe(0)
  })

  it('tolera dias_abierta nulo sin reventar', () => {
    expect(calcSla({ fecha_identificacion: '2026-09-01', dias_abierta: null }).dias).toBe(0)
  })

  it('nunca devuelve días negativos', () => {
    expect(calcSla({ fecha_identificacion: '2026-09-01', dias_abierta: -5 }).dias).toBe(0)
  })
})

describe('calcSla — umbral por categoría', () => {
  it('red es crítico a los 2 días', () => {
    const r = calcSla({
      fecha_identificacion: '2026-09-01',
      dias_abierta: 0,
      clasificacion: { categoria: 'red' },
    })
    expect(r.slaRevision).toBe(2)
    expect(r.slaLabel).toBe('Crítico (≥90%)')
  })

  it.each(['frontera', 'inversores', 'generando_sin_datos'])('%s es grave a los 3 días', (categoria) => {
    const r = calcSla({
      fecha_identificacion: '2026-09-01',
      dias_abierta: 0,
      clasificacion: { categoria },
    })
    expect(r.slaRevision).toBe(3)
  })

  it('eventos_adversos es medio a los 4 días', () => {
    const r = calcSla({
      fecha_identificacion: '2026-09-01',
      dias_abierta: 0,
      clasificacion: { categoria: 'eventos_adversos' },
    })
    expect(r.slaRevision).toBe(4)
  })

  it('sin clasificación cae al primer dígito de tipo.codigo (fallas legacy)', () => {
    const grave = calcSla({
      fecha_identificacion: '2026-09-01', dias_abierta: 0, tipo: { codigo: '1.2' },
    })
    expect(grave.slaRevision).toBe(3)

    const medio = calcSla({
      fecha_identificacion: '2026-09-01', dias_abierta: 0, tipo: { codigo: '4.1' },
    })
    expect(medio.slaRevision).toBe(4)

    const critico = calcSla({
      fecha_identificacion: '2026-09-01', dias_abierta: 0, tipo: { codigo: '2.7' },
    })
    expect(critico.slaRevision).toBe(2)
  })
})

describe('calcSla — cumplimiento', () => {
  it('una abierta dentro del umbral cumple', () => {
    const r = calcSla({
      fecha_identificacion: '2026-09-01', dias_abierta: 2, estado: abierta,
      clasificacion: { categoria: 'red' },
    })
    expect(r.cumple).toBe(true)
  })

  it('una abierta pasada del umbral no cumple', () => {
    const r = calcSla({
      fecha_identificacion: '2026-09-01', dias_abierta: 3, estado: abierta,
      clasificacion: { categoria: 'red' },
    })
    expect(r.cumple).toBe(false)
  })

  it('una cerrada cumple SIEMPRE, aunque se haya cerrado tarde', () => {
    // Se conserva la regla que venia del contrato: el informe no reporta
    // incumplimiento en incidentes ya cerrados. Cambiarla es decision de
    // negocio, no de implementacion -- este test la fija para que no se mueva
    // por accidente.
    const r = calcSla({
      fecha_identificacion: '2026-09-01', dias_abierta: 90, estado: cerrada,
      clasificacion: { categoria: 'red' },
    })
    expect(r.cumple).toBe(true)
  })
})
