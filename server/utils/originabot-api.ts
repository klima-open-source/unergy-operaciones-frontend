/**
 * originabot (TSF): el único archivo que conoce la forma de sus respuestas.
 *
 * Dos endpoints, siempre con el token de Unergy Auth de quien pide (originabot
 * lo valida contra authentication-system, igual que nuestro backend):
 *
 *   - `GET /api/v2/origination/portfolio-manager/projects/?search=` — la búsqueda
 *     de Portfolio Manager. **Sin `stage` no lista proyectos**: devuelve el conteo
 *     por etapa. La lista se pide etapa por etapa, y aquí se juntan.
 *   - `GET /api/investment/minifarm/<id>/` — el detalle de una minigranja, de
 *     donde sale lo que se prellena al crear el proyecto.
 *
 * El host cambia entre dev y prod (`NUXT_ORIGINABOT_URL`): un token de devauth
 * solo sirve contra el originabot de dev, y viceversa.
 */
import type { H3Event } from 'h3'
import { FetchError } from 'ofetch'

const RUTAS = {
  busqueda: '/api/v2/origination/portfolio-manager/projects/',
  minigranja: (id: number) => `/api/investment/minifarm/${id}/`,
} as const

/** Una etapa trae como mucho esto. La búsqueda es para encontrar uno, no para listar. */
export const POR_ETAPA = 50

// ── Lo que el cable trae. Todo opcional: no se afirma lo que no se comprueba. ──

interface ExternalConteoEtapa {
  value?: unknown
  label?: unknown
  count?: unknown
}

interface ExternalResultado {
  id?: unknown
  name?: unknown
  project?: { grid_operator_name?: unknown }
  terrain?: { city?: unknown }
}

interface ExternalPaginaEtapa {
  count?: unknown
  results?: ExternalResultado[]
}

export interface ExternalMinigranja {
  id?: unknown
  name?: unknown
  stage?: unknown
  stage_options?: { stage?: unknown; label?: unknown }[]
  grid_operator?: unknown
  project?: {
    project_type?: unknown
    latitude?: unknown
    longitude?: unknown
    grid_operator?: unknown
    location?: { city?: unknown; region?: unknown }
  }
}

// ── Lo que ve la app. ──

export interface ResultadoTsf {
  minigranjaId: number
  /** El `base_name` de TSF: `COLCEST456P1_BOSCONIA_ORIENTE`. */
  codigo: string
  etapa: string
  etapaLabel: string
  ubicacion: string | null
  operadorRed: string | null
}

export interface BusquedaTsf {
  resultados: ResultadoTsf[]
  /** Alguna etapa tenía más de `POR_ETAPA`: hay que afinar la búsqueda. */
  truncado: boolean
}

/** Lo que se prellena. `null` = TSF no lo trae (y entonces el campo queda editable). */
export interface ProyectoTsf {
  minigranjaId: number
  /** Va a `origina_code`, entero, como lo guarda `tsf_sync`. */
  codigoOrigina: string
  /** Va a `codigo_tsf`: el prefijo CREG (`COLCEST456P1`). */
  codigoTsf: string | null
  /** Derivado del código, como `tsf_sync`; no es un dato de TSF y se puede editar. */
  nombreSugerido: string
  etapa: string | null
  departamento: string | null
  municipio: string | null
  latitud: number | null
  longitud: number | null
  operadorRed: string | null
  tipoProyecto: string | null
}

