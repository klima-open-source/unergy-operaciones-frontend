/**
 * El catálogo compartido: que cada catálogo se pida una vez por vigencia y no
 * una vez por vista que lo muestra. Se prueba lo que, si se rompe, devuelve las
 * peticiones de más sin que falle nada visible: el caché, la petición en vuelo
 * compartida, `invalidar()` y que un fallo no quede guardado.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCatalogoCompartido } from './useCatalogoCompartido'

/** `useState` de Nuxt, con el almacén reiniciable entre casos. */
const almacen = new Map<string, { value: unknown }>()
vi.stubGlobal('useState', (clave: string, inicial: () => unknown) => {
  if (!almacen.has(clave)) almacen.set(clave, { value: inicial() })
  return almacen.get(clave)
})

describe('useCatalogoCompartido', () => {
  beforeEach(() => {
    almacen.clear()
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('dentro de la vigencia sirve del caché, aunque lo pida otra vista', async () => {
    const pedir = vi.fn().mockResolvedValue(['a'])
    await useCatalogoCompartido('x', pedir).cargar()
    expect(await useCatalogoCompartido('x', pedir).cargar()).toEqual(['a'])
    expect(pedir).toHaveBeenCalledTimes(1)
  })

  it('vencida la vigencia vuelve a pedirlo', async () => {
    const pedir = vi.fn().mockResolvedValue(['a'])
    const { cargar } = useCatalogoCompartido('x', pedir)
    await cargar()
    vi.advanceTimersByTime(5 * 60_000 + 1)
    await cargar()
    expect(pedir).toHaveBeenCalledTimes(2)
  })

  it('dos que montan a la vez comparten la petición en vuelo', async () => {
    const pedir = vi.fn().mockResolvedValue(['a'])
    const [uno, dos] = await Promise.all([
      useCatalogoCompartido('x', pedir).cargar(),
      useCatalogoCompartido('x', pedir).cargar(),
    ])
    expect(uno).toEqual(dos)
    expect(pedir).toHaveBeenCalledTimes(1)
  })

  it('invalidar hace que la siguiente carga vaya a la red', async () => {
    const pedir = vi.fn().mockResolvedValueOnce(['a']).mockResolvedValueOnce(['a', 'b'])
    const { cargar, invalidar } = useCatalogoCompartido('x', pedir)
    await cargar()
    invalidar()
    expect(await cargar()).toEqual(['a', 'b'])
  })

  it('un fallo se lanza y no se guarda: el siguiente intento vuelve a pedir', async () => {
    const pedir = vi.fn().mockRejectedValueOnce(new Error('caído')).mockResolvedValueOnce(['a'])
    const { cargar } = useCatalogoCompartido('x', pedir)
    await expect(cargar()).rejects.toThrow('caído')
    expect(await cargar()).toEqual(['a'])
  })

  it('cada clave es un catálogo aparte', async () => {
    const pedir = vi.fn().mockResolvedValue([])
    await useCatalogoCompartido('x', pedir).cargar()
    await useCatalogoCompartido('y', pedir).cargar()
    expect(pedir).toHaveBeenCalledTimes(2)
  })
})
