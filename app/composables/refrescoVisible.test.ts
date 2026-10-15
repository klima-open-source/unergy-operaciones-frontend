import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { crearRefrescoVisible, type DocumentoVisible } from './refrescoVisible'

function documentoFalso(estado = 'visible') {
  let oyente: (() => void) | null = null
  const doc: DocumentoVisible = {
    visibilityState: estado,
    addEventListener: (_t, fn) => (oyente = fn),
    removeEventListener: () => (oyente = null),
  }
  return {
    doc,
    cambiar(nuevo: string) {
      doc.visibilityState = nuevo
      oyente?.()
    },
  }
}

const MIN = 60_000

describe('refresco solo a la vista', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('a la vista refresca a su ritmo', () => {
    const refrescar = vi.fn()
    const { doc } = documentoFalso()
    crearRefrescoVisible(refrescar, { cadaMs: 5 * MIN, viejoTrasMs: 5 * MIN }, doc).iniciar()

    vi.advanceTimersByTime(15 * MIN)
    expect(refrescar).toHaveBeenCalledTimes(3)
  })

  it('en segundo plano no pide nada', () => {
    const refrescar = vi.fn()
    const pagina = documentoFalso()
    crearRefrescoVisible(refrescar, { cadaMs: MIN, viejoTrasMs: 5 * MIN }, pagina.doc).iniciar()

    pagina.cambiar('hidden')
    vi.advanceTimersByTime(60 * MIN)
    expect(refrescar).not.toHaveBeenCalled()
  })

  it('al volver tras un rato se pone al día de inmediato', () => {
    const refrescar = vi.fn()
    const pagina = documentoFalso()
    crearRefrescoVisible(refrescar, { cadaMs: MIN, viejoTrasMs: 5 * MIN }, pagina.doc).iniciar()

    pagina.cambiar('hidden')
    vi.advanceTimersByTime(10 * MIN)
    pagina.cambiar('visible')
    expect(refrescar).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(MIN) // y retoma el ritmo
    expect(refrescar).toHaveBeenCalledTimes(2)
  })

  it('al volver enseguida no repite la carga', () => {
    const refrescar = vi.fn()
    const pagina = documentoFalso()
    const r = crearRefrescoVisible(refrescar, { cadaMs: 5 * MIN, viejoTrasMs: 5 * MIN }, pagina.doc)
    r.iniciar()

    vi.advanceTimersByTime(2 * MIN)
    r.marcarCarga() // p.ej. el botón "Actualizar"
    pagina.cambiar('hidden')
    vi.advanceTimersByTime(MIN)
    pagina.cambiar('visible')
    expect(refrescar).not.toHaveBeenCalled()
  })
})
