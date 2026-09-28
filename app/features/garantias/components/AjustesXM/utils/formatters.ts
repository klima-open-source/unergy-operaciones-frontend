/**
 * Formateo puntual de `AjustesXM`. El formato de moneda vive en `~/utils/currency`
 * (`formatCOP`, auto-importado) — este archivo solo tiene lo propio del slice.
 */

/** Fecha local a `'YYYY-MM-DD'`. */
export function fmtISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * El viernes de la semana de `base` (hoy por defecto): el asistente semanal
 * propone esa fecha como "fecha objetivo" para descontar facturas. Vive aquí
 * y no en `useFacturasPDF` porque es pura — importar ese módulo carga
 * `pdfjs-dist`, que no corre fuera de un navegador (ni en Vitest).
 */
export function viernesDeEstaSemana(base = new Date()): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate())
  const day = d.getDay()
  const diff = 5 - day
  d.setDate(d.getDate() + diff)
  return d
}
