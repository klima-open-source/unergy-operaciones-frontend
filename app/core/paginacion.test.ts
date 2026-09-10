/**
 * `completarPaginas()` -- la red de seguridad contra el recorte silencioso del
 * servidor (100 filas por respuesta, ver `api/pagination.py`).
 *
 * Lo que se prueba acá es sobre todo lo que NO debe hacer: una petición normal
 * no puede pagar ni una llamada extra, y una respuesta que no es lista tiene
 * que pasar intacta. Un helper así, mal acotado, multiplicaría el tráfico de
 * toda la plataforma en vez de arreglar 52 vistas.
 */
import type { AirOptions } from '@korastd/air'
import { describe, expect, it, vi } from 'vitest'

import { completarPaginas, MAX_PAGINAS, TOPE_FILAS_SERVIDOR } from './paginacion'

interface Fila {
  id: number
}
interface Envuelto {
  items: Fila[]
  total: number
  page: number
  size: number
}
interface ConResults {
  results: Fila[]
  count: number
}

type Consulta = Record<string, unknown>

/** El recorte del servidor de verdad: nunca más de TOPE_FILAS_SERVIDOR. */
function lote(query: Consulta, totalFilas: number): { filas: Fila[]; tamano: number } {
  const tamano = Math.min(Number(query.size ?? query.limit ?? 50), TOPE_FILAS_SERVIDOR)
  const desde = query.skip != null ? Number(query.skip) : (Number(query.page ?? 1) - 1) * tamano
  const cuantas = Math.max(0, Math.min(tamano, totalFilas - desde))
  return { filas: Array.from({ length: cuantas }, (_, i) => ({ id: desde + i })), tamano }
}

function registrador() {
  const consultas: Consulta[] = []
  const anotar = (options: AirOptions | undefined) => {
    const q = (options?.query ?? {}) as Consulta
    consultas.push(q)
    return q
  }
  return { consultas, anotar }
}

function servidorEnvuelto(totalFilas: number) {
  const { consultas, anotar } = registrador()
  const pedir = vi.fn(async (options: AirOptions): Promise<Envuelto> => {
    const q = anotar(options)
    const { filas, tamano } = lote(q, totalFilas)
    return { items: filas, total: totalFilas, page: Number(q.page ?? 1), size: tamano }
  })
  return { pedir, consultas }
}

function servidorConResults(totalFilas: number) {
  const pedir = vi.fn(async (options: AirOptions): Promise<ConResults> => {
    const { filas } = lote((options?.query ?? {}) as Consulta, totalFilas)
    return { results: filas, count: totalFilas }
  })
  return { pedir }
}

function servidorPelado(totalFilas: number) {
  const { consultas, anotar } = registrador()
  const pedir = vi.fn(async (options: AirOptions): Promise<Fila[]> => {
    return lote(anotar(options), totalFilas).filas
  })
  return { pedir, consultas }
}

describe('no toca las peticiones que no lo necesitan', () => {
  it('sin size ni limit, una sola llamada', async () => {
    const { pedir } = servidorEnvuelto(500)
    await completarPaginas(pedir, { query: { estado: 'activa' } })
    expect(pedir).toHaveBeenCalledTimes(1)
  })

  it('pidiendo 100 o menos, una sola llamada', async () => {
    const { pedir } = servidorEnvuelto(500)
    await completarPaginas(pedir, { query: { size: 100 } })
    expect(pedir).toHaveBeenCalledTimes(1)
  })

  it('sin options, una sola llamada', async () => {
    const { pedir } = servidorEnvuelto(500)
    await completarPaginas(pedir, undefined)
    expect(pedir).toHaveBeenCalledTimes(1)
  })

  it('una query que no es un objeto plano pasa de largo', async () => {
    // `air` acepta URLSearchParams y listas de tuplas como query. No se pueden
    // leer por clave, así que no hay forma de saber cuántas filas se pidieron:
    // lo correcto es no tocar la petición, no adivinar.
    const { pedir } = servidorEnvuelto(500)
    await completarPaginas(pedir, { query: new URLSearchParams({ size: '500' }) })
    expect(pedir).toHaveBeenCalledTimes(1)
  })

  it('una respuesta que no es lista pasa tal cual, sin pedir mas', async () => {
    const pedir = vi.fn(async () => ({ nombre: 'un detalle', total: 999 }))
    const cuerpo = await completarPaginas(pedir, { query: { size: 500 } })
    expect(cuerpo).toEqual({ nombre: 'un detalle', total: 999 })
    expect(pedir).toHaveBeenCalledTimes(1)
  })
})

describe('completa la lista recortada', () => {
  it('junta las paginas hasta el total que dice el servidor', async () => {
    const { pedir } = servidorEnvuelto(247)
    const cuerpo = await completarPaginas(pedir, { query: { size: 500 } })
    expect(cuerpo.items).toHaveLength(247)
    expect(pedir).toHaveBeenCalledTimes(3)
  })

  it('preserva el resto del cuerpo, incluido el total real', async () => {
    const { pedir } = servidorEnvuelto(247)
    const cuerpo = await completarPaginas(pedir, { query: { size: 500 } })
    expect(cuerpo.total).toBe(247)
  })

  it('no devuelve mas filas de las que se pidieron', async () => {
    const { pedir } = servidorEnvuelto(1000)
    const cuerpo = await completarPaginas(pedir, { query: { size: 250 } })
    expect(cuerpo.items).toHaveLength(250)
  })

  it('entiende el contrato `results`/`count` del proxy de liquidaciones', async () => {
    const { pedir } = servidorConResults(150)
    const cuerpo = await completarPaginas(pedir, { query: { size: 500 } })
    expect(cuerpo.results).toHaveLength(150)
    expect(cuerpo.count).toBe(150)
  })
})

