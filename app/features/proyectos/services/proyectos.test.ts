/**
 * `ProyectosService.listarPaginado()` -- la llamada de la que cuelgan las dos
 * tablas de plantas (la vista unificada y la pagina de Proyectos).
 *
 * Bug real (2026-09-10): la vista unificada mostraba "100 de 188 plantas". El
 * servidor recorta toda lista a 100 filas por respuesta y `completarPaginas`
 * (`~/core/paginacion.ts`) esta puesto justo para completarla, pero este
 * service armaba el querystring a mano y lo pegaba a la URL. La red solo sabe
 * leer `options.query` -- una query que no puede inspeccionar la deja pasar
 * intacta, a proposito -- asi que esta llamada quedaba fuera y nadie se
 * enteraba: el recorte viene con un 200.
 *
 * Por eso lo que se fija aca no es "que traiga 188 filas" sino la propiedad de
 * la que eso depende: que los parametros viajen por `query`, donde la red los
 * ve. Y que los filtros sigan intactos en la pagina 2, que es lo que se rompe
 * si alguien vuelve a armar la URL a mano.
 */
import air, { type AirClient } from '@korastd/air'
import { describe, expect, it } from 'vitest'

import { TOPE_FILAS_SERVIDOR } from '~/core/paginacion'
import { ProyectosService } from '~/features/proyectos/services/proyectos'

const BASE = 'http://api.test'

/**
 * El backend de verdad: pagina por `page`/`size` y NUNCA devuelve mas de
 * `TOPE_FILAS_SERVIDOR` filas, sin avisar (200 con la lista corta).
 */
function servidor(totalFilas: number) {
  const urls: URL[] = []
  const fetchFalso = async (url: string): Promise<Response> => {
    const u = new URL(url)
    urls.push(u)
    const size = Math.min(Number(u.searchParams.get('size') ?? 20), TOPE_FILAS_SERVIDOR)
    const desde = (Number(u.searchParams.get('page') ?? 1) - 1) * size
    const cuantas = Math.max(0, Math.min(size, totalFilas - desde))
    const items = Array.from({ length: cuantas }, (_, i) => ({ id: desde + i + 1 }))
    return new Response(JSON.stringify({ items, total: totalFilas, page: 1, size }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  const cliente: AirClient = air.create({ baseURL: BASE, fetch: fetchFalso })
  return { servicio: new ProyectosService(cliente), urls }
}

describe('ProyectosService.listarPaginado', () => {
  it('completa las 188 plantas que el servidor entrega de 100 en 100', async () => {
    const { servicio, urls } = servidor(188)

    const data = await servicio.listarPaginado({ page: 1, size: 500 })

    expect(data.items).toHaveLength(188)
    // `total` es el del servidor, no el de las filas juntadas.
    expect(data.total).toBe(188)
    // Sin repetidas ni huecos: la 1 y la 188 estan, y cada id aparece una vez.
    expect(new Set(data.items.map((p) => p.id)).size).toBe(188)
    expect(urls.map((u) => u.searchParams.get('page'))).toEqual(['1', '2'])
    // Cada respuesta sigue pesando 100 filas: es lo que protege el tope.
    expect(urls.every((u) => u.searchParams.get('size') === String(TOPE_FILAS_SERVIDOR))).toBe(true)
  })

  it('manda los parametros por query, no en la URL armada a mano', async () => {
    const { servicio, urls } = servidor(50)

    await servicio.listarPaginado({ page: 1, size: 500 })

    // Que el `size` llegue reescrito a 100 es justo la prueba: solo
    // `completarPaginas` lo cambia, y solo puede cambiarlo si pudo LEER la
    // query. Con el querystring armado a mano llegaba el 500 pedido y la
    // respuesta volvia recortada en silencio. Una sola llamada: 50 filas caben
    // en una respuesta y la red no pide de mas.
    expect(urls).toHaveLength(1)
    expect(urls[0]!.searchParams.get('size')).toBe(String(TOPE_FILAS_SERVIDOR))
  })

  it('conserva los filtros en todas las paginas', async () => {
    const { servicio, urls } = servidor(150)

    await servicio.listarPaginado({
      size: 500,
      estado: 'en_operacion',
      tipo_proyecto: 'autoconsumo',
      portafolio_id: 7,
      ppaIds: [12, 45],
      sinPpa: true,
    })

    expect(urls).toHaveLength(2)
    for (const u of urls) {
      expect(u.searchParams.get('estado')).toBe('en_operacion')
      expect(u.searchParams.get('tipo_proyecto')).toBe('autoconsumo')
      expect(u.searchParams.get('portafolio_id')).toBe('7')
      expect(u.searchParams.get('sin_ppa')).toBe('true')
      // Repetido, no como lista: es lo que el backend espera para `list[int]`.
      expect(u.searchParams.getAll('ppa_id')).toEqual(['12', '45'])
    }
  })

  it('no manda los filtros que no se pidieron', async () => {
    const { servicio, urls } = servidor(10)

    await servicio.listarPaginado()

    const q = urls[0]!.searchParams
    // `sin_ppa=false` seria un filtro pedido, no la ausencia de uno; un
    // `ppa_id` vacio tampoco tiene que aparecer.
    expect(q.has('sin_ppa')).toBe(false)
    expect(q.has('ppa_id')).toBe(false)
    expect(q.has('estado')).toBe(false)
    expect(q.has('portafolio_id')).toBe(false)
  })

  it('un filtro vacio no viaja como filtro por cadena vacia', async () => {
    const { servicio, urls } = servidor(10)

    // Asi lo llama la vista cuando el select esta en "Todos".
    await servicio.listarPaginado({ estado: '', tipo_proyecto: '', portafolio_id: 0 })

    const q = urls[0]!.searchParams
    // `estado=` seria un filtro por el estado "" -- cero plantas en vez de todas.
    expect(q.has('estado')).toBe(false)
    expect(q.has('tipo_proyecto')).toBe(false)
    expect(q.has('portafolio_id')).toBe(false)
  })
})
