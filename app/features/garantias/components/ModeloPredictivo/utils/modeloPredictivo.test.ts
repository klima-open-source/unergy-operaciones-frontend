import { describe, expect, it } from 'vitest'
import { FetchError } from 'ofetch'
import {
  fechaCorta,
  generacionAtrasada,
  insumoContaminado,
  mensajeError,
  nombreMes,
  rangoCorto,
} from './modeloPredictivo'

describe('generacionAtrasada', () => {
  it('es atrasada cuando los días de atraso superan el umbral', () => {
    expect(
      generacionAtrasada({ fecha_dato_generacion: '2026-08-01', dias_atraso: 5, umbral_dias: 3 }),
    ).toBe(true)
  })

  it('no es atrasada si está dentro del umbral', () => {
    expect(
      generacionAtrasada({ fecha_dato_generacion: '2026-08-01', dias_atraso: 2, umbral_dias: 3 }),
    ).toBe(false)
  })

  it('sin frescura, no hay atraso que reportar', () => {
    expect(generacionAtrasada(null)).toBe(false)
    expect(generacionAtrasada(undefined)).toBe(false)
  })
})

describe('insumoContaminado', () => {
  it('tx2 es la versión limpia', () => {
    expect(insumoContaminado({ tipo: 'liquidacion', version: 'tx2', rango: '', dias: 0 })).toBe(
      false,
    )
  })

  it('cualquier otra versión está contaminada', () => {
    expect(insumoContaminado({ tipo: 'liquidacion', version: 'tx3', rango: '', dias: 0 })).toBe(
      true,
    )
  })

  it('sin insumo, no hay nada que contaminar', () => {
    expect(insumoContaminado(null)).toBe(false)
  })
})

describe('nombreMes', () => {
  it('capitaliza el mes y conserva el año', () => {
    expect(nombreMes('2026-09')).toBe('Septiembre 2026')
  })

  it('devuelve el crudo si el período no matchea', () => {
    expect(nombreMes('no-es-un-periodo')).toBe('no-es-un-periodo')
  })
})

describe('fechaCorta', () => {
  it('formatea sin pasar por Date, evitando corrimientos de zona horaria', () => {
    expect(fechaCorta('2026-08-28')).toBe('28 ago')
  })

  it('sin fecha, devuelve el guión', () => {
    expect(fechaCorta(null)).toBe('—')
    expect(fechaCorta(undefined)).toBe('—')
  })
})

describe('rangoCorto', () => {
  it('mismo mes: solo repite el mes una vez', () => {
    expect(rangoCorto('2026-08-01', '2026-08-07')).toBe('01–07 ago')
  })

  it('cruza de mes: muestra ambas fechas completas', () => {
    expect(rangoCorto('2026-07-25', '2026-08-07')).toBe('25 jul – 07 ago')
  })

  it('sin alguna de las dos fechas, devuelve el guión', () => {
    expect(rangoCorto(null, '2026-08-07')).toBe('—')
  })
})

describe('mensajeError', () => {
  it('usa el detail del backend cuando es un 4xx con mensaje propio', () => {
    const err = new FetchError('fail')
    Object.assign(err, { status: 404, data: { detail: 'No hay plan publicado para este agente' } })
    expect(mensajeError(err, 'fallback')).toBe('No hay plan publicado para este agente')
  })

  it('ignora el texto genérico de framework y usa el fallback', () => {
    const err = new FetchError('fail')
    Object.assign(err, { status: 404, data: { detail: 'Not Found' } })
    expect(mensajeError(err, 'fallback')).toBe('fallback')
  })

  it('un 5xx siempre usa el fallback, aunque traiga detail', () => {
    const err = new FetchError('fail')
    Object.assign(err, { status: 500, data: { detail: 'boom' } })
    expect(mensajeError(err, 'fallback')).toBe('fallback')
  })

  it('un error que no vino de un fetch usa el fallback', () => {
    expect(mensajeError(new Error('lo que sea'), 'fallback')).toBe('fallback')
  })
})
