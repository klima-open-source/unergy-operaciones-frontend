/**
 * Vigencia de la indexación de un contrato de Representación/CGM.
 *
 * El bug que motivó estas pruebas: `RepresentacionView.vue` marcaba como
 * "Vigente" un aniversario que todavía no había llegado, y su tarjeta de
 * encabezado mostraba la tarifa indexada en vez de la que se cobra hoy. La
 * condición unía las dos formas de comparar con un `||`:
 *
 *     etiquetaAnio(fila) <= hoy || String(anio(fila)) <= hoy.slice(0, 4)
 *
 * La segunda rama evalúa `"2026" <= "2026"` para cualquier fila del año en
 * curso, así que siempre daba verdadero. Con un contrato firmado el 22 de
 * diciembre de 2025, en septiembre de 2026 ya mostraba la tarifa de diciembre.
 *
 * Las ramas son EXCLUYENTES: con fecha de firma se compara la fecha completa
 * del aniversario; sin ella solo se puede comparar el año. Es el mismo arreglo
 * que ya tenía `legacy/src/utils/tarifasCgm.js`, perdido al reescribir la vista.
 */
import { describe, expect, it } from 'vitest'

import {
  estadoFilaIndexacion,
  fechaAniversario,
  indiceVigente,
  ordenarIndexacion,
  valorVigente,
} from './tarifasCgm'
import { EstadoFilaIndexacion, type EntradaIndexacion } from './types'

// El contrato de la captura del bug: firmado el 22-dic-2025, un aniversario.
const FIRMA = '2025-12-22'
const FILAS: EntradaIndexacion[] = [
  { año: 2025, ipc: null, valor: 5.5, esBase: true },
  { año: 2026, ipc: 5.1, valor: 5.7805 },
]

describe('indiceVigente', () => {
  it('no cuenta un aniversario que todavía no llega', () => {
    // Regresión: hoy 2026-09-10, aniversario 2026-12-22 -> sigue vigente la base.
    expect(indiceVigente(FILAS, FIRMA, '2026-09-10')).toBe(0)
  })

  it('no cuenta el aniversario ni el día anterior', () => {
    expect(indiceVigente(FILAS, FIRMA, '2026-12-21')).toBe(0)
  })

  it('lo cuenta el mismo día del aniversario', () => {
    expect(indiceVigente(FILAS, FIRMA, '2026-12-22')).toBe(1)
  })

  it('lo sigue contando después', () => {
    expect(indiceVigente(FILAS, FIRMA, '2027-03-01')).toBe(1)
  })

  it('sin fecha de firma solo puede comparar el año', () => {
    // Sin firma no hay mes/día que comparar: el año en curso cuenta como
    // alcanzado. Es la rama de respaldo, y por eso NO puede ir con `||`.
    expect(indiceVigente(FILAS, null, '2026-09-10')).toBe(1)
  })

  it('devuelve -1 cuando ningún aniversario llegó', () => {
    expect(indiceVigente(FILAS, FIRMA, '2024-01-01')).toBe(-1)
  })
})

describe('valorVigente', () => {
  it('da la tarifa que se cobra hoy, no la del aniversario futuro', () => {
    expect(valorVigente(FILAS, FIRMA, null, '2026-09-10')).toBe(5.5)
  })

  it('da la indexada una vez cumplido el aniversario', () => {
    expect(valorVigente(FILAS, FIRMA, null, '2026-12-22')).toBe(5.7805)
  })

  it('cae a la tarifa base del contrato si no hay filas cargadas', () => {
    expect(valorVigente([], FIRMA, 4.2, '2026-09-10')).toBe(4.2)
    expect(valorVigente(null, FIRMA, 4.2, '2026-09-10')).toBe(4.2)
  })

  it('es null sin filas y sin tarifa base', () => {
    expect(valorVigente([], FIRMA, null, '2026-09-10')).toBeNull()
  })
})

describe('estadoFilaIndexacion', () => {
  it('marca la base como vigente y el aniversario futuro como pendiente', () => {
    expect(estadoFilaIndexacion(FILAS, 0, FIRMA, '2026-09-10')).toBe(EstadoFilaIndexacion.VIGENTE)
    expect(estadoFilaIndexacion(FILAS, 1, FIRMA, '2026-09-10')).toBe(EstadoFilaIndexacion.PENDIENTE)
  })

  it('marca como pagado lo que quedó atrás', () => {
    expect(estadoFilaIndexacion(FILAS, 0, FIRMA, '2026-12-22')).toBe(EstadoFilaIndexacion.PAGADO)
    expect(estadoFilaIndexacion(FILAS, 1, FIRMA, '2026-12-22')).toBe(EstadoFilaIndexacion.VIGENTE)
  })
})

describe('fechaAniversario', () => {
  it('deriva mes y día de la firma', () => {
    expect(fechaAniversario(FILAS[1], FIRMA)).toBe('2026-12-22')
  })

  it('sin firma devuelve solo el año', () => {
    expect(fechaAniversario(FILAS[1], null)).toBe('2026')
  })

  it('devuelve vacío si la fila no tiene año', () => {
    expect(fechaAniversario({ valor: 1 }, FIRMA)).toBe('')
  })
})

describe('ordenarIndexacion', () => {
  it('ordena por año y tolera la clave sin tilde', () => {
    const desordenadas: EntradaIndexacion[] = [
      { anio: 2027, valor: 3 },
      { año: 2025, valor: 1 },
      { año: 2026, valor: 2 },
    ]
    expect(ordenarIndexacion(desordenadas).map((f) => f.valor)).toEqual([1, 2, 3])
  })

  it('devuelve [] ante null', () => {
    expect(ordenarIndexacion(null)).toEqual([])
  })

  it('no muta la lista que recibe', () => {
    const original: EntradaIndexacion[] = [
      { año: 2027, valor: 2 },
      { año: 2025, valor: 1 },
    ]
    ordenarIndexacion(original)
    expect(original.map((f) => f.valor)).toEqual([2, 1])
  })
})
