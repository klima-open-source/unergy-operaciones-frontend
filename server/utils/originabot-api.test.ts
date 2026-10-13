import { FetchError } from 'ofetch'
import { describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'h3'
import {
  buscarEnTsf,
  codigoTsfDe,
  minigranjaDeTsf,
  nombreDesdeCodigo,
  POR_ETAPA,
  toProyectoTsf,
} from './originabot-api'

// La forma real de originabot dev (2026-10-13), recortada a lo que se lee.
// Si originabot cambia sus respuestas, esto es lo que lo dice.

const EVENT = {} as H3Event
const BEARER = 'Bearer tok'

// Cada test reemplaza `$fetch` con su propio stub. Sin `vi.unstubAllGlobals()`:
// también quitaría los globales de `vitest.setup.ts` (`createError`, …).

const MINIGRANJA = {
  id: 1913,
  name: 'COLCEST456P1_BOSCONIA_ORIENTE',
  stage: 'signed',
  stage_options: [
    { stage: 'signed', label: 'Firmado' },
    { stage: 'operation', label: 'Operación' },
  ],
  grid_operator: 'Afinia',
  project: {
    project_type: 'minifarm',
    latitude: 9.883090609100089,
    longitude: -73.76277027483552,
    grid_operator: 'Afinia',
    location: { city: 'Bosconia', region: 'Cesar', country: 'Colombia' },
  },
}

function errorHttp(status: number): FetchError {
  const err = new FetchError(`HTTP ${status}`)
  err.status = status
  return err
}

describe('codigoTsfDe', () => {
  it('se queda con el prefijo CREG, como el backend', () => {
    expect(codigoTsfDe('COLCEST456P1_BOSCONIA_ORIENTE')).toBe('COLCEST456P1')
  })

  it('un nombre que no empieza por un código CREG no da código', () => {
    expect(codigoTsfDe('Proyecto piloto')).toBeNull()
  })
})

describe('nombreDesdeCodigo', () => {
  it('deriva el nombre legible igual que tsf_sync', () => {
    expect(nombreDesdeCodigo('COLCEST456P1_BOSCONIA_ORIENTE')).toBe('Bosconia Oriente')
    expect(nombreDesdeCodigo('COLCEST943P2_SAN-MARTIN_SUR')).toBe('San Martin Sur')
  })

  it('respeta las siglas que title-case rompería', () => {
    expect(nombreDesdeCodigo('COLX1P1_PLANTA_AGPE')).toBe('Planta AGPE')
  })
})

describe('toProyectoTsf', () => {
  it('traduce la minigranja a lo que prellena el formulario', () => {
    expect(toProyectoTsf(MINIGRANJA)).toEqual({
      minigranjaId: 1913,
      codigoOrigina: 'COLCEST456P1_BOSCONIA_ORIENTE',
      codigoTsf: 'COLCEST456P1',
      nombreSugerido: 'Bosconia Oriente',
      etapa: 'Firmado',
      departamento: 'Cesar',
      municipio: 'Bosconia',
      latitud: 9.883090609100089,
      longitud: -73.76277027483552,
      operadorRed: 'Afinia',
      tipoProyecto: 'minigranja',
    })
  })

  it('lo que no viene queda en null, para que el campo siga editable', () => {
    const p = toProyectoTsf({ id: 7, name: 'COLX7P1_SITIO', project: { project_type: 'bess' } })
    expect(p.departamento).toBeNull()
    expect(p.latitud).toBeNull()
    expect(p.operadorRed).toBeNull()
    expect(p.tipoProyecto).toBeNull()
  })

  it('sin id ni código no hay nada que importar: 502', () => {
    expect(() => toProyectoTsf({ name: 'X' })).toThrowError(
      expect.objectContaining({ statusCode: 502 }),
    )
  })
})

describe('buscarEnTsf', () => {
  it('pide el conteo y luego solo las etapas con resultados, con el token de quien busca', async () => {
    const fetch = vi.fn(async (_ruta: string, opts: { query: Record<string, unknown> }) => {
      if (!opts.query.stage) {
        return [
          { value: 'signed', label: 'Firmado', count: 1 },
          { value: 'deploy', label: 'Despliegue', count: 0 },
          { value: 'operation', label: 'Operación', count: 1 },
        ]
      }
      const id = opts.query.stage === 'signed' ? 1913 : 2000
      return {
        count: 1,
        results: [
          {
            id,
            name: `COLX${id}P1_SITIO`,
            terrain: { city: 'Bosconia, Cesar' },
            project: { grid_operator_name: 'Afinia' },
          },
        ],
      }
    })
    vi.stubGlobal('$fetch', fetch)

    const r = await buscarEnTsf(EVENT, BEARER, 'colce')

    expect(r.truncado).toBe(false)
    expect(r.resultados.map((x) => [x.minigranjaId, x.etapaLabel])).toEqual([
      [1913, 'Firmado'],
      [2000, 'Operación'],
    ])
    // Conteo + 2 etapas con resultados; la que tiene 0 no se pide.
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(fetch).toHaveBeenCalledWith(
      '/api/v2/origination/portfolio-manager/projects/',
      expect.objectContaining({
        baseURL: 'https://originabot.test',
        headers: { Authorization: BEARER },
        query: { search: 'colce', stage: 'signed', page_size: POR_ETAPA },
      }),
    )
  })

  it('avisa cuando una etapa trae más de lo que se muestra', async () => {
    vi.stubGlobal(
      '$fetch',
      vi.fn(async (_r: string, opts: { query: Record<string, unknown> }) =>
        opts.query.stage
          ? { count: POR_ETAPA + 1, results: [] }
          : [{ value: 'operation', label: 'Op', count: POR_ETAPA + 1 }],
      ),
    )
    expect((await buscarEnTsf(EVENT, BEARER, 'col')).truncado).toBe(true)
  })

  it('un token rechazado sale como 403, no 401: no debe cerrar la sesión de Operaciones', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(errorHttp(401)))
    await expect(buscarEnTsf(EVENT, BEARER, 'colce')).rejects.toMatchObject({ statusCode: 403 })
  })

  it('una caída de originabot sale como 502', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(errorHttp(500)))
    await expect(buscarEnTsf(EVENT, BEARER, 'colce')).rejects.toMatchObject({ statusCode: 502 })
  })
})

describe('minigranjaDeTsf', () => {
  it('pide el detalle con el token de quien importa', async () => {
    const fetch = vi.fn().mockResolvedValue(MINIGRANJA)
    vi.stubGlobal('$fetch', fetch)

    await expect(minigranjaDeTsf(EVENT, BEARER, 1913)).resolves.toMatchObject({
      codigoTsf: 'COLCEST456P1',
    })
    expect(fetch).toHaveBeenCalledWith(
      '/api/investment/minifarm/1913/',
      expect.objectContaining({ headers: { Authorization: BEARER } }),
    )
  })

  it('una minigranja que no existe sale como 404', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(errorHttp(404)))
    await expect(minigranjaDeTsf(EVENT, BEARER, 1)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('una respuesta sin id no se disfraza de caída: conserva su 502 y su mensaje', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({}))
    await expect(minigranjaDeTsf(EVENT, BEARER, 1)).rejects.toMatchObject({
      statusCode: 502,
      statusMessage: 'originabot respondió una minigranja sin id ni código.',
    })
  })
})
