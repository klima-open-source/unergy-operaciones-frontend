/** Formato y parseo de valores del Panel Contable. Puro, sin estado. */
import { FUENTES } from '~/features/panel-contable/constants'
import { type FuenteLinea, GrupoLinea, type LineaPanel } from '~/features/panel-contable/types'
import { formatCOP } from '~/utils/currency'

/**
 * Formato de línea contable: redondeado, `$ ` es-CO, y `–` en vez de `$ 0`
 * (una línea en cero se lee como "sin valor", no como un cero real).
 */
export function fmt(n: number | null | undefined): string {
  const r = Math.round(Number(n) || 0)
  return r === 0 ? '–' : formatCOP(r)
}

export function shortName(nombre: string | null | undefined): string {
  return (nombre || '').split(' ').slice(0, 2).join(' ')
}

export function diffClass(v: number | null | undefined): string {
  if (v == null) return ''
  return v > 0 ? 'pos' : v < 0 ? 'neg' : ''
}

/** Clase Tailwind para colorear una diferencia: verde si sube, roja si baja. */
export function diffTextClass(v: number | null | undefined): string {
  const c = diffClass(v)
  return c === 'pos' ? 'text-emerald-600' : c === 'neg' ? 'text-destructive' : ''
}

export function arrow(v: number | null | undefined): string {
  if (v == null || v === 0) return ''
  return v > 0 ? '▲ ' : '▼ '
}

/** Monto en edición: número plano (sin formato), para no romper la escritura. */
export function montoPlano(n: number | null | undefined): string {
  return n === null || n === undefined ? '' : String(n)
}

export function parseMonto(s: string): number {
  const v = Number.parseFloat(String(s).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(v) ? v : 0
}

export function fuenteLabel(f: FuenteLinea | undefined): string {
  return (f && FUENTES[f]?.label) || f || ''
}

export function fuenteTitle(f: FuenteLinea | undefined): string {
  return (f && FUENTES[f]?.title) || f || ''
}

export function fuenteOrigen(f: FuenteLinea | undefined): string {
  return (f && FUENTES[f]?.origen) || 'de un módulo'
}

/** Parsea el formato `hoja!celda` (ej. `Sheet1!H35`) que usa el mapeo de celdas del ER. */
export function parseCeldaOrigen(texto: string): { hoja: string; celda: string } | null {
  const m = String(texto).trim().match(/^([^!]+)!\s*([A-Za-z]+\d+)\s*$/)
  if (!m) return null
  const [, hoja, celda] = m
  if (!hoja || !celda) return null
  return { hoja: hoja.trim(), celda: celda.trim().toUpperCase() }
}

/** Líneas del total 100% que aún se pueden remapear a una celda del ER: Ingresos/Comercialización, no derivadas. */
export function lineasMapeables(lineas: LineaPanel[]): LineaPanel[] {
  return (lineas || []).filter(
    (l) => (l.grupo === GrupoLinea.INGRESOS || l.grupo === GrupoLinea.COMERCIALIZACION) && !l.derivada,
  )
}
