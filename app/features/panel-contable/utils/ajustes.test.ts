/**
 * El panel de ajuste de una reliquidación.
 *
 * El ER de la reliquidación ya trae la diferencia contra la versión anterior, así
 * que acá no se resta nada. Lo que estas pruebas fijan es qué se contabiliza —
 * solo ingresos y comercialización, sin OPEX ni facturas— y que el tipo del
 * panel lleve la versión, que es lo que permite que un mes reliquidado dos veces
 * tenga un panel por cada una.
 */
import { describe, expect, it } from 'vitest'
import { GrupoLinea, TipoPanel, VersionAjuste } from '~/features/panel-contable/types'
import type { LineaPanel } from '~/features/panel-contable/types'
import {
  ajusteEnCero,
  esAjuste,
  lineasDe,
  lineasDeAjuste,
  sumar,
  tipoDeAjuste,
  tipoDeDatos,
  versionDeAjuste,
} from './ajustes'

const linea = (grupo: GrupoLinea, concepto: string, valor: number | undefined): LineaPanel =>
  ({ id: 0, grupo, concepto, valor_cop: valor })

const LINEAS: LineaPanel[] = [
  linea(GrupoLinea.INGRESOS, 'Ingreso Bruto ENEL', 510_000),
  linea(GrupoLinea.COMERCIALIZACION, 'Administración', -19_380),
  linea(GrupoLinea.COSTOS, 'Mantenimiento', -800_000),
  linea(GrupoLinea.FACTURAS, 'Factura de servicio', 90_000),
]

describe('qué contabiliza un ajuste', () => {
  it('solo ingresos y comercialización', () => {
    expect(lineasDeAjuste(LINEAS).map((l) => l.grupo)).toEqual([
      GrupoLinea.INGRESOS,
      GrupoLinea.COMERCIALIZACION,
    ])
  })

  it('el OPEX no entra', () => {
    // Los costos operativos se causaron en la liquidación original.
    expect(lineasDeAjuste(LINEAS).some((l) => l.grupo === GrupoLinea.COSTOS)).toBe(false)
  })

  it('las facturas de servicio tampoco', () => {
    // Un ajuste no emite factura.
    expect(lineasDeAjuste(LINEAS).some((l) => l.grupo === GrupoLinea.FACTURAS)).toBe(false)
  })

  it('conserva el orden original', () => {
    expect(lineasDeAjuste(LINEAS).map((l) => l.concepto)).toEqual([
      'Ingreso Bruto ENEL', 'Administración',
    ])
  })
})

describe('sumar', () => {
  it('suma con signo, no resta grupos', () => {
    // Los costos ya vienen negativos; restarlos otra vez inflaría el total.
    expect(sumar(lineasDeAjuste(LINEAS))).toBe(490_620)
  })

  it('una línea sin valor cuenta como cero y no rompe la suma', () => {
    expect(sumar([linea(GrupoLinea.INGRESOS, 'Sin valor', undefined)])).toBe(0)
  })

  it('sin líneas da cero', () => {
    expect(sumar([])).toBe(0)
  })
})

describe('lineasDe', () => {
  it('filtra por grupo', () => {
    expect(lineasDe(LINEAS, GrupoLinea.COMERCIALIZACION).map((l) => l.concepto))
      .toEqual(['Administración'])
  })
})

describe('ajusteEnCero', () => {
  it('un ajuste que no movió nada se reconoce', () => {
    expect(ajusteEnCero([
      linea(GrupoLinea.INGRESOS, 'Ingreso Bruto', 0),
      linea(GrupoLinea.COMERCIALIZACION, 'CGM', 0),
    ])).toBe(true)
  })

  it('un costo distinto de cero NO lo saca de cero', () => {
    // El OPEX no se contabiliza en un ajuste: no puede hacer que el proyecto
    // aparezca como si tuviera algo que registrar.
    expect(ajusteEnCero([
      linea(GrupoLinea.INGRESOS, 'Ingreso Bruto', 0),
      linea(GrupoLinea.COSTOS, 'Mantenimiento', -800_000),
    ])).toBe(true)
  })

  it('con un solo valor distinto de cero, ya no está en cero', () => {
    expect(ajusteEnCero([linea(GrupoLinea.INGRESOS, 'Ingreso Bruto', -1)])).toBe(false)
  })
})

describe('el tipo del panel', () => {
  it('lleva la versión dentro', () => {
    expect(tipoDeAjuste(VersionAjuste.TX3)).toBe('ajuste_tx3')
  })

  it('dos reliquidaciones del mismo mes no se pisan', () => {
    expect(tipoDeAjuste(VersionAjuste.TX3)).not.toBe(tipoDeAjuste(VersionAjuste.TX4))
  })

  it('se puede volver a leer la versión', () => {
    expect(versionDeAjuste('ajuste_tx4')).toBe(VersionAjuste.TX4)
  })

  it('el oficial no es un ajuste', () => {
    expect(esAjuste(TipoPanel.OFICIAL)).toBe(false)
    expect(versionDeAjuste(TipoPanel.OFICIAL)).toBeNull()
  })

  it('txf no genera ajuste: es la liquidación inicial, no una reliquidación', () => {
    expect(esAjuste('ajuste_txf')).toBe(false)
  })

  it('una versión inventada no es un ajuste', () => {
    expect(esAjuste('ajuste_tx99')).toBe(false)
  })
})

describe('tipoDeDatos', () => {
  it('en la pestaña de ajustes manda la versión', () => {
    expect(tipoDeDatos(true, VersionAjuste.TX3, TipoPanel.OFICIAL)).toBe('ajuste_tx3')
  })

  it('fuera de la pestaña de ajustes la versión se ignora', () => {
    // Si se colara, pediría el panel equivocado al cambiar de pestaña.
    expect(tipoDeDatos(false, VersionAjuste.TX3, TipoPanel.OFICIAL)).toBe(TipoPanel.OFICIAL)
    expect(tipoDeDatos(false, VersionAjuste.TX3, TipoPanel.PRELIQUIDACION))
      .toBe(TipoPanel.PRELIQUIDACION)
  })
})
