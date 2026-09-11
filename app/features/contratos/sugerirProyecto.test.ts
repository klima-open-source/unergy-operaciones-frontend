/**
 * Sugerencia de a qué planta pertenece un contrato de servicio.
 *
 * Existe porque en Operación hay contratos sin `proyecto_id` cuya única pista es
 * el nombre de la planta escrito en `prestador_nombre` (sí: en el campo del
 * proveedor) o en `nombre_proyecto_ref`.
 *
 * **La regla dura es que ante duda no se sugiere nada.** No es prudencia
 * abstracta: el seed de CGM ya asignó contratos a plantas ajenas y duplicó
 * registros por emparejar con criterio flojo, y hubo que escribir un
 * deduplicador para limpiarlo. El backend aprendió lo mismo — `om_match_seed`
 * devuelve `None` cuando hay más de un candidato — y acá se sigue ese criterio.
 *
 * Por eso "Chiriguana" no sugiere nada habiendo "Chiriguana 2" y "Chiriguana 4":
 * es mejor que la persona elija a que el sistema acierte de casualidad.
 */
import { describe, expect, it } from 'vitest'

import { normalizarNombrePlanta, sugerirProyecto } from './sugerirProyecto'

const PROYECTOS = [
  { id: 1, nombre_comercial: 'Minigranja Solar Uruaco', codigo_tsf: 'TSF-001' },
  { id: 2, nombre_comercial: 'Minigranja Solar Baraya', codigo_tsf: null },
  { id: 3, nombre_comercial: 'Minigranja Solar Cañahuate', codigo_tsf: null },
  { id: 4, nombre_comercial: 'Minigranja Solar Chiriguana 2', codigo_tsf: null },
  { id: 5, nombre_comercial: 'Minigranja Solar Chiriguana 4', codigo_tsf: null },
  { id: 6, nombre_comercial: 'MGS 0021 - El Molino', codigo_tsf: null },
]

describe('normalizarNombrePlanta', () => {
  it('quita las palabras genéricas del tipo de planta', () => {
    expect(normalizarNombrePlanta('Minigranja Solar Uruaco')).toBe('uruaco')
  })

  it('quita tildes y mayúsculas', () => {
    expect(normalizarNombrePlanta('MINIGRANJA SOLAR CAÑAHUATE')).toBe(
      normalizarNombrePlanta('Minigranja Solar Cañahuate'),
    )
  })

  it('conserva lo que distingue una planta de otra', () => {
    // "Norte" y "Occidente" no son ruido: son plantas distintas.
    expect(normalizarNombrePlanta('Minigranja Solar La Paz Norte')).toBe('la paz norte')
    expect(normalizarNombrePlanta('Minigranja Solar La Paz Occidente')).toBe('la paz occidente')
  })

  it('conserva el número que separa Chiriguana 2 de Chiriguana 4', () => {
    expect(normalizarNombrePlanta('Minigranja Solar Chiriguana 2')).toBe('chiriguana 2')
  })

  it('tolera vacío', () => {
    expect(normalizarNombrePlanta('')).toBe('')
  })
})

describe('sugerirProyecto', () => {
  it('empareja por código Sun Factory, que es la pista más fuerte', () => {
    const s = sugerirProyecto({ codigo_sun_factory: 'TSF-001' }, PROYECTOS)
    expect(s?.proyectoId).toBe(1)
    expect(s?.motivo).toContain('Sun Factory')
  })

  it('empareja por el nombre de planta que quedó en Prestador', () => {
    // El caso real de Operación: el proveedor dice "Minigranja Solar Baraya".
    const s = sugerirProyecto({ prestador_nombre: 'Minigranja Solar Baraya' }, PROYECTOS)
    expect(s?.proyectoId).toBe(2)
    expect(s?.motivo).toContain('Prestador')
  })

  it('empareja por el nombre de referencia del contrato', () => {
    const s = sugerirProyecto({ nombre_proyecto_ref: 'Minigranja Solar Cañahuate' }, PROYECTOS)
    expect(s?.proyectoId).toBe(3)
  })

  it('no se confunde con las tildes', () => {
    const s = sugerirProyecto({ prestador_nombre: 'MINIGRANJA SOLAR CANAHUATE' }, PROYECTOS)
    expect(s?.proyectoId).toBe(3)
  })

  it('NO sugiere nada si el nombre encaja con dos plantas', () => {
    // Con "Chiriguana 2" y "Chiriguana 4" cargadas, acertar sería casualidad.
    expect(
      sugerirProyecto({ prestador_nombre: 'Minigranja Solar Chiriguana' }, PROYECTOS),
    ).toBeNull()
  })

  it('NO sugiere nada con un proveedor real', () => {
    expect(sugerirProyecto({ prestador_nombre: 'Solenium S.A.S.' }, PROYECTOS)).toBeNull()
  })

  it('NO sugiere nada sin pistas', () => {
    expect(sugerirProyecto({}, PROYECTOS)).toBeNull()
    expect(sugerirProyecto({ prestador_nombre: '' }, PROYECTOS)).toBeNull()
  })

  it('NO sugiere nada si no hay plantas cargadas', () => {
    expect(sugerirProyecto({ prestador_nombre: 'Minigranja Solar Baraya' }, [])).toBeNull()
  })

  it('encuentra la planta aunque el proyecto traiga prefijo de código', () => {
    // "MGS 0021 - El Molino" contra "Minigranja Solar El Molino".
    const s = sugerirProyecto({ prestador_nombre: 'Minigranja Solar El Molino' }, PROYECTOS)
    expect(s?.proyectoId).toBe(6)
  })

  it('el código Sun Factory gana sobre el nombre', () => {
    const s = sugerirProyecto(
      { codigo_sun_factory: 'TSF-001', prestador_nombre: 'Minigranja Solar Baraya' },
      PROYECTOS,
    )
    expect(s?.proyectoId).toBe(1)
  })

  it('empareja por el número de cuatro dígitos del nombre de referencia', () => {
    const s = sugerirProyecto({ nombre_proyecto_ref: 'Planta 0021 del acta' }, PROYECTOS)
    expect(s?.proyectoId).toBe(6)
    expect(s?.motivo).toContain('0021')
  })
})
