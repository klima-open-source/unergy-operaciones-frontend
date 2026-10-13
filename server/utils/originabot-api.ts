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
import { leerPresimulacion, repartir, type TecnicoPvsyst } from './pvsyst'

const RUTAS = {
  busqueda: '/api/v2/origination/portfolio-manager/projects/',
  minigranja: (id: number) => `/api/investment/minifarm/${id}/`,
  /** El detalle de proyecto es el único que trae el `code` del operador de red. */
  proyecto: (id: number) => `/api/minifarm/projects/${id}/`,
  /** Campos de validación eléctrica: los anuales P50/P90 y el zip de pre-simulación. */
  validacion: (minigranjaId: number) => `/api/roles/electrical/${minigranjaId}/project-validation/`,
  /** Insumos del punto de conexión (ECS), del servicio `requests`. */
  insumos: '/api/connection/supplies-info/',
  /** Contratos de arrendamiento del terreno: uno por proyecto, todos de la misma termsheet. */
  arriendos: '/api/contract/leasing_contract/',
  termsheet: (id: number) => `/api/termsheet/v2/termsheet/${id}/`,
  /** Los propietarios del terreno con su porcentaje del canon. */
  propietarios: '/api/termsheet/landlord_terrain/',
} as const

/** Nombres de los campos de `simulation` en la validación eléctrica de TSF. */
const CAMPO = {
  p50Anual: 'P50 MWh/year',
  p90Anual: 'P90 MWh/year',
  preSimulacion: 'Pre-simulación',
  nivelTension: 'Nivel de tensión',
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
  /** Los inversionistas de la minigranja; `status: 'investment'` = invierten de verdad. */
  investments?: { id?: unknown; name?: unknown; status?: unknown }[]
  project?: {
    id?: unknown
    project_type?: unknown
    latitude?: unknown
    longitude?: unknown
    grid_operator?: unknown
    terrain_id?: unknown
    location?: { city?: unknown; region?: unknown }
  }
}

interface ExternalProyecto {
  grid_operator_data?: { value?: unknown; label?: unknown }
}

interface ExternalCampoValidacion {
  name?: unknown
  type?: unknown
  value?: unknown
  extra_file?: unknown
}

/** La validación eléctrica: secciones (`general`, `simulation`…) con sus campos. */
type ExternalValidacion = Record<string, ExternalCampoValidacion[] | undefined>

interface ExternalInsumo {
  project?: unknown
  external_code?: unknown
  ecs_file?: unknown
  ecs_conformity_file?: unknown
  type_supply?: { value?: unknown }
  last_status?: { text?: unknown }
  remaining_days?: { text?: unknown }
}

interface ExternalArriendo {
  id?: unknown
  project?: { id?: unknown }
  termsheet?: unknown
  signed_at?: unknown
  is_signed?: unknown
}

interface ExternalTermsheet {
  frequency?: unknown
  signed_at?: unknown
  is_signed?: unknown
  /** El canon anual del TERRENO, que comparten todos sus proyectos. */
  actual_rent_annual_cost_cop?: unknown
  projects_data?: unknown[]
}

interface ExternalPropietario {
  landlord?: {
    id?: unknown
    name?: unknown
    document_type?: unknown
    document_number?: unknown
    person_type?: unknown
  }
  payment_percentage?: unknown
  termsheet_receiver?: unknown
}

/** Un propietario del terreno según TSF. */
export interface ArrendadorTsf {
  id: number
  nombre: string
  /** Tal como lo da TSF; en dev llega enmascarado («19****53»). */
  documento: string | null
  tipoPersona: 'natural' | 'juridica' | null
  /** Su parte del canon, 0–100. */
  porcentaje: number
  /** Quien recibe el pago según la termsheet. */
  recibePago: boolean
}

/** El contrato de arrendamiento del proyecto en TSF. */
export interface ArriendoTsf {
  /** El `LeasingContract`: la llave con `contratos.originabot_arriendo_id`. */
  contratoId: number
  firmado: boolean
  /** ISO `YYYY-MM-DD`, en hora de Bogotá. */
  fechaFirma: string | null
  periodicidad: 'mensual' | 'bimestral' | 'trimestral' | 'semestral' | 'anual' | null
  /** El canon anual del terreno entre sus proyectos, en partes iguales. */
  canonAnual: number | null
  /** Cuántos proyectos comparten el terreno (y el canon). */
  proyectosTerreno: number
  arrendadores: ArrendadorTsf[]
}

