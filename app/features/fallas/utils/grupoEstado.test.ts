import { describe, expect, it } from 'vitest'

import { EstadoFallaCodigo, GrupoEstadoFalla } from '~/features/fallas/types'
import {
  esGrupoEstadoFalla,
  estadosSeleccionables,
  etiquetaEstado,
  grupoEstadoFalla,
  perteneceAGrupo,
} from './grupoEstado'

const conEstado = (codigo?: string, es_estado_final = false) => ({
  estado: codigo === undefined ? undefined : { id: 1, codigo, es_estado_final },
})

describe('grupoEstadoFalla', () => {
  it('en espera se agrupa con en gestión', () => {
    expect(grupoEstadoFalla(conEstado(EstadoFallaCodigo.EN_GESTION))).toBe(
      GrupoEstadoFalla.EN_GESTION,
    )
    expect(grupoEstadoFalla(conEstado(EstadoFallaCodigo.EN_ESPERA))).toBe(
      GrupoEstadoFalla.EN_GESTION,
    )
  })

  it('sin solución se deja como abierta aunque sea un estado final', () => {
    expect(grupoEstadoFalla(conEstado(EstadoFallaCodigo.SIN_SOLUCION, true))).toBe(
      GrupoEstadoFalla.ABIERTA,
    )
    expect(grupoEstadoFalla(conEstado(EstadoFallaCodigo.ABIERTA))).toBe(GrupoEstadoFalla.ABIERTA)
  })

  it('programado y cerrada van cada uno en su pestaña', () => {
    expect(grupoEstadoFalla(conEstado(EstadoFallaCodigo.PROGRAMADO))).toBe(
      GrupoEstadoFalla.PROGRAMADO,
    )
    expect(grupoEstadoFalla(conEstado(EstadoFallaCodigo.CERRADA, true))).toBe(
      GrupoEstadoFalla.CERRADA,
    )
  })

  it('un estado desconocido no se pierde: final → cerrada, si no → abierta', () => {
    expect(grupoEstadoFalla(conEstado('anulada', true))).toBe(GrupoEstadoFalla.CERRADA)
    expect(grupoEstadoFalla(conEstado('nuevo_estado'))).toBe(GrupoEstadoFalla.ABIERTA)
    expect(grupoEstadoFalla(conEstado())).toBe(GrupoEstadoFalla.ABIERTA)
  })
})

describe('perteneceAGrupo', () => {
  it('todas incluye cualquier estado', () => {
    expect(perteneceAGrupo(conEstado(EstadoFallaCodigo.CERRADA, true), GrupoEstadoFalla.TODAS)).toBe(
      true,
    )
  })

  it('compara contra el grupo, no contra el código', () => {
    expect(
      perteneceAGrupo(conEstado(EstadoFallaCodigo.EN_ESPERA), GrupoEstadoFalla.EN_GESTION),
    ).toBe(true)
    expect(perteneceAGrupo(conEstado(EstadoFallaCodigo.EN_ESPERA), GrupoEstadoFalla.ABIERTA)).toBe(
      false,
    )
  })
})

describe('esGrupoEstadoFalla', () => {
  it('valida lo que llega por la URL', () => {
    expect(esGrupoEstadoFalla('en_gestion')).toBe(true)
    expect(esGrupoEstadoFalla('alerta')).toBe(false)
    expect(esGrupoEstadoFalla(undefined)).toBe(false)
  })
})

describe('etiquetaEstado', () => {
  it('nombra "en espera" como "En gestión" y deja los demás como vienen', () => {
    expect(etiquetaEstado({ codigo: EstadoFallaCodigo.EN_ESPERA, etiqueta: 'En espera' })).toBe(
      'En gestión',
    )
    expect(etiquetaEstado({ codigo: EstadoFallaCodigo.SIN_SOLUCION, etiqueta: 'Sin solución' })).toBe(
      'Sin solución',
    )
    expect(etiquetaEstado(null)).toBe('—')
  })
})

describe('estadosSeleccionables', () => {
  const estados = [
    { id: 1, codigo: EstadoFallaCodigo.EN_GESTION, etiqueta: 'En gestión' },
    { id: 2, codigo: EstadoFallaCodigo.EN_ESPERA, etiqueta: 'En espera' },
  ]

  it('no ofrece "en espera" para elegir', () => {
    expect(estadosSeleccionables(estados).map((e) => e.id)).toEqual([1])
  })

  it('lo conserva si es el estado actual de la falla', () => {
    expect(estadosSeleccionables(estados, 2).map((e) => e.id)).toEqual([1, 2])
  })
})
