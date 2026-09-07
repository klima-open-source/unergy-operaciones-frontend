/** Formateo de moneda — antes reimplementado localmente en más de una decena de vistas. */

const cop = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

/** Pesos colombianos sin decimales: `$1.234.567`. Sin valor → `'—'`. */
export function formatCOP(v: number | string | null | undefined): string {
  if (v == null || v === '') return '—'
  return cop.format(Number(v))
}
