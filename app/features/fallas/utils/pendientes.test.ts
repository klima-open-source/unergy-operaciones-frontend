import { describe, expect, it } from 'vitest'

import type { Falla } from '~/features/fallas/types'
import { EquipoFalla } from '~/features/fallas/types'
import { fallasPendientes } from './pendientes'

let id = 0
const falla = (over: Partial<Falla>): Falla => ({ id: ++id, en_pendientes: true, ...over })
const proyecto = (nombre: string) => ({ id: nombre.length, nombre_comercial: nombre })

describe('fallasPendientes', () => {
  it('solo trae las marcadas por el backend', () => {
    const a = falla({})
    const b = falla({ en_pendientes: false })
    const c = falla({ en_pendientes: undefined })
    expect(fallasPendientes([a, b, c])).toEqual([a])
  })

  it('ordena por proyecto y luego por identificación, la más reciente primero', () => {
    const viejaB = falla({ proyecto: proyecto('Baraya'), fecha_identificacion: '2026-09-01' })
    const nuevaB = falla({ proyecto: proyecto('Baraya'), fecha_identificacion: '2026-10-01' })
    const sinFechaB = falla({ proyecto: proyecto('Baraya') })
    const a = falla({ proyecto: proyecto('Ábrego'), fecha_identificacion: '2026-01-01' })
    expect(fallasPendientes([viejaB, sinFechaB, a, nuevaB])).toEqual([a, nuevaB, viejaB, sinFechaB])
  })

  it('filtra por equipo y por garantía', () => {
    const tracker = falla({ equipo: EquipoFalla.TRACKER })
    const inversorGarantia = falla({ equipo: EquipoFalla.INVERSOR, en_garantia: true })
    const todas = [tracker, inversorGarantia]
    expect(fallasPendientes(todas, { equipo: EquipoFalla.TRACKER })).toEqual([tracker])
    expect(fallasPendientes(todas, { soloGarantia: true })).toEqual([inversorGarantia])
    expect(fallasPendientes(todas, { equipo: EquipoFalla.TRACKER, soloGarantia: true })).toEqual([])
    expect(fallasPendientes(todas, { equipo: null })).toHaveLength(2)
  })

  it('no altera la lista recibida', () => {
    const lista = [falla({ proyecto: proyecto('Z') }), falla({ proyecto: proyecto('A') })]
    const copia = [...lista]
    fallasPendientes(lista)
    expect(lista).toEqual(copia)
  })
})
