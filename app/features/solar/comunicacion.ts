/**
 * Comunicación de cada planta por fuente: inversores (SolarView) y medidor
 * (Quoia). La calcula el sondeo del backend cada 15 min
 * (`apps/monitoreo/services/comunicacion.py`) y llega en `GET /monitoring`.
 *
 * Una fuente está sin comunicación si su último dato llegó hace más de 2 h, o
 * si hoy no llegó ninguno. Reemplaza a la "disponibilidad" de SolarView (en
 * línea / degradado / sin comunicación…), que medía otra cosa.
 *
 * Lo comparten `SolarLiveView.vue` (escritorio) y `MobileSolarView.vue`, para
 * que las dos pinten igual.
 */

import type { TokenColor } from '~/composables/useThemeColors'

export interface FuenteComunicacion {
  sin_comunicacion: boolean
  /** ISO con zona; null si hoy no llegó ningún dato. */
  ultimo_dato: string | null
}

/** `null` en una fuente: la planta no la tiene (p.ej. sin medidor vinculado). */
export interface ComunicacionPlanta {
  inversores?: FuenteComunicacion | null
  medidor?: FuenteComunicacion | null
  evaluado_en?: string
}

/** Si la última consulta a cada servicio falló entera. */
export interface ConsultaFuente {
  fallo: boolean
  consultado_en: string
}

export type Fuente = 'inversores' | 'medidor'

export const FUENTES: Record<Fuente, { label: string; nombre: string; servicio: string }> = {
  inversores: { label: 'Sin comunicación inversores', nombre: 'Inversores', servicio: 'SolarView' },
  medidor: { label: 'Sin comunicación medidores', nombre: 'Medidor', servicio: 'Quoia' },
}

const ORDEN: Fuente[] = ['inversores', 'medidor']

/** `ok` comunica todo · `parcial` falla una fuente · `ninguna` fallan todas las que tiene. */
export type NivelComunicacion = 'evaluando' | 'ok' | 'parcial' | 'ninguna'

/** Token de color semántico de cada nivel (lo resuelve `useThemeColors`). */
export const COLOR_NIVEL: Record<NivelComunicacion, TokenColor> = {
  ok: 'success',
  parcial: 'warning',
  ninguna: 'destructive',
  evaluando: 'muted-foreground',
}

export function sinComunicacion(c: ComunicacionPlanta | null | undefined, fuente: Fuente): boolean {
  return !!c?.[fuente]?.sin_comunicacion
}

/** Las fuentes que no están comunicando, en orden fijo. */
export function fuentesSinComunicacion(c: ComunicacionPlanta | null | undefined): Fuente[] {
  return ORDEN.filter((f) => sinComunicacion(c, f))
}

export function nivelComunicacion(c: ComunicacionPlanta | null | undefined): NivelComunicacion {
  const presentes = ORDEN.filter((f) => c?.[f])
  if (!presentes.length) return 'evaluando'
  const caidas = presentes.filter((f) => sinComunicacion(c, f)).length
  if (!caidas) return 'ok'
  return caidas === presentes.length ? 'ninguna' : 'parcial'
}

/** "hace 20 min" / "hace 3 h" desde un instante ISO. Vacío si no aplica. */
export function haceDesde(iso: string | null | undefined, ahora: Date = new Date()): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const min = Math.floor((ahora.getTime() - t) / 60000)
  if (min < 0) return ''
  if (min < 60) return `hace ${min} min`
  return `hace ${Math.floor(min / 60)} h`
}

/** El tooltip de una planta: cuándo llegó el último dato de cada fuente. */
export function detalleComunicacion(
  c: ComunicacionPlanta | null | undefined,
  ahora: Date = new Date(),
): string {
  if (nivelComunicacion(c) === 'evaluando') return 'Comunicación sin evaluar todavía'
  return ORDEN.map((f) => {
    const fuente = c?.[f]
    if (!fuente) return `${FUENTES[f].nombre}: no tiene`
    if (!fuente.ultimo_dato) return `${FUENTES[f].nombre}: sin datos hoy`
    return `${FUENTES[f].nombre}: último dato ${haceDesde(fuente.ultimo_dato, ahora)}`
  }).join(' · ')
}

/** "⚠ SolarView no respondió en la última consulta (hace 20 min)." por cada servicio caído. */
export function avisosConsultas(
  consultas: Partial<Record<Fuente, ConsultaFuente>> | null | undefined,
  ahora: Date = new Date(),
): string[] {
  return ORDEN.filter((f) => consultas?.[f]?.fallo).map((f) => {
    const hace = haceDesde(consultas![f]!.consultado_en, ahora)
    return `⚠ ${FUENTES[f].servicio} no respondió en la última consulta${hace ? ` (${hace})` : ''}.`
  })
}
