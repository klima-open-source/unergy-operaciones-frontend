// ──────────────────────────────────────────────────────────────────────────
// Formato del límite de SLA operativo para mostrarlo.
//
// El backend manda las horas (`sla_limite_horas_efectivo`) y también su división
// entera por 24 (`sla_limite_dias`). Mostrar las dos crudas daba resultados
// absurdos: una falla crítica de 8 h se veía como **"8h (0d)"**, y un límite
// personalizado de 36 h como "36h (1d)", truncando día y medio a uno.
//
// La regla: las horas siempre, y los días solo cuando llegan a uno — con su
// singular y su decimal en coma, que es la convención de es-CO.
// ──────────────────────────────────────────────────────────────────────────

const HORAS_POR_DIA = 24

/**
 * El límite de SLA como se muestra.
 *
 *     8   → "8 h"
 *     24  → "24 h (1 día)"
 *     72  → "72 h (3 días)"
 *     36  → "36 h (1,5 días)"
 *
 * @param horas `sla_limite_horas_efectivo`. Nulo o no positivo → "Sin límite".
 */
export function formatoLimiteSla(horas: number | null | undefined): string {
  const h = Number(horas)
  if (!Number.isFinite(h) || h <= 0) return 'Sin límite'

  if (h < HORAS_POR_DIA) return `${h} h`

  const dias = h / HORAS_POR_DIA
  const texto = Number.isInteger(dias)
    ? String(dias)
    : dias.toFixed(1).replace('.', ',')
  return `${h} h (${texto} ${dias === 1 ? 'día' : 'días'})`
}
