// Fechas de día (`YYYY-MM-DD`) de las fallas, en es-CO.
//
// `new Date('2026-10-13')` se interpreta en UTC y en Colombia (UTC−5) se pinta
// como el 12: por eso se arma a medianoche LOCAL.

/**
 * `"2026-10-13"` → `"13 oct 2026"`. Acepta también un timestamp (toma el día).
 * Vacío → `"—"`.
 */
export function formatoFechaDia(fecha: string | null | undefined): string {
  if (!fecha) return '—'
  const d = new Date(`${fecha.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}
