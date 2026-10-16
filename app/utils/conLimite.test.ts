import { describe, expect, it } from 'vitest'
import { conLimite } from './conLimite'

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('conLimite', () => {
  it('nunca tiene más de `limite` en vuelo', async () => {
    let enVuelo = 0
    let maximo = 0
    await conLimite([1, 2, 3, 4, 5, 6, 7], 3, async () => {
      maximo = Math.max(maximo, ++enVuelo)
      await esperar(5)
      enVuelo--
    })
    expect(maximo).toBe(3)
  })

  it('devuelve en el orden de entrada, con los fallos marcados', async () => {
    const r = await conLimite([30, 10, 20], 2, async (ms) => {
      await esperar(ms)
      if (ms === 10) throw new Error('falló')
      return ms
    })
    expect(r[0]).toEqual({ status: 'fulfilled', value: 30 })
    expect(r[1]).toMatchObject({ status: 'rejected' })
    expect(r[2]).toEqual({ status: 'fulfilled', value: 20 })
  })

  it('una lista vacía no espera nada', async () => {
    expect(await conLimite([], 4, async () => 1)).toEqual([])
  })
})
