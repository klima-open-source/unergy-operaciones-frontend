/**
 * Cruzar las filas del SIMEM con el catálogo de plantas.
 *
 * Los datasets de OEF, disponibilidad y bolsa traen el código de la planta y
 * nada más: ni el nombre, ni la tecnología, ni la capacidad. Cruzarlos con el
 * catálogo (`capains`) es lo que permite filtrar por tecnología o por tamaño y
 * leer la tabla sin tener los códigos memorizados.
 *
 * La columna del código cambia de nombre entre datasets —`CodigoPlanta`,
 * `CodigoRecurso`, `CodigoCentral`— así que se detecta, no se fija.
 */
import { describe, expect, it } from 'vitest'
import type { PlantaSimem } from './simemAgentes'
import { columnaDePlanta, enriquecerFilas, filtrarPorPlanta } from './simemPlantas'

const CATALOGO: Record<string, PlantaSimem> = {
  '3A44': { ag: 'UNGG', nm: 'BAYUNCA I', kw: 990, tc: 'SOL', un: ['Uns07302'] },
  '2UX3': { ag: 'ABAG', nm: 'PCH AURES BAJO', kw: 19400, tc: 'AGUA', un: ['Unh09946', 'Unh09947'] },
}

describe('columnaDePlanta', () => {
  it.each(['CodigoPlanta', 'CodigoRecurso', 'CodigoCentral'])('reconoce %s', (col) => {
    expect(columnaDePlanta([col, 'Valor'])).toBe(col)
  })

  it('sin columna de planta devuelve null', () => {
    // No es un error: hay datasets por agente que no bajan a planta.
    expect(columnaDePlanta(['CodigoSICAgente', 'Valor'])).toBeNull()
  })

  it('la primera que aparezca gana, sin importar el orden', () => {
    expect(columnaDePlanta(['Valor', 'CodigoRecurso'])).toBe('CodigoRecurso')
  })
})

describe('enriquecerFilas', () => {
  const filas = [
    { CodigoPlanta: '3A44', Valor: 10 },
    { CodigoPlanta: '2UX3', Valor: 20 },
  ]

  it('pega nombre, tecnología y capacidad', () => {
    const r = enriquecerFilas(filas, CATALOGO)
    expect(r[0]!.planta).toEqual({
      codigo: '3A44', nombre: 'BAYUNCA I', tecnologia: 'SOL', capacidadKw: 990,
      agente: 'UNGG', unidades: ['Uns07302'], pls: 'Pls07301',
    })
  })

  it('conserva la fila original intacta', () => {
    // La tabla pinta las columnas del SIMEM tal cual; el enriquecido va aparte.
    expect(enriquecerFilas(filas, CATALOGO)[0]!.fila).toEqual(filas[0])
  })

  it('una planta que no está en el catálogo no se descarta', () => {
    // Perder filas por no reconocer un código sería peor que mostrarlas peladas.
    const r = enriquecerFilas([{ CodigoPlanta: 'XXXX', Valor: 1 }], CATALOGO)
    expect(r).toHaveLength(1)
    expect(r[0]!.planta).toBeNull()
  })

  it('sin columna de planta devuelve las filas sin enriquecer', () => {
    const r = enriquecerFilas([{ CodigoSICAgente: 'UNGG', Valor: 1 }], CATALOGO)
    expect(r[0]!.planta).toBeNull()
  })
})

describe('filtrarPorPlanta', () => {
  const filas = enriquecerFilas([
    { CodigoPlanta: '3A44', Valor: 10 },
    { CodigoPlanta: '2UX3', Valor: 20 },
    { CodigoPlanta: 'XXXX', Valor: 30 },
  ], CATALOGO)

  it('sin filtros no quita nada', () => {
    expect(filtrarPorPlanta(filas, {})).toHaveLength(3)
  })

  it('filtra por agente usando el catálogo, no la fila', () => {
    // Varios datasets traen solo el código de planta: sin el catálogo, filtrar
    // por agente no haría nada.
    expect(filtrarPorPlanta(filas, { agente: 'UNGG' }).map((x) => x.planta?.codigo))
      .toEqual(['3A44'])
  })

  it('el agente no distingue mayúsculas', () => {
    expect(filtrarPorPlanta(filas, { agente: 'ungg' })).toHaveLength(1)
  })

  it('filtra por tecnología', () => {
    const r = filtrarPorPlanta(filas, { tecnologia: 'SOL' })
    expect(r.map((x) => x.planta?.codigo)).toEqual(['3A44'])
  })

  it('filtra por capacidad mínima', () => {
    expect(filtrarPorPlanta(filas, { capMin: 1000 }).map((x) => x.planta?.codigo)).toEqual(['2UX3'])
  })

  it('filtra por capacidad máxima', () => {
    expect(filtrarPorPlanta(filas, { capMax: 1000 }).map((x) => x.planta?.codigo)).toEqual(['3A44'])
  })

  it('filtra por plantas elegidas', () => {
    expect(filtrarPorPlanta(filas, { codigos: new Set(['2UX3']) })
      .map((x) => x.planta?.codigo)).toEqual(['2UX3'])
  })

  it('el filtro por código mira el código CRUDO, no el catálogo', () => {
    // Si una planta sale en los datos y no está en el catálogo, pedirla por
    // código tiene que traerla igual: existe, solo no la conocemos.
    const r = filtrarPorPlanta(filas, { codigos: new Set(['XXXX']) })
    expect(r).toHaveLength(1)
    expect(r[0]!.planta).toBeNull()
  })

  it('una fila sin planta se cae de cualquier filtro de planta', () => {
    // Si no se sabe su tecnología ni su tamaño, no puede afirmarse que cumpla.
    expect(filtrarPorPlanta(filas, { tecnologia: 'SOL' }).some((x) => !x.planta)).toBe(false)
    expect(filtrarPorPlanta(filas, { capMin: 0 }).some((x) => !x.planta)).toBe(false)
  })

  it('pero sigue estando cuando no hay filtro de planta', () => {
    expect(filtrarPorPlanta(filas, {}).some((x) => !x.planta)).toBe(true)
  })

  it('los filtros se combinan', () => {
    expect(filtrarPorPlanta(filas, { tecnologia: 'AGUA', capMax: 1000 })).toEqual([])
  })
})
