import { FetchError } from 'ofetch'
import { describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'h3'
import { loginUnergy, refreshUnergy, toLoginBody, toUnergyTokens } from './unergy-auth-api'

// El borde con dj-rest-auth (auth.unergy.io). Si alguien actualiza el servicio y
// cambia la forma de la respuesta, estas aserciones son las que lo dicen.

const EVENT = {} as H3Event

// Cada test reemplaza `$fetch` con su propio stub. Sin `vi.unstubAllGlobals()`:
// también quitaría los globales de `vitest.setup.ts` (`createError`, …).

function errorHttp(status: number): FetchError {
  const err = new FetchError(`HTTP ${status}`)
  err.status = status
  return err
}

describe('toUnergyTokens', () => {
  it('lee la forma actual de dj-rest-auth (`access`/`refresh`)', () => {
    expect(toUnergyTokens({ access: 'a', refresh: 'r' })).toEqual({ access: 'a', refresh: 'r' })
  })

  it('lee la forma vieja (`access_token`/`refresh_token`)', () => {
    expect(toUnergyTokens({ access_token: 'a', refresh_token: 'r' })).toEqual({
      access: 'a',
      refresh: 'r',
    })
  })

  it('un refresh sin rotación deja `refresh` en null', () => {
    expect(toUnergyTokens({ access: 'a' })).toEqual({ access: 'a', refresh: null })
  })

  it('sin access no hay sesión: 502, no un token vacío', () => {
    expect(() => toUnergyTokens({ refresh: 'r' })).toThrowError(
      expect.objectContaining({ statusCode: 502 }),
    )
  })
})

describe('toLoginBody', () => {
  it('un correo viaja como `email`', () => {
    expect(toLoginBody('ana@unergy.io', 'x')).toEqual({ email: 'ana@unergy.io', password: 'x' })
  })

  it('cualquier otra cosa viaja como `username`', () => {
    expect(toLoginBody('ana', 'x')).toEqual({ username: 'ana', password: 'x' })
  })
})

describe('loginUnergy', () => {
  it('pega contra /auth/login/ del servicio configurado', async () => {
    const fetch = vi.fn().mockResolvedValue({ access: 'a', refresh: 'r' })
    vi.stubGlobal('$fetch', fetch)

    await expect(loginUnergy(EVENT, { email: 'ana@unergy.io', password: 'x' })).resolves.toEqual({
      access: 'a',
      refresh: 'r',
    })
    expect(fetch).toHaveBeenCalledWith(
      '/auth/login/',
      expect.objectContaining({
        baseURL: 'https://unergy-auth.test',
        method: 'POST',
        body: { email: 'ana@unergy.io', password: 'x' },
      }),
    )
  })

  it('credenciales malas (400 en dj-rest-auth) salen como 401', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(errorHttp(400)))

    await expect(loginUnergy(EVENT, { email: 'a@b.c', password: 'x' })).rejects.toMatchObject({
      statusCode: 401,
    })
  })

  it('una caída del servicio sale como 502, no como credenciales malas', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(errorHttp(500)))

    await expect(loginUnergy(EVENT, { email: 'a@b.c', password: 'x' })).rejects.toMatchObject({
      statusCode: 502,
    })
  })
})

describe('refreshUnergy', () => {
  it('cambia el refresh por un access nuevo', async () => {
    const fetch = vi.fn().mockResolvedValue({ access: 'nuevo' })
    vi.stubGlobal('$fetch', fetch)

    await expect(refreshUnergy(EVENT, 'r')).resolves.toEqual({ access: 'nuevo', refresh: null })
    expect(fetch).toHaveBeenCalledWith(
      '/auth/token/refresh/',
      expect.objectContaining({ body: { refresh: 'r' } }),
    )
  })

  it('un refresh vencido (401) sale como 401: hay que volver a iniciar sesión', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(errorHttp(401)))

    await expect(refreshUnergy(EVENT, 'r')).rejects.toMatchObject({ statusCode: 401 })
  })
})
