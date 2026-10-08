/**
 * Los agregados del precio de bolsa: lo que de verdad se mira de un mes.
 *
 * El backend devuelve el detalle hora por hora; de ahí salen el último precio,
 * los promedios y la serie diaria. Todo es aritmética sobre las horas que HAY:
 * un mes en curso tiene días incompletos y no por eso el promedio es inválido.
 *
 * La regla que más importa: **nunca se rellena una hora que falta.** Promediar
 * sobre las que existen es honesto; inventar un cero o repetir la anterior
 * mueve el número sin que nadie se entere.
 */
import { describe, expect, it } from 'vitest'
import { promedio, resumirBolsa, serieDiaria, ultimoPrecio, variacion } from './bolsaResumen'

/** Tres días: 2 horas, 2 horas y 1 hora. */
const DETALLE = {
  '2026-09-01': { '00': 100, '01': 200 },
  '2026-09-02': { '00': 300, '01': 500 },
  '2026-09-03': { '00': 900 },
}

describe('serieDiaria', () => {
  it('promedia cada día sobre las horas que tiene', () => {
    expect(serieDiaria(DETALLE)).toEqual([
      { dia: '2026-09-01', promedio: 150, horas: 2 },
      { dia: '2026-09-02', promedio: 400, horas: 2 },
      { dia: '2026-09-03', promedio: 900, horas: 1 },
    ])
  })

  it('viene ordenada por fecha aunque el objeto no lo esté', () => {
    const revuelto = { '2026-09-03': { '00': 1 }, '2026-09-01': { '00': 2 } }
    expect(serieDiaria(revuelto).map((d) => d.dia)).toEqual(['2026-09-01', '2026-09-03'])
  })

  it('un día sin horas no entra', () => {
    expect(serieDiaria({ '2026-09-01': {} })).toEqual([])
  })

  it('sin detalle devuelve serie vacía', () => {
    expect(serieDiaria({})).toEqual([])
  })
})

describe('ultimoPrecio', () => {
  it('es la última hora del último día con datos', () => {
    expect(ultimoPrecio(DETALLE)).toEqual({ dia: '2026-09-03', hora: '00', precio: 900 })
  })

  it('toma la hora más alta, no la última escrita', () => {
    const d = { '2026-09-01': { '05': 50, '02': 20 } }
    expect(ultimoPrecio(d)).toEqual({ dia: '2026-09-01', hora: '05', precio: 50 })
  })

  it('sin datos es null', () => {
    expect(ultimoPrecio({})).toBeNull()
  })
})

describe('promedio', () => {
  it('promedia las horas de los días pedidos', () => {
    // 1 y 2 de septiembre: (100+200+300+500) / 4
    expect(promedio(DETALLE, ['2026-09-01', '2026-09-02'])).toBe(275)
  })

  it('pondera por HORA, no por día', () => {
    // Un día de 1 hora no pesa lo mismo que uno de 2: (900+100+200)/3 = 400.
    // Promediar los promedios diarios daría 525, que sería otro número.
    expect(promedio(DETALLE, ['2026-09-01', '2026-09-03'])).toBe(400)
  })

  it('ignora los días que no existen en vez de contarlos como cero', () => {
    expect(promedio(DETALLE, ['2026-09-01', '2026-12-25'])).toBe(150)
  })

  it('sin horas devuelve null, no cero', () => {
    // Cero es un precio; «no hay dato» no lo es.
    expect(promedio(DETALLE, [])).toBeNull()
    expect(promedio({}, ['2026-09-01'])).toBeNull()
  })
})

describe('variacion', () => {
  it('es el cambio porcentual contra el valor anterior', () => {
    expect(variacion(110, 100)).toBe(10)
    expect(variacion(90, 100)).toBe(-10)
  })

  it('sin alguno de los dos no hay variación', () => {
    expect(variacion(100, null)).toBeNull()
    expect(variacion(null, 100)).toBeNull()
  })

  it('contra cero no se divide', () => {
    // Infinito no es una variación que se pueda mostrar.
    expect(variacion(100, 0)).toBeNull()
  })
})

describe('resumirBolsa', () => {
  const r = resumirBolsa(DETALLE, null)

  it('trae el último precio y la serie', () => {
    expect(r.ultimo?.precio).toBe(900)
    expect(r.serie).toHaveLength(3)
  })

  it('el máximo y el mínimo vienen con su hora', () => {
    expect(r.maximo).toEqual({ dia: '2026-09-03', hora: '00', precio: 900 })
    expect(r.minimo).toEqual({ dia: '2026-09-01', hora: '00', precio: 100 })
  })

  it('los últimos 7 días se comparan contra los 7 anteriores', () => {
    // Con 3 días solo hay ventana reciente: la anterior queda vacía y no hay
    // variación que mostrar.
    expect(r.promedio7d).toBe(400) // las 5 horas del mes
    expect(r.variacion7d).toBeNull()
  })

  it('la variación mensual necesita el mes anterior', () => {
    expect(r.variacionMes).toBeNull()
    const conPrevio = resumirBolsa(DETALLE, { '2026-08-31': { '00': 200 } })
    expect(conPrevio.promedioMesPrevio).toBe(200)
    expect(conPrevio.variacionMes).toBe(100) // 400 vs 200
  })

  it('un mes vacío no rompe nada', () => {
    const vacio = resumirBolsa({}, null)
    expect(vacio.ultimo).toBeNull()
    expect(vacio.promedioMes).toBeNull()
    expect(vacio.serie).toEqual([])
  })
})