describe('paginacion por skip/limit (los listados que paginan a mano)', () => {
  it('avanza con skip y junta todo, aunque no venga total', async () => {
    // Es el caso de /fronteras: lista pelada, sin total. La única señal de que
    // hay más es que la página llegó justo llena.
    const { pedir, consultas } = servidorPelado(247)
    const filas = await completarPaginas(pedir, { query: { limit: 500 } })
    expect(filas).toHaveLength(247)
    // La 1a va tal como la pidio quien llamo (sin `skip`, con su `limit`); solo
    // las siguientes desplazan, y de a lo que el servidor demostro entregar.
    expect(consultas.map((q) => q.skip)).toEqual([undefined, 100, 200])
    expect(consultas.map((q) => q.limit)).toEqual([500, 100, 100])
  })

  it('respeta el skip inicial de quien llamo', async () => {
    const { pedir, consultas } = servidorPelado(500)
    await completarPaginas(pedir, { query: { limit: 300, skip: 50 } })
    expect(consultas.map((q) => q.skip)).toEqual([50, 150, 250])
  })

  it('para en cuanto una pagina llega a medias', async () => {
    const { pedir } = servidorPelado(120)
    const filas = await completarPaginas(pedir, { query: { limit: 500 } })
    expect(filas).toHaveLength(120)
    expect(pedir).toHaveBeenCalledTimes(2) // la 2a trae 20: no hay 3a
  })

  it('una lista vacia no dispara una segunda llamada', async () => {
    const { pedir } = servidorPelado(0)
    const filas = await completarPaginas(pedir, { query: { limit: 500 } })
    expect(filas).toHaveLength(0)
    expect(pedir).toHaveBeenCalledTimes(1)
  })
})

describe('un endpoint que sirve el total de una', () => {
  // Los cuatro que aceptan `limit` hasta 500 y lo sirven completo:
  // /informes, /informes/envios, /contratos-servicio, /ppa. No hay nada que
  // completar y no se les puede pedir una 2a pagina: no entienden `skip`.

  /** Sirve hasta `limit` filas de una, y NUNCA mira `skip`. */
  function servidorSinDesplazamiento(totalFilas: number, topePropio = 500) {
    const consultas: Consulta[] = []
    const pedir = vi.fn(async (options: AirOptions): Promise<Fila[]> => {
      const q = (options?.query ?? {}) as Consulta
      consultas.push(q)
      const cuantas = Math.min(Number(q.limit ?? 50), topePropio, totalFilas)
      return Array.from({ length: cuantas }, (_, i) => ({ id: i }))
    })
    return { pedir, consultas }
  }

  it('una sola llamada, con el limit que se pidio', async () => {
    const { pedir, consultas } = servidorSinDesplazamiento(500)
    const filas = await completarPaginas(pedir, { query: { limit: 500 } })
    expect(filas).toHaveLength(500)
    expect(pedir).toHaveBeenCalledTimes(1)
    expect(consultas[0]!.limit).toBe(500)
  })

  it('menos filas que el tope: no pide una segunda pagina', async () => {
    const { pedir } = servidorSinDesplazamiento(137)
    const filas = await completarPaginas(pedir, { query: { limit: 500 } })
    expect(filas).toHaveLength(137)
    expect(pedir).toHaveBeenCalledTimes(1)
  })

  it('si recorta justo en el tope e ignora el skip, no apila copias', async () => {
    // El bug del historial del Reporte CGM: 5 paginas identicas de 100 filas
    // apiladas daban "500 envios" que eran 100 repetidos cinco veces, y cada
    // destinatario aparecia cinco veces dentro de su lote.
    const { pedir } = servidorSinDesplazamiento(1000, TOPE_FILAS_SERVIDOR)
    const filas = await completarPaginas(pedir, { query: { limit: 500 } })

    expect(filas).toHaveLength(TOPE_FILAS_SERVIDOR)
    expect(new Set(filas.map((f) => f.id)).size).toBe(TOPE_FILAS_SERVIDOR)
    // Se detecta en la 2a: no se gastan las 5 llamadas para descubrirlo.
    expect(pedir).toHaveBeenCalledTimes(2)
  })

  it('lo detecta tambien con filas sin id, comparando la pagina entera', async () => {
    // Sin `id` no se puede deduplicar fila por fila sin riesgo de tirar una
    // legitima, asi que la senal es que la pagina llego identica a la anterior.
    const pedir = vi.fn(async (): Promise<{ nombre: string }[]> =>
      Array.from({ length: TOPE_FILAS_SERVIDOR }, () => ({ nombre: 'Afinia' })),
    )
    const filas = await completarPaginas(pedir, { query: { limit: 500 } })
    expect(filas).toHaveLength(TOPE_FILAS_SERVIDOR)
    expect(pedir).toHaveBeenCalledTimes(2)
  })
})

describe('el tope de paginas', () => {
  it('no pide mas de MAX_PAGINAS aunque falten filas', async () => {
    // 5.000 filas es lo que pide CalendarioFallas: sin tope serían 50 llamadas
    // seguidas, peor que el bug que esto arregla.
    const { pedir } = servidorEnvuelto(5000)
    const cuerpo = await completarPaginas(pedir, { query: { size: 5000 } })
    expect(pedir).toHaveBeenCalledTimes(MAX_PAGINAS)
    expect(cuerpo.items).toHaveLength(MAX_PAGINAS * TOPE_FILAS_SERVIDOR)
  })
})
