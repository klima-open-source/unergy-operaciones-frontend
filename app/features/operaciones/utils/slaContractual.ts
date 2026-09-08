// ──────────────────────────────────────────────────────────────────────────
// SLA CONTRACTUAL del informe de FMO (Anexo 4), en días.
//
// **No confundir con el SLA operativo de la plataforma**, que va en horas según
// la prioridad (8 / 24 / 72 / 168) y llega desde el backend como
// `sla_limite_horas_efectivo`, `sla_horas_transcurridas`, `sla_pct` y
// `sla_cumplido`. Son dos compromisos distintos y coexisten a propósito: este
// mide el plazo de revisión que el contrato de O&M le promete al cliente, y sus
// umbrales dependen de la CATEGORÍA de la falla, no de su prioridad.
//
// Se extrajo de `InformesMensualesPanel.vue` para poder probarlo: vivía dentro
// del componente y ahí nadie lo cubría.
// ──────────────────────────────────────────────────────────────────────────

/** Lo que este cálculo necesita de una falla. */
export interface FallaParaSla {
  fecha_identificacion?: string | null
  /** Días que la falla estuvo abierta. Lo calcula el backend. */
  dias_abierta?: number | null
  clasificacion?: { categoria?: string | null } | null
  tipo?: { codigo?: string | null } | null
  estado?: { codigo?: string | null } | null
}

export interface ResultadoSla {
  dias: number
  slaRevision: number
  slaLabel: string
  cumple: boolean
}

/**
 * Umbral de revisión en días según la categoría de la falla.
 *
 *   - `red` (desconexión de suministro) → crítico, 2 días
 *   - `frontera`, `inversores`, `generando_sin_datos` → grave, 3 días
 *   - `eventos_adversos` (externos) → medio, 4 días
 *
 * Sin `clasificacion` cae al primer dígito de `tipo.codigo`, que es cómo se
 * clasificaban las fallas antes del reporte estructurado.
 */
function umbral(f: FallaParaSla): { slaRevision: number, slaLabel: string } {
  const critico = { slaRevision: 2, slaLabel: 'Crítico (≥90%)' }
  const grave = { slaRevision: 3, slaLabel: 'Grave (66-90%)' }
  const medio = { slaRevision: 4, slaLabel: 'Medio (<66%)' }

  const cat = f?.clasificacion?.categoria
  if (cat) {
    if (cat === 'frontera' || cat === 'inversores' || cat === 'generando_sin_datos') return grave
    if (cat === 'eventos_adversos') return medio
    return critico
  }

  const pre = String(f.tipo?.codigo || '').charAt(0)
  if (pre === '1') return grave
  if (pre === '4' || pre === '5') return medio
  return critico
}

/**
 * Días abiertos, umbral contractual y si cumple, para la tabla del Anexo 4.
 *
 * `dias` sale de `dias_abierta` del backend, que **sí mira `fecha_resolucion`**:
 * para una falla cerrada son los días que estuvo abierta. Antes se calculaba acá
 * con `Date.now() - fecha_identificacion`, sin mirar la resolución, así que una
 * falla cerrada en un día pero identificada tres meses atrás imprimía "90d" en
 * la columna "DÍAS ABIERTA" **del informe que se le manda al cliente**.
 *
 * Para una falla ABIERTA el valor es el mismo que antes (hoy − identificación),
 * así que `cumple` no cambia de comportamiento en el único caso donde depende de
 * `dias`.
 *
 * `cumple` para una falla cerrada es siempre `true` — se conserva tal cual venía.
 * Significa que el informe no reporta incumplimiento en incidentes ya cerrados,
 * aunque se hayan cerrado tarde; es una regla del contrato, no un detalle de
 * implementación, y cambiarla es una decisión de negocio.
 */
export function calcSla(f: FallaParaSla): ResultadoSla {
  const { slaRevision, slaLabel } = umbral(f)

  if (!f.fecha_identificacion) {
    return { dias: 0, slaRevision: 2, slaLabel: 'Crítico (≥90%)', cumple: true }
  }

  const dias = Math.max(0, Math.floor(Number(f.dias_abierta ?? 0)) || 0)
  const cumple = f.estado?.codigo === 'cerrada' ? true : dias <= slaRevision
  return { dias, slaRevision, slaLabel, cumple }
}
