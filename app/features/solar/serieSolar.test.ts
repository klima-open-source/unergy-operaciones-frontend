/**
 * El número de Generación Solar es el MISMO en escritorio y en móvil.
 *
 * Bug real (2026-09-07): la usuaria reportó que los valores no coincidían
 * entre la plataforma y la app móvil. No eran dos cálculos del mismo dato --
 * eran dos MAGNITUDES distintas, las dos correctas:
 *
 *   escritorio -> `5.995 kWh · hasta 15:30`   energía acumulada del día (eae)
 *   móvil      -> `312,0 kW`                  potencia instantánea (ap)
 *
 * Salió de un cambio del 2026-09-05: el número grande del escritorio pasó a
 * ser el acumulado del día (no se cae a cero de noche, que era el punto) y el
 * móvil se quedó con la potencia. Nada falló; simplemente cada pantalla
 * respondía una pregunta distinta sin decirlo.
 *
 * Es la SEGUNDA vez que estas dos vistas se separan leyendo el mismo endpoint.
 * La primera fue `gaia_snapshot_*` (ver detalleMonitoreo.guard.test.ts). Las
 * dos veces la causa fue la misma: la lógica estaba copiada en los dos
 * archivos y un cambio tocó una copia.
 *
 * Este test tiene dos mitades:
 *  · unitaria -- qué devuelven los acumulados compartidos, incluida la cadena
 *    de fallbacks de inversores, que es la parte que nadie querría duplicar;
 *  · de código fuente -- que ninguna de las dos vistas lea el campo crudo
 *    salteándose el helper, que es exactamente cómo volverían a divergir.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { acumuladoInversores, acumuladoMedidor, fmtKwh, hastaMedidor } from './serieSolar'

const RAIZ = join(__dirname, '..', '..', '..')

describe('acumuladoMedidor', () => {
  it('toma el contador del medidor que resolvió el backend', () => {
    expect(acumuladoMedidor({ medidor: { energia_kwh: 5995.3 } })).toBe(5995.3)
  })

  it('un cero no es un dato: el medidor no reportó', () => {
    expect(acumuladoMedidor({ medidor: { energia_kwh: 0 } })).toBeNull()
  })

  it('sin medidor devuelve null, no cero', () => {
    expect(acumuladoMedidor({})).toBeNull()
    expect(acumuladoMedidor(null)).toBeNull()
  })
})

describe('acumuladoInversores', () => {
  it('prefiere el total que calcula SolarView', () => {
    const detalle = {
      generation_today_kwh: 8107.8,
      generation_30d: [{ date: '2026-09-07', kwh: 1 }],
      power_curve: [
        { time: '10:00', kw: 500 },
        { time: '11:00', kw: 500 },
      ],
    }
    expect(acumuladoInversores(detalle, '2026-09-07')).toBe(8107.8)
  })

  it('cae al histórico de 30 días cuando el total de hoy no vino', () => {
    const detalle = {
      generation_today_kwh: null,
      generation_30d: [
        { date: '2026-09-06', kwh: 10 },
        { date: '2026-09-07', kwh: 7420.5 },
      ],
    }
    expect(acumuladoInversores(detalle, '2026-09-07')).toBe(7420.5)
  })

  it('último recurso: integra la curva de potencia por trapecios', () => {
    const detalle = {
      power_curve: [
        { time: '10:00', kw: 400 },
        { time: '11:00', kw: 600 },
      ],
    }
    // (400+600)/2 * 1h = 500 kWh
    expect(acumuladoInversores(detalle, '2026-09-07')).toBe(500)
  })

  it('con un solo punto no se puede integrar: null, no un número inventado', () => {
    expect(acumuladoInversores({ power_curve: [{ time: '10:00', kw: 400 }] })).toBeNull()
  })

  it('sin ninguna de las tres fuentes devuelve null', () => {
    expect(acumuladoInversores({}, '2026-09-07')).toBeNull()
  })
})

describe('formato y hora de corte', () => {
  it('fmtKwh usa separador de miles y una decimal', () => {
    expect(fmtKwh(5995.34)).toBe('5.995,3 kWh')
    expect(fmtKwh(null)).toBe('—')
  })

  it('hastaMedidor recorta el timestamp de Gaia a HH:MM', () => {
    expect(hastaMedidor({ medidor: { energia_hasta: '2026-09-07T15:30:00-05:00' } })).toBe('15:30')
    expect(hastaMedidor({ medidor: {} })).toBeNull()
  })
})

/**
 * Los campos crudos que NO se pueden leer directo desde una vista: cada uno
 * tiene su helper en serieSolar.js, y saltearselo es como divergieron.
 */
const CAMPOS_CON_HELPER = [
  'generation_today_kwh',
  'generation_today_hasta',
  'energia_kwh',
  'energia_hasta',
]

const VISTAS = [
  'app/features/solar/components/SolarLiveView.vue',
  'app/features/mobile/components/MobileSolarView.vue',
]

describe('las dos vistas pasan por el helper compartido', () => {
  for (const archivo of VISTAS) {
    it(`${archivo} no lee los campos crudos del acumulado`, () => {
      const fuente = readFileSync(join(RAIZ, archivo), 'utf8')
      const crudos = CAMPOS_CON_HELPER.filter((c) => fuente.includes(c))

      expect(
        crudos,
        `Lee ${crudos.join(', ')} directo del detalle en vez de usar ` +
          'acumuladoInversores / acumuladoMedidor / hastaInversores / hastaMedidor ' +
          'de ~/features/solar/serieSolar. Así es como el escritorio y el móvil ' +
          'terminaron mostrando magnitudes distintas (kWh vs kW) sin que nada fallara.',
      ).toEqual([])
    })
  }
})
