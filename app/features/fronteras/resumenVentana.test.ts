/**
 * La parte del Resumen que decide el frontend: qué rango se le pide al backend
 * en cada período, cómo se ve cada fila, y qué dejan pasar los filtros.
 */
import { describe, expect, it } from 'vitest'

import {
  CategoriaDia,
  FiltroAutomatico,
  FiltroKpi,
  FiltroTipo,
  Periodo,
  aplicarFiltros,
  diasEntre,
  distribucion,
  etiquetaVentana,
  filaVista,
  formatearExcluidos,
  ordenarDia,
  ventana,
} from './resumenVentana'
import {
  CambioPeriodo,
  GrupoFuenteReporte,
  TipoFronteraReporte,
  type FilaResumenVentana,
} from './types'

const AYER = '2026-09-28'

function fila(parcial: Partial<FilaResumenVentana> = {}): FilaResumenVentana {
  return {
    frontera_id: 1,
    tipo: TipoFronteraReporte.GENERACION,
    nombre_proyecto: 'GD Garza',
    codigo_frontera: 'Frt0103528',
    dias_automaticos: 0,
    dias_no_automaticos: 0,
    tasa: 0,
    nunca_clasificado: false,
    fuente_dominante: null,
    fuente_dominante_etiqueta: null,
    desglose_fuente: [],
    fechas_excluidas: [],
    dias: [],
    cambio: null,
    ...parcial,
  }
}

const TODOS = {
  busqueda: '',
  tipo: FiltroTipo.TODOS,
  automatico: FiltroAutomatico.TODOS,
  kpi: null,
}

describe('ventana', () => {
  it('Día es un solo día, contado desde ayer', () => {
    expect(ventana(Periodo.DIA, 0, AYER)).toEqual({
      desde: AYER,
      hasta: AYER,
      fechas: [AYER],
    })
    expect(ventana(Periodo.DIA, -1, AYER).desde).toBe('2026-09-27')
  })

  it('Semana son los 7 días que terminan en la referencia, corridos de a 7', () => {
    const actual = ventana(Periodo.SEMANA, 0, AYER)
    expect([actual.desde, actual.hasta]).toEqual(['2026-09-22', AYER])
    expect(actual.fechas).toHaveLength(7)

    const anterior = ventana(Periodo.SEMANA, -1, AYER)
    expect([anterior.desde, anterior.hasta]).toEqual(['2026-09-15', '2026-09-21'])
  })

  it('el mes actual llega solo hasta ayer; uno anterior va completo', () => {
    const actual = ventana(Periodo.MES, 0, AYER)
    expect([actual.desde, actual.hasta]).toEqual(['2026-09-01', AYER])

    const agosto = ventana(Periodo.MES, -1, AYER)
    expect([agosto.desde, agosto.hasta]).toEqual(['2026-08-01', '2026-08-31'])
    expect(agosto.fechas).toHaveLength(31)
  })

  it('cruza el año sin correrse', () => {
    const diciembre = ventana(Periodo.MES, -1, '2027-01-15')
    expect([diciembre.desde, diciembre.hasta]).toEqual(['2026-12-01', '2026-12-31'])
  })

  it('diasEntre deshace el offset de Día', () => {
    expect(diasEntre(AYER, '2026-09-24')).toBe(-4)
    expect(ventana(Periodo.DIA, diasEntre(AYER, '2026-09-24'), AYER).desde).toBe('2026-09-24')
  })
})

describe('etiquetas', () => {
  it('cada período se nombra como en la maqueta', () => {
    expect(etiquetaVentana(Periodo.DIA, ventana(Periodo.DIA, 0, AYER))).toBe(
      '28 de septiembre de 2026',
    )
    expect(etiquetaVentana(Periodo.SEMANA, ventana(Periodo.SEMANA, 0, AYER))).toBe(
      '22 sep – 28 sep, 2026',
    )
    expect(etiquetaVentana(Periodo.MES, ventana(Periodo.MES, 0, AYER))).toBe('Septiembre 2026')
  })

  it('los días excluidos se agrupan por mes', () => {
    expect(formatearExcluidos(['2026-10-01', '2026-09-05', '2026-09-06'])).toBe('5, 6 sep y 1 oct')
  })
})

describe('filaVista', () => {
  it('una frontera que dejó de aparecer muestra "Sin dato" en cada día del período', () => {
    const fechas = ventana(Periodo.SEMANA, 0, AYER).fechas
    const f = filaVista(fila({ nunca_clasificado: true }), Periodo.SEMANA, fechas)

    expect(f.categoria).toBe(CategoriaDia.SIN_DATO)
    expect(f.conTasa).toBe(false)
    expect(f.dias.map((d) => d.categoria)).toEqual(Array(7).fill(CategoriaDia.SIN_DATO))
    expect(f.esNuncaAutomatico).toBe(true)
  })

  it('una fila con todos sus días excluidos no tiene tasa: dice "Excluido"', () => {
    const f = filaVista(
      fila({
        fechas_excluidas: [AYER],
        dias: [
          {
            fecha: AYER,
            automatico: false,
            excluido: true,
            grupo_fuente: null,
            etiqueta_fuente: null,
          },
        ],
      }),
      Periodo.SEMANA,
      [],
    )

    expect(f.categoria).toBe(CategoriaDia.EXCLUIDO)
    expect(f.conTasa).toBe(false)
    expect(f.esNuncaAutomatico).toBe(false)
  })

  it('en Semana o Mes una fila con días que cuentan muestra la barra', () => {
    const f = filaVista(
      fila({ dias_automaticos: 5, dias_no_automaticos: 2, tasa: 71.4 }),
      Periodo.MES,
      [],
    )

    expect(f.conTasa).toBe(true)
    expect(f.categoria).toBe(CategoriaDia.NO_AUTOMATICO)
  })

  it('en Día nunca hay barra: es una etiqueta', () => {
    const f = filaVista(fila({ dias_automaticos: 1, tasa: 100 }), Periodo.DIA, [AYER])

    expect(f.conTasa).toBe(false)
    expect(f.categoria).toBe(CategoriaDia.AUTOMATICO)
  })
})

