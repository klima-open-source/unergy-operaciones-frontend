<script setup lang="ts">
import { UsersIcon } from '@lucide/vue'
import type {
  InversionistaResumenPanel,
  ProyectoResumenPanel,
} from '~/features/liquidaciones/types'
import { fmtCOP } from '~/features/liquidaciones/utils/liquidaciones'

// `panel` = entrada de proyecto de /liquidaciones/resumen-panel (fuente única: el
// Panel Contable). filtroPiId opcional: mostrar solo ese inversionista (nav ?inv=).
const props = defineProps<{
  panel?: ProyectoResumenPanel | null
  filtroPiId?: number | null
}>()

interface GrupoDef {
  key: string
  label: string
}

const GRUPOS: GrupoDef[] = [
  { key: 'ingresos', label: 'Ingresos' },
  { key: 'comercializacion', label: 'Comercialización / Bolsa' },
  { key: 'costos', label: 'Costos operativos (OPEX)' },
  { key: 'facturas', label: 'Facturas de servicio' },
]

// Todos los inversionistas del panel (para el Total = 100%) y los que se muestran.
const todos = computed<InversionistaResumenPanel[]>(() => props.panel?.inversionistas || [])
const mostrados = computed(() =>
  props.filtroPiId != null
    ? todos.value.filter((i) => i.proyecto_inversionista_id === props.filtroPiId)
    : todos.value,
)

const colId = (inv: InversionistaResumenPanel) =>
  'inv' + (inv.proyecto_inversionista_id ?? inv.cliente_id ?? inv.nombre)

interface Columna {
  id: string
  nombre: string
  pct: string
  es_total?: boolean
  valor_a_pagar: number | null | undefined
}

const columnas = computed<Columna[]>(() => {
  if (!props.panel) return []
  const cols: Columna[] = [
    {
      id: 'total',
      nombre: 'Total',
      pct: '100%',
      es_total: true,
      valor_a_pagar: props.panel.valor_a_pagar_total,
    },
  ]
  for (const inv of mostrados.value) {
    cols.push({
      id: colId(inv),
      nombre: inv.cliente_nombre || inv.nombre || 'Inversionista',
      pct: inv.porcentaje != null ? inv.porcentaje.toFixed(2) + '%' : '—',
      valor_a_pagar: inv.valor_a_pagar,
    })
  }
  return cols
})

interface LineaConsolidada {
  concepto: string
  celdas: Record<string, number | null>
  origen: string | null
  comprobante: string | null
}

interface GrupoConsolidado {
  key: string
  label: string
  lineas: LineaConsolidada[]
  sub: Record<string, number | null>
}

const grupos = computed<GrupoConsolidado[]>(() => {
  if (!props.panel) return []
  const out: GrupoConsolidado[] = []
  for (const g of GRUPOS) {
    // Unión de conceptos del grupo, en orden de aparición (sobre todos los inv).
    const order: string[] = []
    const seen = new Set<string>()
    for (const inv of todos.value)
      for (const c of inv.conceptos || [])
        if (c.grupo === g.key && !seen.has(c.concepto)) {
          seen.add(c.concepto)
          order.push(c.concepto)
        }
    if (!order.length) continue

    const sumConcepto = (invs: InversionistaResumenPanel[], concepto: string) =>
      invs.reduce(
        (s, inv) =>
          s +
          (inv.conceptos || [])
            .filter((c) => c.grupo === g.key && c.concepto === concepto)
            .reduce((a, x) => a + (x.valor_cop || 0), 0),
        0,
      )

    // Meta (origen hoja!celda + comprobante) por concepto — es del 100%, igual en
    // todas las columnas; se toma del primer concepto que la traiga (trazabilidad).
    const metaDe = (concepto: string) => {
      for (const inv of todos.value)
        for (const c of inv.conceptos || [])
          if (c.grupo === g.key && c.concepto === concepto && (c.origen || c.comprobante_contable))
            return { origen: c.origen || null, comprobante: c.comprobante_contable || null }
      return { origen: null, comprobante: null }
    }

    const lineas: LineaConsolidada[] = order.map((concepto) => {
      const celdas: Record<string, number | null> = { total: sumConcepto(todos.value, concepto) } // Total = 100% (todos)
      for (const inv of mostrados.value) celdas[colId(inv)] = sumConcepto([inv], concepto)
      return { concepto, celdas, ...metaDe(concepto) }
    })

    // Subtotales por columna (Total sobre todos; cada inv desde grupos_totales).
    const sub: Record<string, number | null> = {
      total: todos.value.reduce((s, inv) => s + ((inv.grupos_totales || {})[g.key] || 0), 0),
    }
    for (const inv of mostrados.value) sub[colId(inv)] = (inv.grupos_totales || {})[g.key] ?? null

    out.push({ key: g.key, label: g.label, lineas, sub })
  }
  return out
})
</script>

