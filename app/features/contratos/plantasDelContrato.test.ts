/**
 * `proyecto_ids` reemplaza el conjunto de plantas del contrato. Estas pruebas
 * cubren el modo de fallo que eso abre: mandar una lista incompleta borra
 * vínculos en la base, sin error y sin aviso.
 */
import { describe, expect, it } from 'vitest'
import { idsConPlantaAgregada, yaEstaVinculada } from './plantasDelContrato'

const TERPEL_1 = { id: 11, nombre_comercial: 'Terpel 1' }
const TERPEL_2 = { id: 12, nombre_comercial: 'Terpel 2' }
const BAYUNCA = { id: 20, nombre_comercial: 'Bayunca' }

describe('idsConPlantaAgregada', () => {
  it('conserva las plantas que el contrato ya tenía', () => {
    expect(idsConPlantaAgregada([TERPEL_1, TERPEL_2], BAYUNCA)).toEqual([11, 12, 20])
  })

  it('no duplica una planta que ya está vinculada', () => {
    // (contrato_id, proyecto_id) es la llave primaria de la tabla de vínculos:
    // un id repetido revienta el bulk_create del backend.
    expect(idsConPlantaAgregada([TERPEL_1, TERPEL_2], TERPEL_1)).toEqual([11, 12])
  })

  it('funciona con un contrato que no tiene ninguna planta', () => {
    expect(idsConPlantaAgregada([], BAYUNCA)).toEqual([20])
    expect(idsConPlantaAgregada(undefined, BAYUNCA)).toEqual([20])
    expect(idsConPlantaAgregada(null, BAYUNCA)).toEqual([20])
  })

  it('sin planta nueva devuelve las actuales, no una lista vacía', () => {
    // Si devolviera [], un guardado sin selección borraría todo.
    expect(idsConPlantaAgregada([TERPEL_1, TERPEL_2], null)).toEqual([11, 12])
    expect(idsConPlantaAgregada([TERPEL_1], undefined)).toEqual([11])
  })

  it('ignora entradas sin id en vez de mandar undefined al backend', () => {
    expect(idsConPlantaAgregada([TERPEL_1, null, { id: undefined } as never], BAYUNCA)).toEqual([
      11, 20,
    ])
  })

  it('el id 0 cuenta como id', () => {
    expect(idsConPlantaAgregada([{ id: 0 }], BAYUNCA)).toEqual([0, 20])
  })
})

describe('yaEstaVinculada', () => {
  it('reconoce la planta que ya está en el contrato', () => {
    expect(yaEstaVinculada([TERPEL_1, TERPEL_2], TERPEL_2)).toBe(true)
  })

  it('una planta nueva no está vinculada', () => {
    expect(yaEstaVinculada([TERPEL_1], BAYUNCA)).toBe(false)
  })

  it('sin selección no hay nada vinculado', () => {
    expect(yaEstaVinculada([TERPEL_1], null)).toBe(false)
    expect(yaEstaVinculada(undefined, BAYUNCA)).toBe(false)
  })
})
