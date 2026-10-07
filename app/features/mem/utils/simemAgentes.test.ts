/**
 * Códigos de agente del SIMEM: el catálogo de plantas cruzado con el registro
 * de agentes.
 *
 * Portado del HTML suelto `simem_unergy.html` que Jessica usaba por fuera de la
 * plataforma. Lo que se prueba acá es lo único que tiene reglas —derivar el Pls,
 * agrupar por agente y filtrar—; el pintado y la llamada a SIMEM no.
 *
 * La regla del Pls está verificada contra XM (4 de 4 en solares de una unidad):
 * el código `Pls` del SRC es el `Uns` del SIMEM **menos uno**. Solo aplica
 * cuando la planta tiene UNA sola unidad: con varias no hay correspondencia.
 */
import { describe, expect, it } from 'vitest'
import type { PlantaSimem } from './simemAgentes'
import { agentesDesdeCatalogo, filtrarAgentes, plsDe } from './simemAgentes'

const CATALOGO: Record<string, PlantaSimem> = {
  '3C3Z': { ag: 'AAGG', nm: 'LA SIERPE', kw: 19900, tc: 'SOL', un: ['Uns07305'] },
  '4T9M': { ag: 'BIAG', nm: 'GD NAOS II', kw: 960, tc: 'SOL', un: ['Uns52940'] },
  '2UX3': { ag: 'ABAG', nm: 'PCH AURES BAJO', kw: 19400, tc: 'AGUA', un: ['Unh09946', 'Unh09947'] },
  'UNG1': { ag: 'UNGG', nm: 'MGS EL MOLINO', kw: 1000, tc: 'SOL', un: ['Uns11111'] },
}

const AGENTES_SIMEM = {
  AAGG: { nombre: 'AAA GENERACIÓN S.A.S.', actividades: ['Generador'] },
  UNGG: { nombre: 'UNERGY ENERGIA DIGITAL S.A.S ESP', actividades: ['Generador', 'Comercializador'] },
}

function filas(filtros = {}) {
  return filtrarAgentes(
    agentesDesdeCatalogo(CATALOGO, AGENTES_SIMEM, new Set(['UNGG'])),
    { q: '', tecnologia: '', soloUnergy: false, actividad: '', ...filtros },
  )
}

// ── El código Pls ───────────────────────────────────────────────────────────

describe('plsDe', () => {
  it('resta uno al número del Uns', () => {
    expect(plsDe(['Uns07305'])).toBe('Pls07304')
  })

  it('conserva los ceros a la izquierda', () => {
    // 'Pls7304' no existe: el ancho del código es parte del código.
    expect(plsDe(['Uns07305'])).toHaveLength('Uns07305'.length)
    expect(plsDe(['Uns00001'])).toBe('Pls00000')
  })

  it('con varias unidades no hay Pls', () => {
    // La correspondencia es 1 a 1; con dos unidades no se sabe cuál sería.
    expect(plsDe(['Unh09946', 'Unh09947'])).toBe('')
  })

  it('solo aplica a los Uns, no a hidráulicas ni térmicas', () => {
    expect(plsDe(['Unh09946'])).toBe('')
    expect(plsDe(['Unt07345'])).toBe('')
  })

  it('sin unidades devuelve vacío', () => {
    expect(plsDe([])).toBe('')
    expect(plsDe(undefined)).toBe('')
  })
})

// ── Agrupar por agente ──────────────────────────────────────────────────────

describe('agentesDesdeCatalogo', () => {
  it('junta las plantas de cada agente', () => {
    const fila = filas().find((f) => f.codigo === 'AAGG')!
    expect(fila.plantas).toHaveLength(1)
    expect(fila.plantas[0]!.nombre).toBe('LA SIERPE')
  })

  it('suma la capacidad del agente', () => {
    expect(filas().find((f) => f.codigo === 'ABAG')!.capacidadKw).toBe(19400)
  })

  it('trae la razón social del registro del SIMEM', () => {
    expect(filas().find((f) => f.codigo === 'AAGG')!.nombre).toBe('AAA GENERACIÓN S.A.S.')
  })

  it('un agente con plantas pero sin registro se asume generador', () => {
    // BIAG no está en el registro; tiene plantas, así que genera.
    const fila = filas().find((f) => f.codigo === 'BIAG')!
    expect(fila.actividades).toEqual(['Generador'])
    expect(fila.nombre).toBe('—')
  })

  it('marca los agentes de Unergy', () => {
    expect(filas().find((f) => f.codigo === 'UNGG')!.esUnergy).toBe(true)
    expect(filas().find((f) => f.codigo === 'AAGG')!.esUnergy).toBe(false)
  })

  it('los de Unergy van primero', () => {
    expect(filas()[0]!.codigo).toBe('UNGG')
  })
})

// ── Filtros ─────────────────────────────────────────────────────────────────

describe('filtrarAgentes', () => {
  it('busca por código de agente y deja todas sus plantas', () => {
    const r = filas({ q: 'AAGG' })
    expect(r).toHaveLength(1)
    expect(r[0]!.plantas).toHaveLength(1)
  })

  it('busca por razón social', () => {
    expect(filas({ q: 'unergy' }).map((f) => f.codigo)).toEqual(['UNGG'])
  })

  it('al buscar una planta deja SOLO esa planta del agente', () => {
    const r = filas({ q: 'SIERPE' })
    expect(r.map((f) => f.codigo)).toEqual(['AAGG'])
    expect(r[0]!.plantas.map((p) => p.nombre)).toEqual(['LA SIERPE'])
  })

  it('busca por código Uns', () => {
    expect(filas({ q: 'Uns52940' }).map((f) => f.codigo)).toEqual(['BIAG'])
  })

  it('busca por código Pls, que no está escrito en ninguna parte', () => {
    // El Pls se deriva; si no se buscara por él, habría que calcularlo a mano.
    expect(filas({ q: 'Pls07304' }).map((f) => f.codigo)).toEqual(['AAGG'])
  })

  it('la búsqueda no distingue mayúsculas', () => {
    expect(filas({ q: 'sierpe' }).map((f) => f.codigo)).toEqual(['AAGG'])
  })

  it('filtra por tecnología y recalcula la capacidad', () => {
    const r = filas({ tecnologia: 'AGUA' })
    expect(r.map((f) => f.codigo)).toEqual(['ABAG'])
    expect(r[0]!.capacidadKw).toBe(19400)
  })

  it('solo Unergy deja los de la casa', () => {
    expect(filas({ soloUnergy: true }).map((f) => f.codigo)).toEqual(['UNGG'])
  })

  it('filtra por actividad', () => {
    expect(filas({ actividad: 'Comercializador' }).map((f) => f.codigo)).toEqual(['UNGG'])
  })

  it('sin coincidencias devuelve lista vacía, no todo', () => {
    expect(filas({ q: 'no-existe-nada' })).toEqual([])
  })
})
