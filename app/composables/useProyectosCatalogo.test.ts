/**
 * El catálogo de plantas: que se pida UNA vez.
 *
 * Diecinueve vistas llamaban a `ProyectosService.listar({ size: 500 })` al
 * montarse, casi todas para llenar un desplegable. Y cada llamada eran DOS
 * peticiones —el backend recorta a 100 filas y `completarPaginas` sale a buscar
 * el resto— de filas con las cinco relaciones anidadas del proyecto.
 *
 * Lo que se prueba acá es el ahorro, que es todo el punto: cuántas veces se
 * llama al servicio. Las tres propiedades que, si se rompen, devuelven el
 * problema sin que falle nada visible:
 *
 *   · dentro de la vigencia se sirve del caché;
 *   · dos componentes que montan a la vez comparten la petición en vuelo (es
 *     el caso real: una vista y su formulario);
 *   · un fallo no deja el caché envenenado ni la vista sin montar.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const listar = vi.fn()

vi.mock('~/features/proyectos/services/proyectos', () => ({
  ProyectosService: class {
    listar = listar
  },
}))

vi.mock('~/core/logger', () => ({ logger: { error: vi.fn() } }))

/** `useState` de Nuxt, con el almacén reiniciable entre casos. */
const almacen = new Map<string, { value: unknown }>()
vi.stubGlobal('useState', (clave: string, inicial: () => unknown) => {
  if (!almacen.has(clave)) almacen.set(clave, { value: inicial() })
  return almacen.get(clave)
})

const PLANTAS = [
  { id: 1, nombre_comercial: 'Planta Uno', tipo_proyecto: 'minigranja' },
  { id: 2, nombre_comercial: 'Planta Dos', tipo_proyecto: 'techo' },
]

async function cargarComposable() {
  vi.resetModules()
  const mod = await import('./useProyectosCatalogo')
  return mod.useProyectosCatalogo
}

beforeEach(() => {
  almacen.clear()
  listar.mockReset()
  listar.mockResolvedValue(PLANTAS)
  vi.useRealTimers()
})

describe('useProyectosCatalogo', () => {
  it('la primera carga pide el catálogo', async () => {
    const usar = await cargarComposable()

    await expect(usar().cargar()).resolves.toEqual(PLANTAS)
    expect(listar).toHaveBeenCalledTimes(1)
    expect(listar).toHaveBeenCalledWith({ size: 500 })
  })

  it('la segunda no vuelve a pedirlo', async () => {
    const usar = await cargarComposable()

    await usar().cargar()
    await usar().cargar()

    expect(listar).toHaveBeenCalledTimes(1)
  })

  it('dos vistas distintas comparten el mismo catálogo', async () => {
    const usar = await cargarComposable()

    await usar().cargar()
    const otra = usar()
    await otra.cargar()

    expect(listar).toHaveBeenCalledTimes(1)
    expect(otra.proyectos.value).toEqual(PLANTAS)
  })

  it('dos componentes que montan a la vez comparten la petición en vuelo', async () => {
    // El caso real: una vista y su formulario entran los dos en `cargar()`
    // antes de que el primero haya respondido. Sin compartirla se piden dos
    // catálogos completos para tirar uno.
    const usar = await cargarComposable()
    let resolver: (v: unknown) => void = () => {}
    listar.mockReturnValue(
      new Promise((r) => {
        resolver = r
      }),
    )

    const a = usar().cargar()
    const b = usar().cargar()
    resolver(PLANTAS)

    await expect(a).resolves.toEqual(PLANTAS)
    await expect(b).resolves.toEqual(PLANTAS)
    expect(listar).toHaveBeenCalledTimes(1)
  })

  it('pasada la vigencia se vuelve a pedir', async () => {
    // Sin invalidación explícita, el TTL es lo único que hace aparecer una
    // planta nueva en los desplegables.
    const usar = await cargarComposable()
    await usar().cargar()

    const ahora = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(ahora + 61_000)
    await usar().cargar()

    expect(listar).toHaveBeenCalledTimes(2)
  })

  it('refrescar lo pide aunque esté vigente', async () => {
    const usar = await cargarComposable()
    await usar().cargar()

    await usar().refrescar()

    expect(listar).toHaveBeenCalledTimes(2)
  })

  it('si falla devuelve lista vacía en vez de reventar', async () => {
    // Un desplegable vacío es mejor que una vista que no monta.
    const usar = await cargarComposable()
    listar.mockRejectedValue(new Error('backend caído'))

    await expect(usar().cargar()).resolves.toEqual([])
  })

  it('tras un fallo se puede reintentar', async () => {
    // El caché no queda envenenado: sin esto, un backend que parpadea dejaba
    // los desplegables vacíos hasta recargar la página.
    const usar = await cargarComposable()
    listar.mockRejectedValueOnce(new Error('backend caído'))

    await usar().cargar()
    await expect(usar().cargar()).resolves.toEqual(PLANTAS)
    expect(listar).toHaveBeenCalledTimes(2)
  })

  it('marca cuándo está cargando', async () => {
    const usar = await cargarComposable()
    let resolver: (v: unknown) => void = () => {}
    listar.mockReturnValue(
      new Promise((r) => {
        resolver = r
      }),
    )

    const c = usar()
    const promesa = c.cargar()
    expect(c.cargando.value).toBe(true)

    resolver(PLANTAS)
    await promesa
    expect(c.cargando.value).toBe(false)
  })
})
