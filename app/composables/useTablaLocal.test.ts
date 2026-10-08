import { nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { ordenarFilas, useTablaLocal, valorEnRuta } from './useTablaLocal'

describe('valorEnRuta', () => {
  it('lee campos anidados', () => {
    expect(valorEnRuta({ proyecto: { nombre: 'Baraya' } }, 'proyecto.nombre')).toBe('Baraya')
  })

  it('devuelve undefined si un tramo falta', () => {
    expect(valorEnRuta({ proyecto: null }, 'proyecto.nombre')).toBeUndefined()
  })
})

describe('ordenarFilas', () => {
  const filas = [
    { id: 1, n: 'beta', k: 10 },
    { id: 2, n: null, k: 2 },
    { id: 3, n: 'Álamo', k: null },
    { id: 4, n: 'alfa', k: 1 },
  ]

  it('ordena texto sin distinguir mayúsculas ni tildes, vacíos al final', () => {
    expect(ordenarFilas(filas, { key: 'n', direction: 'asc' }).map((f) => f.id)).toEqual([3, 4, 1, 2])
  })

  it('los vacíos siguen al final al invertir', () => {
    expect(ordenarFilas(filas, { key: 'n', direction: 'desc' }).map((f) => f.id)).toEqual([1, 4, 3, 2])
  })

  it('ordena números como números', () => {
    expect(ordenarFilas(filas, { key: 'k', direction: 'asc' }).map((f) => f.id)).toEqual([4, 2, 1, 3])
  })

  it('no cambia el arreglo original', () => {
    const copia = [...filas]
    ordenarFilas(filas, { key: 'k', direction: 'asc' })
    expect(filas).toEqual(copia)
  })
})

describe('useTablaLocal', () => {
  it('pagina y vuelve a la primera página cuando cambian las filas', async () => {
    const filas = ref(Array.from({ length: 5 }, (_, i) => ({ id: i + 1 })))
    const porPagina = ref(2)
    const t = useTablaLocal(filas, { key: 'id', direction: 'asc' }, porPagina)
    t.pagina.value = 3
    expect(t.filasPagina.value.map((f) => f.id)).toEqual([5])
    filas.value = filas.value.slice(0, 3)
    await nextTick()
    expect(t.pagina.value).toBe(1)
    expect(t.total.value).toBe(3)
  })
})
