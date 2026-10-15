/**
 * Guardar una falla sin duplicar lo ya guardado.
 *
 * Producción da 503 intermitentes. Lo que se prueba acá es que un fallo a
 * mitad de camino no se reporte como "no se guardó nada" (el usuario
 * reintentaba y duplicaba fallas o seguimientos): lo creado cuenta como
 * guardado y lo que faltó se avisa.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Falla, PayloadFallaForm } from '~/features/fallas/types'

const crear = vi.fn()
const actualizar = vi.fn()
const crearSeguimiento = vi.fn()
const subirArchivo = vi.fn()
const notificar = vi.fn()

vi.mock('~/features/fallas/services/fallas', () => ({
  FallasService: class {
    crear = crear
    actualizar = actualizar
    crearSeguimiento = crearSeguimiento
    subirArchivo = subirArchivo
    notificar = notificar
  },
}))

const toast = { success: vi.fn(), warning: vi.fn(), error: vi.fn() }
vi.mock('vue-sonner', () => ({ toast }))

vi.mock('~/composables/useProyectosCatalogo', () => ({
  useProyectosCatalogo: () => ({
    cargarOperativos: async () => [
      { id: 1, nombre_comercial: 'Baraya' },
      { id: 2, nombre_comercial: 'San Pedro' },
    ],
  }),
}))

const { useGuardarFalla } = await import('./useGuardarFalla')

const falla = (id: number): Falla => ({ id, codigo_interno: `F-${id}` })
const caido = () => Promise.reject(new Error('503'))

beforeEach(() => {
  for (const fn of [crear, actualizar, crearSeguimiento, subirArchivo, notificar]) fn.mockReset()
  for (const fn of Object.values(toast)) fn.mockReset()
  crearSeguimiento.mockResolvedValue({})
  subirArchivo.mockResolvedValue({})
})

describe('useGuardarFalla · crear', () => {
  it('si un proyecto falla, lo creado cuenta como guardado y se avisa cuál faltó', async () => {
    crear.mockImplementation(({ proyecto_id }: { proyecto_id: number }) =>
      proyecto_id === 2 ? caido() : Promise.resolve(falla(10)),
    )
    const { guardar, guardando } = useGuardarFalla()

    const ids = await guardar({ proyecto_ids: [1, 2] }, null)

    expect(ids).toEqual([10])
    expect(guardando.value).toBe(false)
    expect(crear).toHaveBeenCalledTimes(2)
    expect(toast.error).not.toHaveBeenCalled()
    expect(toast.warning.mock.calls[0]?.[1]?.description).toContain('San Pedro')
  })

  it('si no se creó ninguna, es un error y no devuelve ids', async () => {
    crear.mockImplementation(caido)
    const ids = await useGuardarFalla().guardar({ proyecto_ids: [1, 2] }, null)

    expect(ids).toBeNull()
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(crearSeguimiento).not.toHaveBeenCalled()
  })

  it('una nota o un adjunto que fallan no tumban la falla creada', async () => {
    crear.mockResolvedValue(falla(10))
    crearSeguimiento.mockImplementation(caido)
    subirArchivo.mockImplementation(caido)
    const archivo = new File(['x'], 'foto.jpg')
    const payload: PayloadFallaForm = {
      proyecto_ids: [1],
      nota_inicial: 'Revisado en sitio',
      _archivos: [archivo],
    }

    const ids = await useGuardarFalla().guardar(payload, null)

    expect(ids).toEqual([10])
    expect(crear).toHaveBeenCalledTimes(1)
    const aviso = toast.warning.mock.calls[0]?.[1]?.description ?? ''
    expect(aviso).toContain('F-10: la nota inicial')
    expect(aviso).toContain('foto.jpg')
  })

  it('notifica solo las fallas creadas', async () => {
    crear.mockImplementation(({ proyecto_id }: { proyecto_id: number }) =>
      proyecto_id === 2 ? caido() : Promise.resolve(falla(10)),
    )
    notificar.mockResolvedValue({ ok: true, enviados: ['a@b.co'], errores: [], sin_correos: false })

    await useGuardarFalla().guardar({ proyecto_ids: [1, 2], notificacion: true }, null)

    expect(notificar).toHaveBeenCalledTimes(1)
    expect(notificar).toHaveBeenCalledWith(10)
  })
})

describe('useGuardarFalla · editar', () => {
  it('si el PATCH pasa y la nota falla, no se reporta como error', async () => {
    actualizar.mockResolvedValue(falla(5))
    crearSeguimiento.mockImplementation(caido)

    const ids = await useGuardarFalla().guardar({ nota_inicial: 'nota' }, falla(5))

    expect(ids).toEqual([5])
    expect(actualizar).toHaveBeenCalledTimes(1)
    expect(crearSeguimiento).toHaveBeenCalledTimes(1)
    expect(toast.error).not.toHaveBeenCalled()
    expect(toast.warning).toHaveBeenCalledTimes(1)
  })

  it('si el PATCH falla no se publica la nota', async () => {
    actualizar.mockImplementation(caido)

    const ids = await useGuardarFalla().guardar({ nota_inicial: 'nota' }, falla(5))

    expect(ids).toBeNull()
    expect(crearSeguimiento).not.toHaveBeenCalled()
  })
})
