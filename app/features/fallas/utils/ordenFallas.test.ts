import { describe, expect, it } from 'vitest'

import { compararFallasRecientes } from './ordenFallas'

const ordenar = <T extends Parameters<typeof compararFallasRecientes>[0] & { id: number }>(
  fallas: T[],
) => [...fallas].sort(compararFallasRecientes).map((f) => f.id)

describe('compararFallasRecientes', () => {
  it('va de la fecha de identificación más reciente a la más antigua', () => {
    expect(
      ordenar([
        { id: 1, fecha_identificacion: '2026-09-01' },
        { id: 2, fecha_identificacion: '2026-10-12' },
        { id: 3, fecha_identificacion: '2026-10-01' },
      ]),
    ).toEqual([2, 3, 1])
  })

  it('el mismo día desempata por hora de identificación', () => {
    expect(
      ordenar([
        { id: 1, fecha_identificacion: '2026-10-12', hora_identificacion: '08:15:00' },
        { id: 2, fecha_identificacion: '2026-10-12', hora_identificacion: '17:40:00' },
        { id: 3, fecha_identificacion: '2026-10-12' },
      ]),
    ).toEqual([2, 1, 3])
  })

  it('misma fecha y hora desempata por cuándo se registró', () => {
    expect(
      ordenar([
        {
          id: 1,
          fecha_identificacion: '2026-10-12',
          hora_identificacion: '08:00',
          created_at: '2026-10-12T08:05:00-05:00',
        },
        {
          id: 2,
          fecha_identificacion: '2026-10-12',
          hora_identificacion: '08:00',
          created_at: '2026-10-12T14:00:00Z',
        },
      ]),
    ).toEqual([2, 1])
  })

  it('lo que no tiene fecha va al final', () => {
    expect(
      ordenar([{ id: 1 }, { id: 2, fecha_identificacion: '2020-01-01' }]),
    ).toEqual([2, 1])
  })
})
