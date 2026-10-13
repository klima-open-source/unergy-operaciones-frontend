import { FetchError } from 'ofetch'
import { describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'h3'
import JSZip from 'jszip'
import {
  buscarEnTsf,
  proyectosEnEtapas,
  presimulacionDeTsf,
  ecsDeTsf,
  toEcsTsf,
  urlDeArchivo,
  codigoTsfDe,
  minigranjaDeTsf,
  nombreDesdeCodigo,
  POR_ETAPA,
  toProyectoTsf,
  toArriendoTsf,
  toArriendoDocumento,
} from './originabot-api'

// La forma real de originabot dev (2026-10-13), recortada a lo que se lee.
// Si originabot cambia sus respuestas, esto es lo que lo dice.

const EVENT = {} as H3Event
const BEARER = 'Bearer tok'

// Cada test reemplaza `$fetch` con su propio stub. Sin `vi.unstubAllGlobals()`:
// también quitaría los globales de `vitest.setup.ts` (`createError`, …).

const MINIGRANJA = {
  id: 1913,
  investments: [
    { id: 95, name: 'Unergy Interno', status: 'investment' },
    { id: 21, name: 'Solenium', status: 'investment' },
    { id: 40, name: 'Solo interesado', status: 'interested' },
  ],
  name: 'COLCEST456P1_BOSCONIA_ORIENTE',
  stage: 'signed',
  stage_options: [
    { stage: 'signed', label: 'Firmado' },
    { stage: 'operation', label: 'Operación' },
  ],
  grid_operator: 'Afinia',
  project: {
    id: 45467,
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
      operadorRedCodigo: null,
      tipoProyecto: 'minigranja',
      p50MensualKwh: null,
      p90MensualKwh: null,
      tecnico: null,
      voltajeRed: null,
      ecs: null,
      arriendo: null,
      // El que solo está interesado no invierte: no se trae.
      inversionistas: [
        { id: 95, nombre: 'Unergy Interno' },
        { id: 21, nombre: 'Solenium' },
      ],
    })
  })

  it('el code del operador sale del detalle de proyecto, que es el único que lo trae', () => {
    const p = toProyectoTsf(MINIGRANJA, {
      grid_operator_data: { value: 'afinia', label: 'Afinia' },
    })
    expect(p.operadorRedCodigo).toBe('afinia')
    expect(p.operadorRed).toBe('Afinia')
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
  it('pide la minigranja y su proyecto (por el code del operador), con el token de quien importa', async () => {
    const fetch = vi.fn(async (ruta: string) =>
      ruta.includes('/minifarm/projects/')
        ? { grid_operator_data: { value: 'afinia', label: 'Afinia' } }
        : MINIGRANJA,
    )
    vi.stubGlobal('$fetch', fetch)

    await expect(minigranjaDeTsf(EVENT, BEARER, 1913)).resolves.toMatchObject({
      codigoTsf: 'COLCEST456P1',
      operadorRedCodigo: 'afinia',
    })
    expect(fetch).toHaveBeenCalledWith(
      '/api/investment/minifarm/1913/',
      expect.objectContaining({ headers: { Authorization: BEARER } }),
    )
    expect(fetch).toHaveBeenCalledWith(
      '/api/minifarm/projects/45467/',
      expect.objectContaining({ headers: { Authorization: BEARER } }),
    )
  })

  it('si el detalle de proyecto falla, el import sigue sin code (cae al nombre)', async () => {
    vi.stubGlobal(
      '$fetch',
      vi.fn(async (ruta: string) => {
        if (ruta.includes('/minifarm/projects/')) throw errorHttp(500)
        return MINIGRANJA
      }),
    )
    await expect(minigranjaDeTsf(EVENT, BEARER, 1913)).resolves.toMatchObject({
      operadorRed: 'Afinia',
      operadorRedCodigo: null,
    })
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

describe('presimulacionDeTsf', () => {
  // Una variante mínima con E_Grid: 1 hora por mes, todas iguales → pesos de 1/12.
  const ALF = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.'
  const cod = (n: number) => '+' + ALF[Math.floor(n / 64)] + ALF[n % 64]
  const variante = [
    'PVObject_=pvVCalcul',
    '    VarSimul_140=E_Grid',
    ...Array.from(
      { length: 12 },
      (_, m) => `        Day_01${String(m + 1).padStart(2, '0')}=${cod(1000)}`,
    ),
    '    End of VarSimul=viE_Grid',
  ].join('\r\n')

  async function zipPvsyst() {
    const z = new JSZip()
    z.file('P_Project.VCD', variante)
    return z.generateAsync({ type: 'arraybuffer' })
  }

  function validacion(campos: Record<string, unknown>) {
    return { simulation: Object.entries(campos).map(([name, value]) => ({ name, value })) }
  }

  it('con zip y anuales: reparte el P50 y el P90 de TSF según la forma del zip', async () => {
    const zip = await zipPvsyst()
    const fetch = vi.fn(async (ruta: string) =>
      ruta.includes('project-validation')
        ? validacion({
            'P50 MWh/year': 1200,
            'P90 MWh/year': 1080,
            'Pre-simulación': '/media/presim.zip',
          })
        : zip,
    )
    vi.stubGlobal('$fetch', fetch)

    const r = await presimulacionDeTsf(EVENT, BEARER, 21)
    expect(r.p50MensualKwh).toEqual(Array(12).fill(100_000))
    expect(r.p90MensualKwh).toEqual(Array(12).fill(90_000))
    expect(fetch).toHaveBeenCalledWith(
      '/media/presim.zip',
      expect.objectContaining({ headers: { Authorization: BEARER }, responseType: 'arrayBuffer' }),
    )
  })

  it('sin zip no se llena nada, aunque haya anuales', async () => {
    vi.stubGlobal(
      '$fetch',
      vi.fn().mockResolvedValue(validacion({ 'P50 MWh/year': 1200, 'Pre-simulación': null })),
    )
    expect(await presimulacionDeTsf(EVENT, BEARER, 21)).toEqual({
      p50MensualKwh: null,
      p90MensualKwh: null,
      tecnico: null,
      voltajeRed: null,
    })
  })

  it('una fila sin anual en TSF queda vacía', async () => {
    const zip = await zipPvsyst()
    vi.stubGlobal(
      '$fetch',
      vi.fn(async (ruta: string) =>
        ruta.includes('project-validation')
          ? validacion({ 'P50 MWh/year': 1200, 'Pre-simulación': 'x.zip' })
          : zip,
      ),
    )
    const r = await presimulacionDeTsf(EVENT, BEARER, 21)
    expect(r.p50MensualKwh).toHaveLength(12)
    expect(r.p90MensualKwh).toBeNull()
  })

  it('un archivo que no es zip (un PDF, un HTML de error) no se lee', async () => {
    const pdf = new TextEncoder().encode('%PDF-1.7').buffer
    vi.stubGlobal(
      '$fetch',
      vi.fn(async (ruta: string) =>
        ruta.includes('project-validation')
          ? validacion({ 'P50 MWh/year': 1200, 'Pre-simulación': 'x.pdf' })
          : pdf,
      ),
    )
    expect(await presimulacionDeTsf(EVENT, BEARER, 21)).toEqual({
      p50MensualKwh: null,
      p90MensualKwh: null,
      tecnico: null,
      voltajeRed: null,
    })
  })

  it('si originabot falla, el import sigue sin simulación', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(errorHttp(500)))
    expect(await presimulacionDeTsf(EVENT, BEARER, 21)).toEqual({
      p50MensualKwh: null,
      p90MensualKwh: null,
      tecnico: null,
      voltajeRed: null,
    })
  })
})

describe('urlDeArchivo', () => {
  it('acepta el archivo como texto o como objeto, en value o en extra_file', () => {
    expect(urlDeArchivo({ value: ' /media/a.zip ' })).toBe('/media/a.zip')
    expect(urlDeArchivo({ value: { url: 'https://x/a.zip' } })).toBe('https://x/a.zip')
    expect(urlDeArchivo({ value: null, extra_file: { file: '/b.zip' } })).toBe('/b.zip')
    expect(urlDeArchivo({ value: null, extra_file: null })).toBeNull()
  })
})

describe('proyectosEnEtapas', () => {
  it('recorre todas las páginas de cada etapa', async () => {
    const fetch = vi.fn(async (_ruta: string, opts: { query: Record<string, unknown> }) => {
      const { stage, page } = opts.query
      const id = (stage === 'operation' ? 1000 : 2000) + Number(page)
      return {
        next: page === 1 && stage === 'operation' ? 'p2' : null,
        results: [{ id, name: `COLX${id}P1_S` }],
      }
    })
    vi.stubGlobal('$fetch', fetch)

    const r = await proyectosEnEtapas(EVENT, BEARER)
    expect(r.map((x) => [x.minigranjaId, x.etapaLabel]).sort()).toEqual([
      [1001, 'Operación'],
      [1002, 'Operación'],
      [2001, 'Construcción'],
    ])
    expect(fetch).toHaveBeenCalledWith(
      '/api/v2/origination/portfolio-manager/projects/',
      expect.objectContaining({ query: { stage: 'construction', page: 1, page_size: POR_ETAPA } }),
    )
  })

  it('un token rechazado sale como 403', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(errorHttp(401)))
    await expect(proyectosEnEtapas(EVENT, BEARER)).rejects.toMatchObject({ statusCode: 403 })
  })
})

