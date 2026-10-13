/**
 * Los agregados de una consulta al SIMEM: KPIs y total por día.
 *
 * Replica lo que hacía la herramienta suelta: cuántos registros, el total de la
 * columna elegida, cuántas plantas tuvieron valor distinto de cero, y la serie
 * diaria que alimenta la gráfica y el «CSV diario».
 *
 * Las columnas no son fijas —cada dataset trae las suyas y el SIMEM las cambia—
 * así que la de fecha y las numéricas se detectan.
 */
import { describe, expect, it } from 'vitest'
import { columnaDeFecha, columnasNumericas, kpisDe, totalesPorDia, unidadDe } from './simemResumen'

const FILAS = [
  { FechaHora: '2026-09-01 00:00', CodigoPlanta: 'A', Valor: 10, UnidadMedida: 'kWh' },
  { FechaHora: '2026-09-01 01:00', CodigoPlanta: 'A', Valor: 5, UnidadMedida: 'kWh' },
  { FechaHora: '2026-09-02 00:00', CodigoPlanta: 'B', Valor: 0, UnidadMedida: 'kWh' },
  { FechaHora: '2026-09-02 01:00', CodigoPlanta: 'C', Valor: 7, UnidadMedida: 'kWh' },
]

describe('columnaDeFecha', () => {
  it.each(['FechaHora', 'FechaInicio', 'Fecha'])('reconoce %s', (c) => {
    expect(columnaDeFecha([c, 'Valor'])).toBe(c)
  })

  it('prefiere FechaHora cuando hay varias', () => {
    // Es la más específica: con `Fecha` sola se perderían las horas.
    expect(columnaDeFecha(['Fecha', 'FechaHora'])).toBe('FechaHora')
  })

  it('sin columna de fecha devuelve null', () => {
    expect(columnaDeFecha(['CodigoPlanta', 'Valor'])).toBeNull()
  })
})

describe('columnasNumericas', () => {
  it('encuentra las que traen números', () => {
    expect(columnasNumericas(FILAS)).toEqual(['Valor'])
  })

  it('no confunde un código numérico de texto con una medida', () => {
    // `Version` o `CodigoDuracion` no se suman aunque parezcan números.
    const filas = [{ Version: 'TX1', CodigoDuracion: 'P1D', Valor: 3 }]
    expect(columnasNumericas(filas)).toEqual(['Valor'])
  })

  it('sin filas no hay columnas', () => {
    expect(columnasNumericas([])).toEqual([])
  })
})

describe('totalesPorDia', () => {
  it('suma la columna por día', () => {
    expect(totalesPorDia(FILAS, 'FechaHora', 'Valor')).toEqual([
      { dia: '2026-09-01', valor: 15 },
      { dia: '2026-09-02', valor: 7 },
    ])
  })

  it('viene ordenado por fecha', () => {
    const revuelto = [...FILAS].reverse()
    expect(totalesPorDia(revuelto, 'FechaHora', 'Valor').map((p) => p.dia))
      .toEqual(['2026-09-01', '2026-09-02'])
  })

  it('un día que suma cero SÍ aparece', () => {
    // Un día en cero es información; omitirlo lo haría parecer un hueco.
    const r = totalesPorDia([{ F: '2026-09-01', V: 0 }], 'F', 'V')
    expect(r).toEqual([{ dia: '2026-09-01', valor: 0 }])
  })

  it('los valores ilegibles no rompen la suma', () => {
    const r = totalesPorDia([{ F: '2026-09-01', V: 'n/a' }, { F: '2026-09-01', V: 4 }], 'F', 'V')
    expect(r).toEqual([{ dia: '2026-09-01', valor: 4 }])
  })

  it('sin columna de fecha o de valor no hay serie', () => {
    expect(totalesPorDia(FILAS, null, 'Valor')).toEqual([])
    expect(totalesPorDia(FILAS, 'FechaHora', null)).toEqual([])
  })
})

describe('kpisDe', () => {
  const k = kpisDe(FILAS, 'Valor', 'CodigoPlanta')

  it('cuenta los registros', () => {
    expect(k.registros).toBe(4)
  })

  it('suma el total de la columna', () => {
    expect(k.total).toBe(22)
  })

  it('cuenta las plantas con valor distinto de cero', () => {
    // B quedó en cero: no «generó».
    expect(k.conValor).toBe(2)
    expect(k.plantas).toBe(3)
    expect(k.enCero).toBe(1)
  })

  it('sin columna de planta no hay conteo de plantas', () => {
    const sin = kpisDe(FILAS, 'Valor', null)
    expect(sin.plantas).toBeNull()
    expect(sin.registros).toBe(4)
  })

  it('sin columna de valor el total es null, no cero', () => {
    expect(kpisDe(FILAS, null, 'CodigoPlanta').total).toBeNull()
  })

  it('sin filas no inventa nada', () => {
    const vacio = kpisDe([], 'Valor', 'CodigoPlanta')
    expect(vacio.registros).toBe(0)
    expect(vacio.total).toBe(0)
  })
})

describe('unidadDe', () => {
  it('toma la unidad de la primera fila que la traiga', () => {
    expect(unidadDe(FILAS)).toBe('kWh')
  })

  it('si el dataset mezcla unidades no afirma ninguna', () => {
    // Sumar kWh con COP y rotularlo con una sola unidad sería mentir.
    expect(unidadDe([{ UnidadMedida: 'kWh' }, { UnidadMedida: 'COP' }])).toBeNull()
  })

  it('sin columna de unidad devuelve null', () => {
    expect(unidadDe([{ Valor: 1 }])).toBeNull()
  })
})
