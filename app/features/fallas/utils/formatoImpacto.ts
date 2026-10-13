// ──────────────────────────────────────────────────────────────────────────
// Formato del impacto de una falla: % de la planta afectada y energía perdida.
//
// Los dos los calcula el backend (`pct_afectado`, `kwh_perdidos_p90`); acá
// solo se muestran, en es-CO. Una pérdida de miles de kWh se lee mejor en MWh.
// ──────────────────────────────────────────────────────────────────────────

const LOCALE = 'es-CO'
const KWH_POR_MWH = 1000
const SIN_DATO = '—'

function numero(v: number | null | undefined): number | null {
  const n = Number(v)
  return v == null || !Number.isFinite(n) ? null : n
}

/**
 * Energía en kWh, o en MWh desde 1.000 kWh.
 *
 *     12.34   → "12,3 kWh"
 *     1234.5  → "1,23 MWh"
 *     null    → "—"
 */
export function formatoEnergia(kwh: number | null | undefined): string {
  const n = numero(kwh)
  if (n == null) return SIN_DATO
  if (Math.abs(n) >= KWH_POR_MWH) {
    const mwh = (n / KWH_POR_MWH).toLocaleString(LOCALE, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    return `${mwh} MWh`
  }
  return `${n.toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kWh`
}

/**
 * Porcentaje de la planta afectada (llega en 0–100).
 *
 *     66      → "66 %"
 *     33.333  → "33,3 %"
 *     null    → "—"
 */
export function formatoPctAfectado(pct: number | null | undefined): string {
  const n = numero(pct)
  if (n == null) return SIN_DATO
  return `${n.toLocaleString(LOCALE, { maximumFractionDigits: 1 })} %`
}