describe('presimulacionDeTsf: nivel de tensión', () => {
  it('lee el «Nivel de tensión» de la sección general, aunque no haya zip', async () => {
    vi.stubGlobal(
      '$fetch',
      vi.fn().mockResolvedValue({
        general: [{ name: 'Nivel de tensión', value: '13.8' }],
        simulation: [{ name: 'Pre-simulación', value: null }],
      }),
    )
    expect((await presimulacionDeTsf(EVENT, BEARER, 21)).voltajeRed).toBe('13.8')
  })
})

describe('ECS', () => {
  const insumo = {
    project: 46730,
    external_code: '32313468',
    ecs_file: 'https://b2/ecs.pdf',
    ecs_conformity_file: '',
    type_supply: { value: 'active' },
    last_status: { text: 'ECS aprobado' },
    remaining_days: { text: '10' },
  }

  it('traduce el insumo; el vencimiento es hoy + los días que le quedan', () => {
    const hoy = new Date()
    hoy.setUTCDate(hoy.getUTCDate() + 10)
    expect(toEcsTsf(insumo)).toEqual({
      estado: 'ECS aprobado',
      codigoInsumo: '32313468',
      vencimiento: hoy.toISOString().slice(0, 10),
      archivoUrl: 'https://b2/ecs.pdf',
      conformidadUrl: null,
    })
  })

  it('busca por nombre y se queda con el insumo principal DE ESE proyecto', async () => {
    const fetch = vi.fn().mockResolvedValue({
      results: [
        { ...insumo, project: 999, last_status: { text: 'De otro proyecto' } },
        { ...insumo, type_supply: { value: 'secondary' }, last_status: { text: 'Secundario' } },
        insumo,
      ],
    })
    vi.stubGlobal('$fetch', fetch)
    expect((await ecsDeTsf(EVENT, BEARER, 'COLX_1', 46730))?.estado).toBe('ECS aprobado')
    expect(fetch).toHaveBeenCalledWith(
      '/api/connection/supplies-info/',
      expect.objectContaining({ query: { search: 'COLX_1' } }),
    )
  })

  it('sin insumo del proyecto, o si originabot falla, no hay ECS', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ results: [{ ...insumo, project: 1 }] }))
    expect(await ecsDeTsf(EVENT, BEARER, 'X', 46730)).toBeNull()
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(errorHttp(500)))
    expect(await ecsDeTsf(EVENT, BEARER, 'X', 46730)).toBeNull()
  })
})

