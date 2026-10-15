import { describe, expect, it } from 'vitest'
import { LiquidacionesApiService } from './liquidaciones-api'
import { EstadoTarea, TareaCancelada } from '~/features/liquidaciones/types'

/** Un servicio cuyo `get` responde siempre «en curso» y cuenta las consultas. */
function servicioEnCurso() {
  const servicio = new LiquidacionesApiService()
  let consultas = 0
  Object.assign(servicio, {
    get: async () => {
      consultas++
      return { estado: EstadoTarea.EN_CURSO, mensaje: 'trabajando' }
    },
  })
  return { servicio, consultas: () => consultas }
}

describe('esperarTarea', () => {
  it('deja de consultar en cuanto se cancela la señal (al salir de la vista)', async () => {
    const { servicio, consultas } = servicioEnCurso()
    const controlador = new AbortController()
    const espera = servicio.esperarTarea('t1', { intervaloMs: 60_000, signal: controlador.signal })
    await new Promise((r) => setTimeout(r, 10))
    controlador.abort()
    await expect(espera).rejects.toBeInstanceOf(TareaCancelada)
    expect(consultas()).toBe(1)
  })

  it('con la señal ya cancelada no consulta nada', async () => {
    const { servicio, consultas } = servicioEnCurso()
    const controlador = new AbortController()
    controlador.abort()
    await expect(
      servicio.esperarTarea('t1', { signal: controlador.signal }),
    ).rejects.toBeInstanceOf(TareaCancelada)
    expect(consultas()).toBe(0)
  })
})
