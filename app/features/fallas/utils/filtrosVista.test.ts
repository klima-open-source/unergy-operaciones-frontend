import { describe, expect, it } from 'vitest'

import type { Falla } from '~/features/fallas/types'
import type { FiltrosVistaFallas } from './filtrosVista'
import { EstadoFallaCodigo } from '~/features/fallas/types'
import { cumpleFiltrosVista, esVencida, inicioDeCarga } from './filtrosVista'

const SIN_FILTROS: FiltrosVistaFallas = {
  texto: '',
  proyectoId: null,
  prioridad: null,
  estado: null,
  desde: null,
  hasta: null,
  soloVencidas: false,
}

const falla = (over: Partial<Falla> = {}): Falla => ({
  id: 1,
  codigo_interno: 'F-001',
  descripcion: 'Inversor apagado',
  proyecto: { id: 7, nombre_comercial: 'Baraya' },
  prioridad: { id: 1, codigo: 'grave' },
  estado: { id: 2, codigo: EstadoFallaCodigo.ABIERTA },
  fecha_identificacion: '2026-10-10',
  ...over,
})

describe('esVencida', () => {
  it('manda sla_cumplido sobre el porcentaje', () => {
    expect(esVencida({ sla_cumplido: false, sla_pct: 10 })).toBe(true)
    expect(esVencida({ sla_cumplido: true, sla_pct: 150 })).toBe(false)
  })

  it('sin cierre, vence al llegar al 100 %', () => {
    expect(esVencida({ sla_pct: 100 })).toBe(true)
    expect(esVencida({ sla_pct: 99 })).toBe(false)
    expect(esVencida({ sla_pct: null })).toBe(false)
  })

  it('una falla cerrada nunca está vencida', () => {
    expect(esVencida({ estado: { id: 1, es_estado_final: true }, sla_pct: 200 })).toBe(false)
  })
})

describe('cumpleFiltrosVista', () => {
  it('sin filtros pasa', () => {
    expect(cumpleFiltrosVista(falla(), SIN_FILTROS)).toBe(true)
  })

  it('busca en código, descripción y proyecto, sin importar mayúsculas', () => {
    expect(cumpleFiltrosVista(falla(), { ...SIN_FILTROS, texto: 'baraya' })).toBe(true)
    expect(cumpleFiltrosVista(falla(), { ...SIN_FILTROS, texto: 'f-001' })).toBe(true)
    expect(cumpleFiltrosVista(falla(), { ...SIN_FILTROS, texto: 'tracker' })).toBe(false)
  })

  it('filtra por proyecto y prioridad', () => {
    expect(cumpleFiltrosVista(falla(), { ...SIN_FILTROS, proyectoId: 7 })).toBe(true)
    expect(cumpleFiltrosVista(falla(), { ...SIN_FILTROS, proyectoId: 8 })).toBe(false)
    expect(cumpleFiltrosVista(falla(), { ...SIN_FILTROS, prioridad: 'leve' })).toBe(false)
  })

  it('"En gestión" también trae las que están en espera', () => {
    const enEspera = falla({ estado: { id: 4, codigo: EstadoFallaCodigo.EN_ESPERA } })
    const filtro = { ...SIN_FILTROS, estado: EstadoFallaCodigo.EN_GESTION }
    expect(cumpleFiltrosVista(enEspera, filtro)).toBe(true)
    expect(cumpleFiltrosVista(falla(), filtro)).toBe(false)
  })

  it('el rango de fechas incluye los extremos y excluye lo que no tiene fecha', () => {
    const rango = { ...SIN_FILTROS, desde: '2026-10-10', hasta: '2026-10-10' }
    expect(cumpleFiltrosVista(falla(), rango)).toBe(true)
    expect(cumpleFiltrosVista(falla({ fecha_identificacion: '2026-10-09' }), rango)).toBe(false)
    expect(cumpleFiltrosVista(falla({ fecha_identificacion: undefined }), rango)).toBe(false)
  })

  it('solo vencidas', () => {
    const filtro = { ...SIN_FILTROS, soloVencidas: true }
    expect(cumpleFiltrosVista(falla({ sla_pct: 120 }), filtro)).toBe(true)
    expect(cumpleFiltrosVista(falla({ sla_pct: 20 }), filtro)).toBe(false)
  })
})

describe('inicioDeCarga', () => {
  it('usa el filtro "Desde" solo si pide algo anterior a la ventana', () => {
    expect(inicioDeCarga('2026-01-01', '2026-07-15')).toBe('2026-01-01')
    expect(inicioDeCarga('2026-09-01', '2026-07-15')).toBe('2026-07-15')
    expect(inicioDeCarga(null, '2026-07-15')).toBe('2026-07-15')
  })
})