/** El ECS del proyecto en TSF. */
export interface EcsTsf {
  estado: string | null
  codigoInsumo: string | null
  /** ISO `YYYY-MM-DD`: hoy + los días que TSF dice que le quedan. */
  vencimiento: string | null
  archivoUrl: string | null
  conformidadUrl: string | null
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
  /** El `code` de originabot (`afinia`): la llave con `operadores_red.codigo_originabot`. */
  operadorRedCodigo: string | null
  tipoProyecto: string | null
  /**
   * Generación simulada mensual (kWh, 12 meses). Solo si TSF tiene el zip de
   * pre-simulación Y el anual correspondiente: la forma sale del zip y el total del
   * anual de TSF (ver `./pvsyst.ts`). Si falta algo, null: no se inventa.
   */
  p50MensualKwh: number[] | null
  p90MensualKwh: number[] | null
  /** Los inversionistas de TSF (`Investment`), para vincularlos con clientes de Operaciones. */
  inversionistas: { id: number; nombre: string }[]
  /** Datos técnicos del proyecto de PVsyst de la pre-simulación; null si no hay zip. */
  tecnico: TecnicoPvsyst | null
  /** «Nivel de tensión» de la validación eléctrica (kV de media tensión, p. ej. «13.8»). */
  voltajeRed: string | null
  ecs: EcsTsf | null
  arriendo: ArriendoTsf | null
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

export function toProyectoTsf(
  m: ExternalMinigranja,
  proyecto?: ExternalProyecto | null,
): ProyectoTsf {
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
    operadorRed:
      texto(proyecto?.grid_operator_data?.label) ??
      texto(m.project?.grid_operator) ??
      texto(m.grid_operator),
    operadorRedCodigo: texto(proyecto?.grid_operator_data?.value),
    p50MensualKwh: null,
    p90MensualKwh: null,
    tecnico: null,
    voltajeRed: null,
    ecs: null,
    arriendo: null,
    inversionistas: (m.investments ?? [])
      .filter((i) => i.status === 'investment')
      .map((i) => ({ id: numero(i.id), nombre: texto(i.name) }))
      .filter((i): i is { id: number; nombre: string } => i.id !== null && i.nombre !== null),
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

/** Las etapas en que un proyecto de TSF ya debería existir en Operaciones. */
export const ETAPAS_SUGERIDAS = { construction: 'Construcción', operation: 'Operación' } as const

/** Tope de páginas por etapa: una etapa nunca tendría tantos proyectos; corta un bucle si `next` se rompe. */
const MAX_PAGINAS = 20

/**
 * TODOS los proyectos de TSF en las etapas dadas (Portfolio Manager), página por
 * página. Para sugerir al crear un proyecto los que aún no están en Operaciones.
 */
export async function proyectosEnEtapas(
  event: H3Event,
  autorizacion: string,
  etapas: Record<string, string> = ETAPAS_SUGERIDAS,
): Promise<ResultadoTsf[]> {
  try {
    const porEtapa = await Promise.all(
      Object.entries(etapas).map(async ([etapa, etiqueta]) => {
        const resultados: ResultadoTsf[] = []
        for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
          const datos = await $fetch<ExternalPaginaEtapa & { next?: unknown }>(RUTAS.busqueda, {
            ...opciones(event, autorizacion),
            query: { stage: etapa, page: pagina, page_size: POR_ETAPA },
          })
          for (const r of datos.results ?? []) {
            const resultado = toResultadoTsf(r, etapa, etiqueta)
            if (resultado) resultados.push(resultado)
          }
          if (!datos.next) break
        }
        return resultados
      }),
    )
    return porEtapa.flat()
  } catch (err) {
    throw errorDeOriginabot(err)
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

/** Un campo de la validación por su nombre, en cualquier sección. */
function campo(
  validacion: ExternalValidacion | null,
  nombre: string,
): ExternalCampoValidacion | null {
  for (const seccion of Object.values(validacion ?? {})) {
    const c = Array.isArray(seccion) ? seccion.find((x) => x?.name === nombre) : undefined
    if (c) return c
  }
  return null
}

/**
 * La URL del archivo de un campo de validación. En dev ningún proyecto lo tiene
 * cargado, así que la forma no está confirmada: se acepta texto o un objeto con
 * `url`/`file`, en `value` o en `extra_file`.
 */
export function urlDeArchivo(c: ExternalCampoValidacion | null): string | null {
  for (const v of [c?.value, c?.extra_file]) {
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (v && typeof v === 'object') {
      const o = v as { url?: unknown; file?: unknown }
      const u = texto(o.url) ?? texto(o.file)
      if (u) return u
    }
  }
  return null
}

/** Un zip empieza por `PK\x03\x04`; cualquier otra cosa (un PDF, un HTML de error) no se lee. */
function esZip(datos: ArrayBuffer): boolean {
  const b = new Uint8Array(datos, 0, Math.min(4, datos.byteLength))
  return b.length === 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04
}

/**
 * P50/P90 mensuales desde la validación eléctrica de TSF. Nunca lanza: la
 * simulación es un extra del import, y sin ella el formulario queda como antes.
 */
/**
 * Lo que sale de la validación eléctrica de TSF: la generación simulada mensual
 * (forma del zip de pre-simulación × anuales de TSF), los datos técnicos del
 * proyecto de PVsyst y el nivel de tensión. Nunca lanza: es un extra, y sin él
 * todo queda como antes.
 */
export async function presimulacionDeTsf(
  event: H3Event,
  autorizacion: string,
  minigranjaId: number,
): Promise<Pick<ProyectoTsf, 'p50MensualKwh' | 'p90MensualKwh' | 'tecnico' | 'voltajeRed'>> {
  const vacio = { p50MensualKwh: null, p90MensualKwh: null, tecnico: null, voltajeRed: null }
  let validacion: ExternalValidacion
  try {
    validacion = await $fetch<ExternalValidacion>(
      RUTAS.validacion(minigranjaId),
      opciones(event, autorizacion),
    )
  } catch {
    return vacio
  }
  const voltajeRed = texto(campo(validacion, CAMPO.nivelTension)?.value)
  const p50 = numero(campo(validacion, CAMPO.p50Anual)?.value)
  const p90 = numero(campo(validacion, CAMPO.p90Anual)?.value)
  const url = urlDeArchivo(campo(validacion, CAMPO.preSimulacion))
  if (!url) return { ...vacio, voltajeRed }

  try {
    const zip = await $fetch<ArrayBuffer>(url, {
      ...opciones(event, autorizacion),
      responseType: 'arrayBuffer',
    })
    if (!esZip(zip)) return { ...vacio, voltajeRed }
    const { pesos, tecnico } = await leerPresimulacion(zip)
    return {
      p50MensualKwh: pesos && p50 !== null ? repartir(pesos, p50 * 1000) : null,
      p90MensualKwh: pesos && p90 !== null ? repartir(pesos, p90 * 1000) : null,
      tecnico,
      voltajeRed,
    }
  } catch {
    return { ...vacio, voltajeRed }
  }
}

/** Fecha ISO de hoy + `dias` (puede ser negativo: ya venció). */
function enDias(dias: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

export function toEcsTsf(registro: ExternalInsumo): EcsTsf {
  const dias = Number(texto(registro.remaining_days?.text))
  return {
    estado: texto(registro.last_status?.text),
    codigoInsumo: texto(registro.external_code),
    vencimiento: Number.isFinite(dias) ? enDias(dias) : null,
    archivoUrl: texto(registro.ecs_file),
    conformidadUrl: texto(registro.ecs_conformity_file),
  }
}

/**
 * El ECS (Estudio de Conexión Simplificado) del proyecto: su insumo principal en
 * `requests`, que originabot lista en `supplies-info`. Esa lista solo filtra por
 * texto, así que se busca por el nombre y se queda con el del proyecto. Nunca
 * lanza: sin ECS, null.
 */
export async function ecsDeTsf(
  event: H3Event,
  autorizacion: string,
  nombre: string,
  proyectoId: number,
): Promise<EcsTsf | null> {
  try {
    const datos = await $fetch<{ results?: ExternalInsumo[] }>(RUTAS.insumos, {
      ...opciones(event, autorizacion),
      query: { search: nombre },
    })
    const delProyecto = (datos.results ?? []).filter((r) => r.project === proyectoId)
    const principal = delProyecto.find((r) => r.type_supply?.value === 'active') ?? delProyecto[0]
    return principal ? toEcsTsf(principal) : null
  } catch {
    return null
  }
}

const PERIODICIDAD: Record<string, ArriendoTsf['periodicidad']> = {
  monthly: 'mensual',
  bimonthly: 'bimestral',
  quarterly: 'trimestral',
  biannual: 'semestral',
  semiannual: 'semestral',
  annual: 'anual',
  yearly: 'anual',
}

/** `2024-02-15T03:00:00Z` → `2024-02-14`: la fecha en Bogotá (UTC−5, sin horario de verano). */
function fechaBogota(v: unknown): string | null {
  const t = typeof v === 'string' ? Date.parse(v) : NaN
  return Number.isFinite(t) ? new Date(t - 5 * 3600_000).toISOString().slice(0, 10) : null
}

export function toArrendadorTsf(p: ExternalPropietario): ArrendadorTsf | null {
  const id = numero(p.landlord?.id)
  const nombre = texto(p.landlord?.name)
  if (!id || !nombre) return null
  const tipo = p.landlord?.person_type
  return {
    id,
    nombre,
    documento: texto(p.landlord?.document_number),
    tipoPersona: tipo === 'NP' ? 'natural' : tipo === 'LP' ? 'juridica' : null,
    porcentaje: numero(p.payment_percentage) ?? 0,
    recibePago: p.termsheet_receiver === true,
  }
}

export function toArriendoTsf(
  contrato: ExternalArriendo,
  termsheet: ExternalTermsheet,
  propietarios: ExternalPropietario[],
): ArriendoTsf | null {
  const contratoId = numero(contrato.id)
  if (!contratoId) return null
  const proyectos = Math.max(termsheet.projects_data?.length ?? 0, 1)
  const canon = numero(termsheet.actual_rent_annual_cost_cop)
  return {
    contratoId,
    firmado: contrato.is_signed === true || termsheet.is_signed === true,
    // El contrato casi nunca trae su fecha; la de la termsheet es la que se firmó.
    fechaFirma: fechaBogota(contrato.signed_at) ?? fechaBogota(termsheet.signed_at),
    periodicidad: PERIODICIDAD[String(termsheet.frequency)] ?? null,
    canonAnual: canon === null ? null : Math.round(canon / proyectos),
    proyectosTerreno: proyectos,
    arrendadores: propietarios.map(toArrendadorTsf).filter((a): a is ArrendadorTsf => a !== null),
  }
}

/**
 * El contrato de arrendamiento del proyecto: el `LeasingContract` del terreno que
 * es de ESTE proyecto, su termsheet (canon, periodicidad, firma) y los
 * propietarios con su porcentaje. Nunca lanza: sin contrato, null.
 */
export async function arriendoDeTsf(
  event: H3Event,
  autorizacion: string,
  proyectoId: number,
  terrenoId: number,
): Promise<ArriendoTsf | null> {
  try {
    const query = { terrain: terrenoId }
    const [contratos, propietarios] = await Promise.all([
      $fetch<ExternalArriendo[] | { results?: ExternalArriendo[] }>(RUTAS.arriendos, {
        ...opciones(event, autorizacion),
        query,
      }),
      $fetch<{ results?: ExternalPropietario[] }>(RUTAS.propietarios, {
        ...opciones(event, autorizacion),
        query: { ...query, page_size: 100 },
      }),
    ])
    const lista = Array.isArray(contratos) ? contratos : (contratos.results ?? [])
    const contrato = lista.find((c) => numero(c.project?.id) === proyectoId)
    const termsheetId = numero(contrato?.termsheet)
    if (!contrato || !termsheetId) return null
    const termsheet = await $fetch<ExternalTermsheet>(
      RUTAS.termsheet(termsheetId),
      opciones(event, autorizacion),
    )
    return toArriendoTsf(contrato, termsheet, propietarios.results ?? [])
  } catch {
    return null
  }
}

/** El arriendo de una minigranja, sin el resto del detalle. Lanza solo si la minigranja no se puede leer. */
export async function arriendoDeMinigranja(
  event: H3Event,
  autorizacion: string,
  id: number,
): Promise<ArriendoTsf | null> {
  let minigranja: ExternalMinigranja
  try {
    minigranja = await $fetch<ExternalMinigranja>(
      RUTAS.minigranja(id),
      opciones(event, autorizacion),
    )
  } catch (err) {
    throw errorDeOriginabot(err)
  }
  const proyectoId = numero(minigranja.project?.id)
  const terrenoId = numero(minigranja.project?.terrain_id)
  return proyectoId && terrenoId ? arriendoDeTsf(event, autorizacion, proyectoId, terrenoId) : null
}

export async function minigranjaDeTsf(
  event: H3Event,
  autorizacion: string,
  id: number,
): Promise<ProyectoTsf> {
  let minigranja: ExternalMinigranja
  try {
    minigranja = await $fetch<ExternalMinigranja>(
      RUTAS.minigranja(id),
      opciones(event, autorizacion),
    )
  } catch (err) {
    throw errorDeOriginabot(err)
  }

  // Segunda llamada solo por el `code` del operador de red. Si falla, el import
  // sigue: el operador cae al cruce por nombre y, si no encaja, queda editable.
  const proyectoId = numero(minigranja.project?.id)
  const proyecto = proyectoId
    ? await $fetch<ExternalProyecto>(
        RUTAS.proyecto(proyectoId),
        opciones(event, autorizacion),
      ).catch(() => null)
    : null

  const terrenoId = numero(minigranja.project?.terrain_id)
  const [presimulacion, ecs, arriendo] = await Promise.all([
    presimulacionDeTsf(event, autorizacion, id),
    proyectoId && texto(minigranja.name)
      ? ecsDeTsf(event, autorizacion, texto(minigranja.name)!, proyectoId)
      : Promise.resolve(null),
    proyectoId && terrenoId
      ? arriendoDeTsf(event, autorizacion, proyectoId, terrenoId)
      : Promise.resolve(null),
  ])
  return { ...toProyectoTsf(minigranja, proyecto), ...presimulacion, ecs, arriendo }
}
