/**
 * Filtros de Verificación de costos.
 *
 * Lo que fijan estas pruebas es el tercer estado: `from_generator` y
 * `from_commercializer` pueden ser `true`, `false` o `null`, y ese `null` NO es
 * un "no" — es un proyecto que no cruza con la API de Liquidaciones. Si cayera
 * en "sin costos", la vista afirmaría que no cobra un proyecto que en realidad
 * no se pudo consultar.
 */
import { describe, expect, it } from 'vitest'
import type { FilaVerificacion, FiltrosVerificacion } from './verificacionCostos'
import { FiltroCostos, filtrarVerificacion, hayFiltros } from './verificacionCostos'

const FILAS: FilaVerificacion[] = [
  { nombre_comercial: 'Bayunca', from_generator: true, from_commercializer: true },
  { nombre_comercial: 'Sirius', from_generator: true, from_commercializer: false },
  { nombre_comercial: 'San Onofre', from_generator: false, from_commercializer: false },
  { nombre_comercial: 'Chima Oriente', from_generator: null, from_commercializer: null },
]

const sinFiltros = (): FiltrosVerificacion => ({
  texto: '',
  generador: FiltroCostos.TODOS,
  comercializador: FiltroCostos.TODOS,
})

const nombres = (filas: FilaVerificacion[]) => filas.map((f) => f.nombre_comercial)

describe('filtro por costos del generador', () => {
  it('«con costos» trae solo los que sí', () => {
    const r = filtrarVerificacion(FILAS, { ...sinFiltros(), generador: FiltroCostos.ACTIVOS })
    expect(nombres(r)).toEqual(['Bayunca', 'Sirius'])
  })

  it('«sin costos» trae solo los que NO, nunca los que no tienen dato', () => {
    const r = filtrarVerificacion(FILAS, { ...sinFiltros(), generador: FiltroCostos.INACTIVOS })
    expect(nombres(r)).toEqual(['San Onofre'])
  })

  it('«sin dato» aísla los que no cruzan con la API', () => {
    const r = filtrarVerificacion(FILAS, { ...sinFiltros(), generador: FiltroCostos.SIN_DATO })
    expect(nombres(r)).toEqual(['Chima Oriente'])
  })

  it('un campo ausente cuenta como sin dato, no como «no»', () => {
    const filas = [{ nombre_comercial: 'Nuevo' }]
    expect(filtrarVerificacion(filas, { ...sinFiltros(), generador: FiltroCostos.SIN_DATO }))
      .toHaveLength(1)
    expect(filtrarVerificacion(filas, { ...sinFiltros(), generador: FiltroCostos.INACTIVOS }))
      .toHaveLength(0)
  })
})

describe('los dos filtros juntos', () => {
  it('se aplican a la vez, no uno u otro', () => {
    const r = filtrarVerificacion(FILAS, {
      ...sinFiltros(),
      generador: FiltroCostos.ACTIVOS,
      comercializador: FiltroCostos.INACTIVOS,
    })
    expect(nombres(r)).toEqual(['Sirius'])
  })

  it('una combinación sin resultados devuelve vacío, no todo', () => {
    const r = filtrarVerificacion(FILAS, {
      ...sinFiltros(),
      generador: FiltroCostos.SIN_DATO,
      comercializador: FiltroCostos.ACTIVOS,
    })
    expect(r).toEqual([])
  })
})

describe('búsqueda por texto', () => {
  it('ignora mayúsculas y espacios de sobra', () => {
    expect(nombres(filtrarVerificacion(FILAS, { ...sinFiltros(), texto: '  bayUNca ' })))
      .toEqual(['Bayunca'])
  })

  it('se combina con los filtros de costos', () => {
    const r = filtrarVerificacion(FILAS, {
      ...sinFiltros(), texto: 'o', generador: FiltroCostos.INACTIVOS,
    })
    expect(nombres(r)).toEqual(['San Onofre'])
  })

  it('una fila sin nombre no rompe la búsqueda', () => {
    const filas = [{ nombre_comercial: null, from_generator: true }]
    expect(filtrarVerificacion(filas, { ...sinFiltros(), texto: 'x' })).toEqual([])
    expect(filtrarVerificacion(filas, sinFiltros())).toHaveLength(1)
  })

  it('sin filtros no quita nada', () => {
    expect(filtrarVerificacion(FILAS, sinFiltros())).toHaveLength(4)
  })
})

describe('hayFiltros', () => {
  it('reconoce cuando no hay ninguno', () => {
    expect(hayFiltros(sinFiltros())).toBe(false)
    expect(hayFiltros({ ...sinFiltros(), texto: '   ' })).toBe(false)
  })

  it.each([
    ['texto', { texto: 'bay' }],
    ['generador', { generador: FiltroCostos.ACTIVOS }],
    ['comercializador', { comercializador: FiltroCostos.SIN_DATO }],
  ])('reconoce el filtro de %s', (_, parcial) => {
    expect(hayFiltros({ ...sinFiltros(), ...parcial })).toBe(true)
  })
})
