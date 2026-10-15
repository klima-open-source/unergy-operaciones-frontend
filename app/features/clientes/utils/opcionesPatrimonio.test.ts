import { describe, expect, it } from 'vitest'
import { opcionesPatrimonio } from './opcionesPatrimonio'

const vacio = { codigo: null, cliente_id: null, cliente_nombre: null, cliente_nit: null, participaciones: [] }

describe('opcionesPatrimonio', () => {
  it('pone la fiduciaria delante de cada patrimonio', () => {
    const opciones = opcionesPatrimonio([
      {
        ...vacio,
        id: 1,
        nombre: 'Fiduciaria Bancolombia',
        padre_id: null,
        subpatrimonios: [
          { ...vacio, id: 2, nombre: 'P.A. Valle de Gandalf', codigo: '17434', padre_id: 1 },
        ],
      },
    ])
    expect(opciones).toEqual([
      { value: '1', label: 'Fiduciaria Bancolombia' },
      { value: '2', label: 'Fiduciaria Bancolombia › 17434 P.A. Valle de Gandalf' },
    ])
  })
})