describe('ordenarDia', () => {
  it('primero lo que hay que mirar: sin dato, no automático, excluido, automático', () => {
    const auto = filaVista(fila({ frontera_id: 1, dias_automaticos: 1, tasa: 100 }), Periodo.DIA, [
      AYER,
    ])
    const excluida = filaVista(fila({ frontera_id: 2 }), Periodo.DIA, [AYER])
    const manual = filaVista(fila({ frontera_id: 3, dias_no_automaticos: 1 }), Periodo.DIA, [AYER])
    const sinDato = filaVista(fila({ frontera_id: 4, nunca_clasificado: true }), Periodo.DIA, [
      AYER,
    ])

    expect(ordenarDia([auto, excluida, manual, sinDato]).map((f) => f.fila.frontera_id)).toEqual([
      4, 3, 2, 1,
    ])
  })
})

describe('aplicarFiltros', () => {
  const siempre = filaVista(
    fila({ frontera_id: 1, dias_automaticos: 7, tasa: 100 }),
    Periodo.SEMANA,
    [],
  )
  const nunca = filaVista(
    fila({
      frontera_id: 2,
      tipo: TipoFronteraReporte.CONSUMO,
      nombre_proyecto: 'GD Agustín 3',
      codigo_frontera: 'Frt0103531',
      dias_no_automaticos: 7,
    }),
    Periodo.SEMANA,
    [],
  )
  const filas = [siempre, nunca]

  it('busca por proyecto y por código de frontera, sin importar mayúsculas', () => {
    expect(aplicarFiltros(filas, { ...TODOS, busqueda: 'agustín' })).toEqual([nunca])
    expect(aplicarFiltros(filas, { ...TODOS, busqueda: 'frt0103528' })).toEqual([siempre])
  })

  it('filtra por tipo', () => {
    expect(aplicarFiltros(filas, { ...TODOS, tipo: FiltroTipo.CONSUMO })).toEqual([nunca])
  })

  it('filtra por automático y por las tarjetas KPI', () => {
    expect(aplicarFiltros(filas, { ...TODOS, automatico: FiltroAutomatico.AUTOMATICO })).toEqual([
      siempre,
    ])
    expect(aplicarFiltros(filas, { ...TODOS, kpi: FiltroKpi.NUNCA })).toEqual([nunca])
    expect(aplicarFiltros(filas, { ...TODOS, kpi: FiltroKpi.SIEMPRE })).toEqual([siempre])
  })
})

describe('filtro por cambio contra el período anterior', () => {
  const sube = filaVista(fila({ frontera_id: 1, cambio: CambioPeriodo.MEJORO }), Periodo.SEMANA, [])
  const baja = filaVista(
    fila({ frontera_id: 2, cambio: CambioPeriodo.EMPEORO }),
    Periodo.SEMANA,
    [],
  )
  const quieta = filaVista(fila({ frontera_id: 3 }), Periodo.SEMANA, [])
  const filas = [sube, baja, quieta]

  it('"Mejoraron" deja solo las que mejoraron', () => {
    expect(aplicarFiltros(filas, { ...TODOS, kpi: FiltroKpi.MEJORARON })).toEqual([sube])
  })

  it('"Empeoraron" deja solo las que empeoraron', () => {
    expect(aplicarFiltros(filas, { ...TODOS, kpi: FiltroKpi.EMPEORARON })).toEqual([baja])
  })
})

describe('distribucion', () => {
  function dia(fecha: string, grupo: GrupoFuenteReporte | null, etiqueta: string | null) {
    return {
      fecha,
      automatico: grupo === null,
      excluido: false,
      grupo_fuente: grupo,
      etiqueta_fuente: etiqueta,
    }
  }

  it('cuenta días-frontera por fuente, de mayor a menor', () => {
    const f = filaVista(
      fila({
        dias: [
          dia('2026-09-26', null, null),
          dia('2026-09-27', GrupoFuenteReporte.MEDIDOR, 'Medidor'),
          dia('2026-09-28', GrupoFuenteReporte.MEDIDOR, 'Medidor'),
        ],
      }),
      Periodo.SEMANA,
      [],
    )

    expect(distribucion([f], TODOS).map((g) => [g.etiqueta, g.dias, g.pct])).toEqual([
      ['Medidor', 2, 67],
      ['Automático', 1, 33],
    ])
  })

  it('un empate lo gana lo automático, y después el orden de confianza', () => {
    const f = filaVista(
      fila({
        dias: [
          dia('2026-09-27', GrupoFuenteReporte.ESTIMACION, 'Estimación'),
          dia('2026-09-28', null, null),
        ],
      }),
      Periodo.SEMANA,
      [],
    )

    expect(distribucion([f], TODOS).map((g) => g.etiqueta)).toEqual(['Automático', 'Estimación'])
  })

  it('respeta el filtro de tipo', () => {
    const consumo = filaVista(
      fila({ tipo: TipoFronteraReporte.CONSUMO, dias: [dia(AYER, null, null)] }),
      Periodo.SEMANA,
      [],
    )

    expect(distribucion([consumo], { busqueda: '', tipo: FiltroTipo.GENERACION })).toEqual([])
  })
})