function texto(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function numero(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

const PREFIJO_CREG = /^COL[A-Z0-9]+$/

/** `COLCEST456P1_BOSCONIA_ORIENTE` → `COLCEST456P1`. Mismo criterio que el backend. */
export function codigoTsfDe(codigo: string): string | null {
  const prefijo = codigo.split('_', 1)[0] ?? ''
  return PREFIJO_CREG.test(prefijo) ? prefijo : null
}

const SIGLAS = new Set(['AGGE', 'AGPE'])

/**
 * `COLCEST456P1_BOSCONIA_ORIENTE` → `Bosconia Oriente`. Port de
 * `tsf_sync._derive_commercial_name` (backend), para que un proyecto importado
 * se llame igual que uno que hubiera creado la sincronización.
 */
export function nombreDesdeCodigo(codigo: string): string {
  const [prefijo = '', resto] = codigo.split(/_(.*)/s)
  const esCodigo = /^COL[A-Z0-9]*$/.test(prefijo) || /\d/.test(prefijo)
  const legible = (resto && esCodigo ? resto : codigo).replace(/[_-]+/g, ' ').trim()
  if (!legible) return codigo
  return legible
    .toLowerCase()
    .split(' ')
    .map((p) =>
      SIGLAS.has(p.toUpperCase()) ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1),
    )
    .join(' ')
}

export function toResultadoTsf(
  r: ExternalResultado,
  etapa: string,
  etapaLabel: string,
): ResultadoTsf | null {
  const id = numero(r.id)
  const codigo = texto(r.name)
  if (id === null || !codigo) return null
  return {
    minigranjaId: id,
    codigo,
    etapa,
    etapaLabel,
    ubicacion: texto(r.terrain?.city),
    operadorRed: texto(r.project?.grid_operator_name),
  }
}

export function toProyectoTsf(m: ExternalMinigranja): ProyectoTsf {
  const id = numero(m.id)
  const codigo = texto(m.name)
  if (id === null || !codigo) {
    throw createError({
      statusCode: 502,
      statusMessage: 'originabot respondió una minigranja sin id ni código.',
    })
  }
  const tipo = texto(m.project?.project_type)
  return {
    minigranjaId: id,
    codigoOrigina: codigo,
    codigoTsf: codigoTsfDe(codigo),
    nombreSugerido: nombreDesdeCodigo(codigo),
    etapa: texto(m.stage_options?.find((o) => o.stage === m.stage)?.label) ?? texto(m.stage),
    departamento: texto(m.project?.location?.region),
    municipio: texto(m.project?.location?.city),
    latitud: numero(m.project?.latitude),
    longitud: numero(m.project?.longitude),
    operadorRed: texto(m.project?.grid_operator) ?? texto(m.grid_operator),
    // El único tipo que TSF y Operaciones nombran distinto y que se reconoce.
    tipoProyecto: tipo === 'minifarm' ? 'minigranja' : null,
  }
}

/**
 * originabot rechaza el token (401/403): la sesión no es de Unergy Auth, o es de
 * otro entorno. Se responde 403 y no 401 a propósito: un 401 hace que
 * `~/core/client.ts` cierre la sesión de Operaciones, que no tiene la culpa.
 */
function errorDeOriginabot(err: unknown) {
  if (err instanceof FetchError && (err.status === 401 || err.status === 403)) {
    const detail =
      'originabot rechazó tu sesión. Para importar desde TSF inicia sesión con Unergy Auth.'
    return createError({ statusCode: 403, statusMessage: detail, data: { detail } })
  }
  if (err instanceof FetchError && err.status === 404) {
    const detail = 'Ese proyecto no existe en TSF.'
    return createError({ statusCode: 404, statusMessage: detail, data: { detail } })
  }
  const detail = 'No se pudo consultar originabot (TSF).'
  return createError({ statusCode: 502, statusMessage: detail, data: { detail } })
}

function opciones(event: H3Event, autorizacion: string) {
  return {
    baseURL: useRuntimeConfig(event).originabotUrl,
    headers: { Authorization: autorizacion },
    retry: false as const,
  }
}

export async function buscarEnTsf(
  event: H3Event,
  autorizacion: string,
  busqueda: string,
): Promise<BusquedaTsf> {
  try {
    const conteos = await $fetch<ExternalConteoEtapa[]>(RUTAS.busqueda, {
      ...opciones(event, autorizacion),
      query: { search: busqueda },
    })
    const etapas = (Array.isArray(conteos) ? conteos : []).filter(
      (e) => typeof e.value === 'string' && typeof e.count === 'number' && e.count > 0,
    )
    const paginas = await Promise.all(
      etapas.map((e) =>
        $fetch<ExternalPaginaEtapa>(RUTAS.busqueda, {
          ...opciones(event, autorizacion),
          query: { search: busqueda, stage: e.value as string, page_size: POR_ETAPA },
        }).then((p) => ({ etapa: e, pagina: p })),
      ),
    )
    return {
      resultados: paginas.flatMap(({ etapa, pagina }) =>
        (pagina.results ?? [])
          .map((r) =>
            toResultadoTsf(r, etapa.value as string, texto(etapa.label) ?? (etapa.value as string)),
          )
          .filter((r): r is ResultadoTsf => r !== null),
      ),
      truncado: etapas.some((e) => (e.count as number) > POR_ETAPA),
    }
  } catch (err) {
    throw errorDeOriginabot(err)
  }
}

export async function minigranjaDeTsf(
  event: H3Event,
  autorizacion: string,
  id: number,
): Promise<ProyectoTsf> {
  try {
    return toProyectoTsf(
      await $fetch<ExternalMinigranja>(RUTAS.minigranja(id), opciones(event, autorizacion)),
    )
  } catch (err) {
    if (err instanceof Error && 'statusCode' in err && !(err instanceof FetchError)) throw err
    throw errorDeOriginabot(err)
  }
}
