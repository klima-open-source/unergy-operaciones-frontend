import { describe, expect, it } from 'vitest'

import { EstadoFallaCodigo, GrupoEstadoFalla } from '~/features/fallas/types'
import { esGrupoEstadoFalla, grupoEstadoFalla, perteneceAGrupo } from './grupoEstado'

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