describe('toArriendoTsf', () => {
  // Terreno 369 de dev: el contrato 179 es del proyecto 1191; la termsheet 321
  // la comparten 4 proyectos.
  const contrato = {
    id: 179,
    project: { id: 1191 },
    termsheet: 321,
    signed_at: null,
    is_signed: true,
  }
  const termsheet = {
    frequency: 'monthly',
    signed_at: '2024-02-15T17:00:00Z',
    is_signed: true,
    actual_rent_annual_cost_cop: 64381107.0,
    projects_data: [{ id: 1191 }, { id: 266 }, { id: 265 }, { id: 18 }],
  }
  const propietarios = [
    {
      landlord: { id: 1997, name: 'Mandy Clayton', document_number: '36****11', person_type: 'NP' },
      payment_percentage: 0.0,
      termsheet_receiver: false,
    },
    {
      landlord: {
        id: 596,
        name: 'Charlene Valentine',
        document_number: '19****53',
        person_type: 'LP',
      },
      payment_percentage: 100.0,
      termsheet_receiver: true,
    },
    { landlord: { id: null, name: 'sin id' }, payment_percentage: 5 },
  ]

  it('reparte el canon entre los proyectos del terreno y trae a los propietarios', () => {
    expect(toArriendoTsf(contrato, termsheet, propietarios)).toEqual({
      origen: 'contrato',
      contratoId: 179,
      enlace: null,
      firmado: true,
      fechaFirma: '2024-02-15',
      periodicidad: 'mensual',
      canonAnual: 16095277,
      proyectosTerreno: 4,
      arrendadores: [
        {
          id: 1997,
          nombre: 'Mandy Clayton',
          documento: '36****11',
          tipoPersona: 'natural',
          porcentaje: 0,
          recibePago: false,
        },
        {
          id: 596,
          nombre: 'Charlene Valentine',
          documento: '19****53',
          tipoPersona: 'juridica',
          porcentaje: 100,
          recibePago: true,
        },
      ],
    })
  })

  it('la fecha es la de Bogotá: las 2 a. m. UTC todavía son el día anterior', () => {
    const r = toArriendoTsf(contrato, { ...termsheet, signed_at: '2024-02-15T02:00:00Z' }, [])
    expect(r?.fechaFirma).toBe('2024-02-14')
  })
})

