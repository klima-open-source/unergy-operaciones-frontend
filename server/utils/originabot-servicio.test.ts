import { FetchError } from 'ofetch'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'h3'

// Nitro llama a originabot con el usuario de Operaciones, así que las rutas
// tienen que comprobar antes que quien pide tiene sesión: si no, serían una
// puerta abierta a TSF. Esto prueba las dos mitades.

function evento(autorizacion?: string): H3Event {
  const headers = new Headers(autorizacion ? { authorization: autorizacion } : {})
  return { node: { req: { headers: Object.fromEntries(headers) } }, headers } as unknown as H3Event
}

function errorHttp(status: number): FetchError {
  const err = new FetchError(`HTTP ${status}`)
  err.status = status
  return err
}

function jwt(expSegundos: number): string {
  return `h.${btoa(JSON.stringify({ exp: expSegundos }))}.f`
}

let servicio: typeof import('./originabot-servicio')

beforeEach(async () => {
  // Estado del módulo (token y sesiones) limpio en cada caso.
  vi.resetModules()
  servicio = await import('./originabot-servicio')
})

describe('credencialOriginabot', () => {
  it('sin sesión es 401 y no llega a loguearse en originabot', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('$fetch', fetch)
    await expect(servicio.credencialOriginabot(evento())).rejects.toMatchObject({ statusCode: 401 })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('una sesión que el backend rechaza es 401', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(errorHttp(401)))
    await expect(servicio.credencialOriginabot(evento('Bearer viejo'))).rejects.toMatchObject({
      statusCode: 401,
    })
  })

  it('con sesión devuelve el token del usuario de Operaciones, no el de quien pide', async () => {
    const token = jwt(Date.now() / 1000 + 3600)
    const fetch = vi.fn(async (ruta: string, opciones: { body?: unknown }) => {
      if (ruta === '/api/v1/auth/me') return { id: 1 }
      expect(opciones.body).toEqual({ username: 'operaciones', password: 'secreto' })
      return { access: token }
    })
    vi.stubGlobal('$fetch', fetch)

    expect(await servicio.credencialOriginabot(evento('Bearer de-la-persona'))).toBe(
      `Bearer ${token}`,
    )
  })

  it('reutiliza el token y la comprobación de sesión', async () => {
    const fetch = vi.fn(async (ruta: string) =>
      ruta === '/api/v1/auth/me' ? { id: 1 } : { access: jwt(Date.now() / 1000 + 3600) },
    )
    vi.stubGlobal('$fetch', fetch)

    await servicio.credencialOriginabot(evento('Bearer a'))
    await servicio.credencialOriginabot(evento('Bearer a'))

    expect(fetch).toHaveBeenCalledTimes(2) // una de sesión, un login
  })

  it('tras olvidarlo (originabot lo rechazó) se vuelve a loguear', async () => {
    const fetch = vi.fn(async () => ({ access: jwt(Date.now() / 1000 + 3600) }))
    vi.stubGlobal('$fetch', fetch)

    await servicio.autorizacionOriginabot(evento())
    servicio.olvidarTokenOriginabot()
    await servicio.autorizacionOriginabot(evento())

    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('credenciales que Unergy Auth rechaza: 502 con el motivo, no 401', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(errorHttp(400)))
    await expect(servicio.autorizacionOriginabot(evento())).rejects.toMatchObject({
      statusCode: 502,
      statusMessage: expect.stringContaining('NUXT_ORIGINABOT_USER'),
    })
  })
})