<template>
  <div v-if="columnas.length && grupos.length" class="overflow-hidden rounded-xl border bg-card">
    <div class="flex items-center gap-2 border-b px-3 py-2">
      <UsersIcon class="size-4 text-primary" />
      <h3 class="text-sm font-bold text-foreground">Estado de Resultados por inversionista</h3>
      <span class="ml-auto text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Espejo del Panel Contable
      </span>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full border-collapse text-xs">
        <thead>
          <tr class="bg-muted/40">
            <th
              class="sticky left-0 z-10 min-w-40 bg-muted/40 px-3 py-1.5 text-left text-xs font-bold tracking-wide text-primary uppercase"
            >
              Concepto
            </th>
            <th
              v-for="c in columnas"
              :key="c.id"
              class="min-w-27 px-3 py-1.5 text-right align-bottom whitespace-nowrap"
              :class="c.es_total ? 'bg-primary/5' : 'bg-muted/40'"
            >
              <div class="flex flex-col items-end gap-0.5">
                <span
                  class="max-w-40 truncate font-bold"
                  :class="c.es_total ? 'text-primary' : 'text-foreground'"
                  :title="c.nombre"
                >
                  {{ c.nombre }}
                </span>
                <span class="font-mono text-xs text-muted-foreground/70 tabular-nums">{{
                  c.pct
                }}</span>
              </div>
            </th>
          </tr>
        </thead>

        <tbody>
          <template v-for="g in grupos" :key="g.key">
            <tr class="bg-muted/20">
              <td
                class="sticky left-0 z-10 bg-muted/20 px-3 py-1 text-xs font-bold tracking-wide text-primary uppercase"
              >
                {{ g.label }}
              </td>
              <td
                v-for="c in columnas"
                :key="c.id"
                class="px-3 py-1 text-right font-mono font-bold whitespace-nowrap tabular-nums"
                :class="[
                  g.sub[c.id] == null
                    ? 'text-muted-foreground/40'
                    : g.sub[c.id]! < 0
                      ? 'text-destructive'
                      : 'text-foreground',
                  c.es_total ? 'bg-primary/5' : '',
                ]"
              >
                <template v-if="g.sub[c.id] != null">{{ fmtCOP(g.sub[c.id]) }}</template>
                <template v-else>—</template>
              </td>
            </tr>
            <tr v-for="l in g.lineas" :key="g.key + '_' + l.concepto" class="border-t">
              <td class="sticky left-0 z-10 bg-card px-3 py-1">
                <span class="flex flex-wrap items-center gap-1.5 pl-3 text-muted-foreground">
                  {{ l.concepto }}
                  <span
                    v-if="l.origen"
                    class="rounded bg-primary/10 px-1 py-0.5 font-mono text-xs text-primary"
                    title="Celda de origen en el ER"
                    >{{ l.origen }}</span
                  >
                  <span
                    v-if="l.comprobante"
                    class="rounded bg-primary/10 px-1 py-0.5 text-xs text-primary"
                    title="Comprobante contable"
                    >{{ l.comprobante }}</span
                  >
                </span>
              </td>
              <td
                v-for="c in columnas"
                :key="c.id"
                class="px-3 py-1 text-right align-top font-mono whitespace-nowrap text-muted-foreground tabular-nums"
                :class="c.es_total ? 'bg-primary/[0.04]' : ''"
              >
                {{ l.celdas[c.id] != null ? fmtCOP(l.celdas[c.id]) : '—' }}
              </td>
            </tr>
          </template>
        </tbody>

        <tfoot>
          <tr class="border-t-2 border-primary bg-primary/5">
            <td class="sticky left-0 z-10 bg-primary/5 px-3 py-2 font-extrabold text-foreground">
              Valor a pagar
            </td>
            <td
              v-for="c in columnas"
              :key="c.id"
              class="bg-primary/5 px-3 py-2 text-right font-mono font-extrabold whitespace-nowrap text-primary tabular-nums"
            >
              {{ fmtCOP(c.valor_a_pagar) }}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
</template>