describe('toArriendoDocumento', () => {
  // La Paz Leyenda (minigranja 238, terreno 424): sin termsheet ni contract.Contract,
  // el contrato firmado es solo el PDF del campo «(S) Contrato de arrendamiento».
  const propietarios = [
    {
      landlord: {
        id: 611,
        name: 'Katherine Arellano',
        document_number: '26****78',
        person_type: 'NP',
      },
      payment_percentage: 0.0,
      termsheet_receiver: false,
    },
  ]
  const enlace = 'https://tsf.test/minifarms/lands/424?tab=legal'

  it('con PDF: firmado, con enlace a TSF y sin canon ni fechas inventados', () => {
    expect(
      toArriendoDocumento(
        {
          uuid: 'a9a6ccb8-276e-4947-8be7-e2e08390e260',
          value: 'https://b2/Contrato.pdf',
          status: 'approved',
        },
        propietarios,
        enlace,
        1,
      ),
    ).toMatchObject({
      origen: 'documento',
      contratoId: null,
      enlace,
      firmado: true,
      fechaFirma: null,
      periodicidad: null,
      canonAnual: null,
      arrendadores: [{ id: 611, nombre: 'Katherine Arellano', porcentaje: 0 }],
    })
  })

  it('sin PDF no hay contrato', () => {
    expect(toArriendoDocumento({ value: null }, propietarios, enlace, 1)).toBeNull()
  })
})
