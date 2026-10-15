import { describe, expect, it } from 'vitest'

import type { Falla } from '~/features/fallas/types'
import { EstadoFallaCodigo } from '~/features/fallas/types'
import { fallasProgramadasHoy } from './programadasHoy'

const HOY = '2026-10-13'
let id = 0
const falla = (over: Partial<Falla>): Falla => ({
  id: ++id,
  estado: { id: 1, codigo: EstadoFallaCodigo.PROGRAMADO, es_estado_final: false },
  fecha_programada: HOY,
  ...over,
})

describe('fallasProgramadasHoy', () => {
  it('trae las programadas para hoy', () => {
    const f = falla({})
    expect(fallasProgramadasHoy([f], HOY)).toEqual([f])
  })

  it('acepta una fecha programada con hora', () => {
    const f = falla({ fecha_programada: `${HOY}T08:00:00-05:00` })
    expect(fallasProgramadasHoy([f], HOY)).toEqual([f])
  })

  it('descarta otro día, otro estado o una falla cerrada', () => {
    const lista = [
      falla({ fecha_programada: '2026-10-14' }),
      falla({ fecha_programada: null }),
      falla({ estado: { id: 2, codigo: EstadoFallaCodigo.ABIERTA } }),
      falla({ estado: { id: 1, codigo: EstadoFallaCodigo.PROGRAMADO, es_estado_final: true } }),
    ]
    expect(fallasProgramadasHoy(lista, HOY)).toEqual([])
  })

  it('ordena por proyecto y luego por código', () => {
    const b2 = falla({ proyecto: { id: 2, nombre_comercial: 'Baraya' }, codigo_interno: 'F-2' })
    const b1 = falla({ proyecto: { id: 2, nombre_comercial: 'Baraya' }, codigo_interno: 'F-1' })
    const a = falla({ proyecto: { id: 1, nombre_comercial: 'Algarrobo' }, codigo_interno: 'F-9' })
    expect(fallasProgramadasHoy([b2, a, b1], HOY)).toEqual([a, b1, b2])
  })
})
