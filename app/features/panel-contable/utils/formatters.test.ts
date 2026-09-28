/**
 * `fmt` es la única función que decide si una línea contable en cero se lee
 * como "sin valor" (`–`) o como un cero real, y `parseCeldaOrigen` es el único
 * punto que valida el formato `hoja!celda` antes de mandarlo a la API — ambos
 * casos donde una regresión silenciosa sería difícil de notar a simple vista.
 */
import { describe, expect, it } from 'vitest'
import { GrupoLinea } from '~/features/panel-contable/types'
import {
  arrow,
  diffClass,
  diffTextClass,
  fmt,
  lineasMapeables,
  montoPlano,
  parseCeldaOrigen,
  parseMonto,
} from './formatters'

// `Intl.NumberFormat('es-CO', { style: 'currency', ... })` separa el símbolo
// del monto con un espacio DURO (U+00A0), no uno normal — de ahí el escape.
const NBSP = ' '

describe('fmt', () => {
  it('formatea un valor positivo en pesos colombianos', () => {
    expect(fmt(1_234_567)).toBe(`$${NBSP}1.234.567`)
  })

  it('formatea un valor negativo con el signo antes del símbolo', () => {
    expect(fmt(-500)).toBe(`-$${NBSP}500`)
  })

  it('muestra un cero (o nulo) como "–", no como "$ 0"', () => {
    expect(fmt(0)).toBe('–')
    expect(fmt(null)).toBe('–')
    expect(fmt(undefined)).toBe('–')
  })

  it('redondea antes de formatear', () => {
    expect(fmt(999.6)).toBe(`$${NBSP}1.000`)
  })
})

describe('montoPlano / parseMonto', () => {
  it('monto plano vacío para null/undefined, el número como texto en otro caso', () => {
    expect(montoPlano(null)).toBe('')
    expect(montoPlano(undefined)).toBe('')
    expect(montoPlano(1500)).toBe('1500')
  })

  it('parsea de vuelta el número plano que edita el usuario (sin separador de miles)', () => {
    expect(parseMonto('1234567')).toBe(1234567)
    expect(parseMonto('-500')).toBe(-500)
    expect(parseMonto('1234567.5')).toBe(1234567.5)
  })

  it('un texto sin dígitos parsea a 0, nunca a NaN', () => {
    expect(parseMonto('abc')).toBe(0)
  })
})

describe('parseCeldaOrigen', () => {
  it('acepta el formato hoja!celda', () => {
    expect(parseCeldaOrigen('Sheet1!H35')).toEqual({ hoja: 'Sheet1', celda: 'H35' })
  })

  it('recorta espacios y pasa la celda a mayúsculas', () => {
    expect(parseCeldaOrigen(' Hoja 2 ! h35 ')).toEqual({ hoja: 'Hoja 2', celda: 'H35' })
  })

  it('rechaza un texto sin "!" o con una celda inválida', () => {
    expect(parseCeldaOrigen('Sheet1')).toBeNull()
    expect(parseCeldaOrigen('Sheet1!35')).toBeNull()
    expect(parseCeldaOrigen('')).toBeNull()
  })
})

describe('lineasMapeables', () => {
  it('solo incluye Ingresos/Comercialización no derivadas', () => {
    const lineas = [
      { id: 1, grupo: GrupoLinea.INGRESOS, concepto: 'Ingreso bruto' },
      { id: 2, grupo: GrupoLinea.COMERCIALIZACION, concepto: 'Representación' },
      { id: 3, grupo: GrupoLinea.COSTOS, concepto: 'O&M' },
      { id: 4, grupo: GrupoLinea.INGRESOS, concepto: 'IVA', derivada: true },
    ]
    expect(lineasMapeables(lineas).map((l) => l.concepto)).toEqual(['Ingreso bruto', 'Representación'])
  })
})

describe('diffClass / diffTextClass / arrow', () => {
  it('clasifica una diferencia como positiva, negativa o neutra', () => {
    expect(diffClass(100)).toBe('pos')
    expect(diffClass(-100)).toBe('neg')
    expect(diffClass(0)).toBe('')
    expect(diffClass(null)).toBe('')
  })

  it('traduce la clasificación a la clase Tailwind correspondiente', () => {
    expect(diffTextClass(100)).toBe('text-emerald-600')
    expect(diffTextClass(-100)).toBe('text-destructive')
    expect(diffTextClass(0)).toBe('')
  })

  it('la flecha solo aparece cuando hay una diferencia real', () => {
    expect(arrow(100)).toBe('▲ ')
    expect(arrow(-100)).toBe('▼ ')
    expect(arrow(0)).toBe('')
    expect(arrow(null)).toBe('')
  })
})
