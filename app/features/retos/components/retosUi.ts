/**
 * Helpers compartidos del módulo Retos Q.
 *
 * El semáforo lo calcula el backend (campo `estado` del contrato); acá solo se
 * traduce a color de `GBadge` (texto/chip) o, para los gráficos (anillo,
 * bullet, sparkline), al hex de marca que necesita un trazo SVG — un `<path>`
 * no puede pintarse con un token de Tailwind.
 */
import type { DireccionMetrica, EstadoMetrica, EstadoPeriodoReto } from '~/features/retos/types'

/**
 * Borra una clave de un diccionario reactivo (`reactive({})`) indexado por id
 * o clave compuesta. Es un `Record` plano a propósito — la matriz y el drawer
 * lo leen con corchetes en decenas de sitios de la plantilla — así que no es
 * el caso de "usa un `Map`" que pide la regla de lint; este helper centraliza
 * la única excepción real en un solo sitio.
 */
export function borrarClave<T extends Record<string | number, unknown>>(obj: T, key: keyof T) {
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete obj[key]
}

export type BadgeColor =
  'default' | 'action' | 'information' | 'success' | 'warning' | 'destructive'

const ESTADO_GRAFICO: Record<EstadoMetrica, string> = {
  sin_datos: '#9b8fb0',
  en_riesgo: '#D64455',
  atencion: '#CA8A04',
  cumple: '#10B981',
  excede: '#14B8A6',
}

const ESTADO_BADGE: Record<EstadoMetrica, BadgeColor> = {
  sin_datos: 'default',
  en_riesgo: 'destructive',
  atencion: 'warning',
  cumple: 'success',
  excede: 'information',
}

const ESTADO_LABEL: Record<EstadoMetrica, string> = {
  sin_datos: 'Sin datos',
  en_riesgo: 'En riesgo',
  atencion: 'Atención',
  cumple: 'Cumple',
  excede: 'Excede',
}

export function estadoColor(estado?: EstadoMetrica | null): string {
  return ESTADO_GRAFICO[estado ?? 'sin_datos']
}

export function estadoBadgeColor(estado?: EstadoMetrica | null): BadgeColor {
  return ESTADO_BADGE[estado ?? 'sin_datos']
}

export function estadoLabel(estado?: EstadoMetrica | null): string {
  return ESTADO_LABEL[estado ?? 'sin_datos']
}

/** Estados del período del trimestre (no del cumplimiento). */
const PERIODO_BADGE: Record<EstadoPeriodoReto, BadgeColor> = {
  proximo: 'default',
  en_curso: 'information',
  cerrado: 'default',
}

const PERIODO_LABEL: Record<EstadoPeriodoReto, string> = {
  proximo: 'Próximo',
  en_curso: 'En curso',
  cerrado: 'Cerrado',
}

export function periodoBadgeColor(periodo?: EstadoPeriodoReto | null): BadgeColor {
  return PERIODO_BADGE[periodo ?? 'proximo']
}

export function periodoLabel(periodo?: EstadoPeriodoReto | null): string {
  return PERIODO_LABEL[periodo ?? 'proximo']
}

// ── Formato numérico ────────────────────────────────────────────────────────
// Locale es-CO: miles con punto, decimal con coma.

/** Número crudo con los decimales de la métrica. Sin unidad. */
export function fmtNumero(valor: number | string | null | undefined, decimales = 0): string | null {
  if (valor === null || valor === undefined || valor === '') return null
  const n = Number(valor)
  if (!Number.isFinite(n)) return null
  const d = Math.min(Math.max(Number(decimales) || 0, 0), 4)
  return n.toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d })
}

/**
 * Valor formateado con unidad. `%` va pegado, el resto separado por espacio.
 * Devuelve `vacio` (por defecto guion largo) cuando no hay dato.
 */
export function fmtValor(
  valor: number | string | null | undefined,
  decimales = 0,
  unidad = '',
  vacio = '—',
): string {
  const base = fmtNumero(valor, decimales)
  if (base === null) return vacio
  const u = (unidad || '').trim()
  if (!u) return base
  return u === '%' ? `${base}%` : `${base} ${u}`
}

/** Porcentajes de avance/cumplimiento: 1 decimal. */
export function fmtPct(valor: number | string | null | undefined, decimales = 1): string {
  const base = fmtNumero(valor, decimales)
  return base === null ? '—' : `${base}%`
}

/** Versión entera, para espacios apretados (anillo, columna % de la matriz). */
export function fmtPctEntero(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined) return '—'
  const n = Number(valor)
  if (!Number.isFinite(n)) return '—'
  return `${Math.round(n)}%`
}

/**
 * Parsea lo que el usuario escribe en una celda.
 * Acepta "1.240,5" (es-CO), "1240.5" (crudo), espacios y signo.
 * Devuelve `null` si está vacío, `NaN` si es basura — el llamador distingue.
 */
export function parseValor(texto: string | number | null | undefined): number | null {
  if (texto === null || texto === undefined) return null
  const limpio = String(texto).trim().replace(/\s/g, '')
  if (limpio === '') return null

  let normalizado = limpio
  const tieneComa = limpio.includes(',')
  const tienePunto = limpio.includes('.')

  if (tieneComa && tienePunto) {
    // Formato es-CO completo: el punto es separador de miles.
    normalizado = limpio.replace(/\./g, '').replace(',', '.')
  } else if (tieneComa) {
    normalizado = limpio.replace(',', '.')
  } else if (tienePunto) {
    // "1.240" es ambiguo. Se trata como miles solo si los grupos son de 3 dígitos.
    const partes = limpio.replace('-', '').split('.')
    const esMiles = partes.length > 1 && partes.slice(1).every((p) => p.length === 3)
    if (esMiles) normalizado = limpio.replace(/\./g, '')
  }

  const n = Number(normalizado)
  return Number.isFinite(n) ? n : Number.NaN
}

/** Fecha ISO (`2026-07-01`) a `1 jul 2026`, sin depender de la zona horaria. */
export function fmtFechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [a, m, d] = String(iso).split('-').map(Number)
  if (!a || !m || !d) return '—'
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${d} ${MESES[m - 1]} ${a}`
}

/** Rango de fechas de un trimestre: `1 jul – 30 sep 2026`. */
export function fmtRango(
  inicioIso: string | null | undefined,
  finIso: string | null | undefined,
): string {
  if (!inicioIso || !finIso) return '—'
  const [ai, mi, di] = String(inicioIso).split('-').map(Number)
  const [af, mf, df] = String(finIso).split('-').map(Number)
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const izq = `${di} ${MESES[(mi ?? 1) - 1]}${ai !== af ? ` ${ai}` : ''}`
  return `${izq} – ${df} ${MESES[(mf ?? 1) - 1]} ${af}`
}

export const TIPOS_AGREGACION: { value: string; label: string; ayuda: string }[] = [
  { value: 'suma', label: 'Suma', ayuda: 'El consolidado es la suma de las semanas' },
  {
    value: 'promedio',
    label: 'Promedio',
    ayuda: 'El consolidado es el promedio de las semanas con dato',
  },
  { value: 'ultimo', label: 'Último valor', ayuda: 'Vale la última semana registrada' },
  { value: 'maximo', label: 'Máximo', ayuda: 'Vale la semana más alta' },
]

export const DIRECCIONES: { value: DireccionMetrica; label: string }[] = [
  { value: 'mayor_mejor', label: 'Más es mejor' },
  { value: 'menor_mejor', label: 'Menos es mejor' },
]
