<script setup lang="ts">
import type { DataTableColumn, DataTableRow } from '~/components/blocks/DataTable.vue'
import type {
  ContratoDescubrimientoMes,
  DescubrimientosCumplimiento,
  MesDescubrimientos,
} from '~/features/mem/types'
import { ChevronDownIcon, ChevronRightIcon, CircleCheckIcon, XIcon, ZapIcon } from '@lucide/vue'
// Import explícito: el auto-import de Nuxt sintetiza mal los tipos de props de `DataTable`.
import DataTable from '~/components/blocks/DataTable.vue'
import { CumplimientoService } from '~/features/mem/services/cumplimiento'

const cumplimientoService = new CumplimientoService()

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]
const MESES_CORTOS = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
]
const MESES_OPTIONS = MESES.map((m, i) => ({ label: m, value: String(i + 1) }))

const now = new Date()
const years = Array.from({ length: 18 }, (_, i) => String(2024 + i))

const query = useQuery<DescubrimientosCumplimiento>()
const selectedYear = ref(String(now.getFullYear()))
const monthFrom = ref('1')
const monthTo = ref('12')
const expandedMonth = ref<number | null>(null)
const hovered = ref<number | null>(null)
const tooltipX = ref(0)
const tooltipY = ref(0)
const chartBox = ref<HTMLDivElement | null>(null)

// ── Chart constants ──────────────────────────────────────────────────────────
const SVG_W = 820
const SVG_H = 300
const PAD_L = 72
const PAD_R = 22
const PAD_T = 18
const PAD_B = 42
const PLOT_W = SVG_W - PAD_L - PAD_R
const PLOT_H = SVG_H - PAD_T - PAD_B

const chartMeses = computed<MesDescubrimientos[]>(() => query.data?.meses || [])
/** El mes bajo el cursor -- computado una vez, para no reindexar `chartMeses` en cada interpolación del tooltip. */
const hoveredMes = computed<MesDescubrimientos | null>(() =>
  hovered.value !== null ? (chartMeses.value[hovered.value] ?? null) : null,
)
const N = computed(() => chartMeses.value.length || 12)
const slotW = computed(() => PLOT_W / (N.value || 1))
const barHalfW = computed(() => slotW.value * 0.24)

const yAbsMax = computed(() => {
  let m = 0
  for (const mes of chartMeses.value) {
    m = Math.max(m, mes.compras_cop || 0, mes.excedentes_cop || 0)
  }
  return m > 0 ? m * 1.2 : 1000000
})

const zeroY = computed(() => PAD_T + PLOT_H / 2)

const yGridLines = computed(() => {
  const step = niceStep(yAbsMax.value)
  const lines: { val: number; y: number }[] = []
  for (let v = step; v <= yAbsMax.value; v += step) {
    lines.push({ val: v, y: toY(v) })
    lines.push({ val: -v, y: toY(-v) })
  }
  lines.push({ val: 0, y: zeroY.value })
  return lines
})

function niceStep(max: number): number {
  const rough = max / 3
  const mag = 10 ** Math.floor(Math.log10(rough || 1))
  const mult = rough / mag
  if (mult < 1.5) return mag
  if (mult < 3.5) return 2 * mag
  if (mult < 7.5) return 5 * mag
  return 10 * mag
}

function toY(val: number): number {
  return zeroY.value - (val / yAbsMax.value) * (PLOT_H / 2)
}

function slotX(i: number): number {
  return PAD_L + i * slotW.value
}
function barX(i: number): number {
  return PAD_L + i * slotW.value + (slotW.value - barHalfW.value * 2 - 2) / 2
}

// ── Chart interaction ────────────────────────────────────────────────────────
function monthIdxFromEvent(event: MouseEvent): number | null {
  const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect()
  const svgX = (event.clientX - rect.left) * (SVG_W / rect.width)
  const idx = Math.floor((svgX - PAD_L) / slotW.value)
  return idx >= 0 && idx < N.value && svgX >= PAD_L ? idx : null
}

function onSvgMousemove(event: MouseEvent) {
  const idx = monthIdxFromEvent(event)
  hovered.value = idx
  if (idx !== null && chartBox.value) {
    const r = chartBox.value.getBoundingClientRect()
    tooltipX.value = Math.min(event.clientX - r.left + 12, r.width - 240)
    tooltipY.value = event.clientY - r.top - 10
  }
}

function onSvgClick(event: MouseEvent) {
  const idx = monthIdxFromEvent(event)
  if (idx === null || !chartMeses.value[idx]) return
  toggleMonth(chartMeses.value[idx].month)
}

// ── Computed ─────────────────────────────────────────────────────────────────
const mesesConDatos = computed(() => {
  if (!query.data) return 0
  return query.data.meses.filter((m) => m.dias_con_precios > 0).length
})

const expandedContratos = computed<ContratoDescubrimientoMes[]>(() => {
  if (!expandedMonth.value || !query.data) return []
  const mes = query.data.meses.find((m) => m.month === expandedMonth.value)
  return mes?.contratos || []
})

// ── Acciones ─────────────────────────────────────────────────────────────────
function toggleMonth(month: number) {
  expandedMonth.value = expandedMonth.value === month ? null : month
}

async function loadData() {
  if (Number(monthFrom.value) > Number(monthTo.value)) return
  expandedMonth.value = null
  await query.run(() =>
    cumplimientoService.obtenerDescubrimientos({
      year: Number(selectedYear.value),
      month_from: Number(monthFrom.value),
      month_to: Number(monthTo.value),
    }),
  )
}

// ── Formatters ───────────────────────────────────────────────────────────────
function fmtCop(v: number | null | undefined): string {
  if (v == null) return '—'
  const abs = Math.abs(v)
  if (abs >= 1e9) return `${v < 0 ? '-' : ''}$${(abs / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `${v < 0 ? '-' : ''}$${(abs / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${v < 0 ? '-' : ''}$${Math.round(abs).toLocaleString('es-CO')}`
  return `$${Math.round(v).toLocaleString('es-CO')}`
}

function fmtMwh(v: number | null | undefined): string {
  if (v == null) return '—'
  return v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.round(v).toLocaleString('es-CO')
}

function fmtPrecio(v: number | null | undefined): string {
  if (v == null) return '—'
  return `$${v.toFixed(2)}/kWh`
}

function fmtShort(val: number): string {
  const abs = Math.abs(val)
  if (abs >= 1e9) return `${val < 0 ? '-' : ''}${(abs / 1e9).toFixed(0)}B`
  if (abs >= 1e6) return `${val < 0 ? '-' : ''}${(abs / 1e6).toFixed(0)}M`
  if (abs >= 1e3) return `${val < 0 ? '-' : ''}${(abs / 1e3).toFixed(0)}K`
  return Math.round(val).toString()
}

const columns: DataTableColumn[] = [
  { key: 'mes', header: 'Mes' },
  { key: 'precio_bolsa', header: 'Precio Bolsa', class: 'text-right' },
  { key: 'dias', header: 'Días', class: 'text-center' },
  { key: 'compras_mwh', header: 'Compras MWh', class: 'text-right' },
  { key: 'compras_cop', header: 'Compras COP', class: 'text-right' },
  { key: 'excedentes_mwh', header: 'Excedentes MWh', class: 'text-right' },
  { key: 'excedentes_cop', header: 'Excedentes COP', class: 'text-right' },
  { key: 'chevron', header: '' },
]

function asMes(row: DataTableRow): MesDescubrimientos {
  return row as unknown as MesDescubrimientos
}

onMounted(loadData)
</script>

<template>
  <div class="space-y-5">
    <PageHeader
      title="Descubrimientos en Bolsa"
      subtitle="Exposición financiera por compras y excedentes de energía valorados a precio de bolsa"
    />

    <!-- Selectores -->
    <div class="flex flex-wrap items-end gap-3">
      <div class="flex flex-col gap-1">
        <label class="text-xs font-semibold tracking-wider text-primary uppercase">Año</label>
        <Select v-model="selectedYear" @update:model-value="loadData">
          <SelectTrigger class="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem v-for="y in years" :key="y" :value="y">{{ y }}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs font-semibold tracking-wider text-primary uppercase">Desde</label>
        <Select v-model="monthFrom" @update:model-value="loadData">
          <SelectTrigger class="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem v-for="op in MESES_OPTIONS" :key="op.value" :value="op.value">{{
              op.label
            }}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs font-semibold tracking-wider text-primary uppercase">Hasta</label>
        <Select v-model="monthTo" @update:model-value="loadData">
          <SelectTrigger class="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem v-for="op in MESES_OPTIONS" :key="op.value" :value="op.value">{{
              op.label
            }}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <AsyncView :query="query">
      <template #loading>
        <div class="flex flex-col items-center justify-center gap-3 py-20">
          <Spinner class="size-10 text-primary" />
          <p class="text-sm text-muted-foreground">Calculando descubrimientos…</p>
        </div>
      </template>

      <template #default="{ data }">
        <div class="space-y-5">
          <!-- KPI cards -->
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div class="rounded-xl border bg-card p-4">
              <div class="mb-1 text-xs font-semibold tracking-wider text-destructive uppercase">
                Compras en Bolsa
              </div>
              <div class="font-mono text-xl font-bold text-destructive">
                {{ fmtCop(data.totales.compras_bolsa_cop) }}
              </div>
              <div class="mt-1 text-xs text-muted-foreground">
                {{ fmtMwh(data.totales.compras_bolsa_mwh) }} MWh
              </div>
            </div>
            <div class="rounded-xl border bg-card p-4">
              <div class="mb-1 text-xs font-semibold tracking-wider text-amber-600 uppercase">
                Excedentes en Bolsa
              </div>
              <div class="font-mono text-xl font-bold text-amber-700">
                {{ fmtCop(data.totales.excedentes_bolsa_cop) }}
              </div>
              <div class="mt-1 text-xs text-muted-foreground">
                {{ fmtMwh(data.totales.excedentes_bolsa_mwh) }} MWh
              </div>
            </div>
            <div class="rounded-xl border bg-card p-4">
              <div class="mb-1 text-xs font-semibold tracking-wider text-primary uppercase">
                Exposición Neta
              </div>
              <div
                class="font-mono text-xl font-bold"
                :class="data.totales.exposicion_neta_cop > 0 ? 'text-destructive' : 'text-success'"
              >
                {{ fmtCop(data.totales.exposicion_neta_cop) }}
              </div>
              <div class="mt-1 text-xs text-muted-foreground">
                {{ data.totales.exposicion_neta_cop > 0 ? 'Costo neto' : 'Ingreso neto' }}
              </div>
            </div>
            <div class="rounded-xl border bg-card p-4">
              <div
                class="mb-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
              >
                Meses con Datos
              </div>
              <div class="font-mono text-xl font-bold text-foreground">
                {{ mesesConDatos
                }}<span class="text-sm font-normal text-muted-foreground">
                  / {{ data.meses.length }}</span
                >
              </div>
              <div class="mt-1 text-xs text-muted-foreground">{{ selectedYear }}</div>
            </div>
          </div>

          <!-- SVG Chart — monthly exposure bars -->
          <div class="rounded-xl border bg-card p-4">
            <p class="mb-3 text-xs font-semibold tracking-widest text-primary uppercase">
              Exposición mensual
            </p>
            <div ref="chartBox" class="relative h-80 w-full select-none">
              <svg
                :viewBox="`0 0 ${SVG_W} ${SVG_H}`"
                preserveAspectRatio="xMidYMid meet"
                class="size-full"
                @mousemove="onSvgMousemove"
                @mouseleave="hovered = null"
                @click="onSvgClick"
              >
                <g v-for="gl in yGridLines" :key="gl.val">
                  <line
                    :x1="PAD_L"
                    :y1="gl.y"
                    :x2="SVG_W - PAD_R"
                    :y2="gl.y"
                    stroke="rgba(44,32,57,0.07)"
                    stroke-width="1"
                  />
                  <text
                    :x="PAD_L - 7"
                    :y="gl.y + 4"
                    text-anchor="end"
                    font-size="10"
                    fill="#7a6e8a"
                  >
                    {{ fmtShort(gl.val) }}
                  </text>
                </g>

                <line
                  :x1="PAD_L"
                  :y1="zeroY"
                  :x2="SVG_W - PAD_R"
                  :y2="zeroY"
                  stroke="rgba(44,32,57,0.25)"
                  stroke-width="1"
                />

                <g v-for="(mes, i) in chartMeses" :key="i">
                  <rect
                    v-if="hovered === i"
                    :x="slotX(i)"
                    :y="PAD_T"
                    :width="slotW"
                    :height="PLOT_H"
                    fill="rgba(145,91,216,0.07)"
                  />
                  <rect
                    v-if="expandedMonth === mes.month"
                    :x="slotX(i)"
                    :y="PAD_T"
                    :width="slotW"
                    :height="PLOT_H"
                    fill="rgba(240,192,64,0.08)"
                  />

                  <rect
                    v-if="mes.compras_cop > 0"
                    :x="barX(i)"
                    :y="toY(mes.compras_cop)"
                    :width="barHalfW"
                    :height="zeroY - toY(mes.compras_cop)"
                    fill="#D64455"
                    opacity="0.85"
                  />
                  <rect
                    v-if="mes.excedentes_cop > 0"
                    :x="barX(i) + barHalfW + 2"
                    :y="zeroY"
                    :width="barHalfW"
                    :height="toY(-mes.excedentes_cop) - zeroY"
                    fill="#F0C040"
                    opacity="0.85"
                  />

                  <text
                    :x="barX(i) + barHalfW + 1"
                    :y="SVG_H - PAD_B + 17"
                    text-anchor="middle"
                    font-size="11"
                    :fill="expandedMonth === mes.month ? '#F0C040' : '#7a6e8a'"
                    :font-weight="expandedMonth === mes.month ? '700' : '400'"
                  >
                    {{ MESES_CORTOS[mes.month - 1] }}
                  </text>

                  <rect
                    :x="slotX(i)"
                    :y="PAD_T"
                    :width="slotW"
                    :height="PLOT_H"
                    fill="transparent"
                    class="cursor-pointer"
                  />
                </g>

                <line
                  :x1="PAD_L"
                  :y1="PAD_T"
                  :x2="PAD_L"
                  :y2="PAD_T + PLOT_H"
                  stroke="rgba(44,32,57,0.18)"
                  stroke-width="1"
                />
                <line
                  :x1="PAD_L"
                  :y1="PAD_T + PLOT_H"
                  :x2="SVG_W - PAD_R"
                  :y2="PAD_T + PLOT_H"
                  stroke="rgba(44,32,57,0.18)"
                  stroke-width="1"
                />
              </svg>

              <div
                v-if="hoveredMes"
                class="pointer-events-none absolute z-10 min-w-[220px] rounded-xl px-3.5 py-2.5 text-sm shadow-lg"
                style="background: var(--color-unergy-deep); color: var(--color-unergy-avena)"
                :style="{
                  left: `${tooltipX}px`,
                  top: `${tooltipY}px`,
                  transform: 'translateY(-100%)',
                }"
              >
                <div class="mb-2 font-bold" style="color: #f0c040">
                  {{ MESES[hoveredMes.month - 1] }} {{ selectedYear }}
                </div>
                <div class="space-y-1">
                  <div class="flex justify-between gap-6">
                    <span class="text-white/65">Precio bolsa</span>
                    <span class="font-mono">{{
                      hoveredMes.precio_bolsa_avg ? fmtPrecio(hoveredMes.precio_bolsa_avg) : '—'
                    }}</span>
                  </div>
                  <div class="flex justify-between gap-6">
                    <span style="color: #d64455">Compras</span>
                    <span class="font-mono font-semibold" style="color: #d64455">{{
                      fmtCop(hoveredMes.compras_cop)
                    }}</span>
                  </div>
                  <div class="flex justify-between gap-6">
                    <span style="color: #f0c040">Excedentes</span>
                    <span class="font-mono font-semibold" style="color: #9a6700">{{
                      fmtCop(hoveredMes.excedentes_cop)
                    }}</span>
                  </div>
                  <div class="mt-2 flex justify-between gap-6 border-t border-white/10 pt-2">
                    <span class="text-white/65">Neto</span>
                    <span
                      class="font-mono font-bold"
                      :style="{
                        color:
                          hoveredMes.compras_cop - hoveredMes.excedentes_cop > 0
                            ? '#D64455'
                            : '#2e7d32',
                      }"
                    >
                      {{ fmtCop(hoveredMes.compras_cop - hoveredMes.excedentes_cop) }}
                    </span>
                  </div>
                </div>
                <div class="mt-2 border-t border-white/10 pt-1 text-xs text-white/35">
                  Clic para ver contratos
                </div>
              </div>
            </div>

            <div class="mt-3 flex flex-wrap gap-5 pl-1">
              <div class="flex items-center gap-2 text-xs text-muted-foreground">
                <div class="size-4 rounded-sm" style="background: rgba(214, 68, 85, 0.85)" />
                Compras en bolsa (costo)
              </div>
              <div class="flex items-center gap-2 text-xs text-muted-foreground">
                <div class="size-4 rounded-sm" style="background: rgba(240, 192, 64, 0.85)" />
                Excedentes en bolsa (ingreso)
              </div>
            </div>
          </div>

          <!-- Monthly summary table -->
          <div>
            <h2 class="mb-3 text-base font-semibold text-foreground">
              Resumen mensual — {{ selectedYear }}
            </h2>
            <div class="overflow-hidden rounded-xl border">
              <DataTable
                :columns="columns"
                :rows="data.meses as unknown as DataTableRow[]"
                row-key="month"
                @row-click="(row) => toggleMonth(asMes(row).month)"
              >
                <template #cell="{ row, column }">
                  <span v-if="column.key === 'mes'" class="text-sm font-semibold text-foreground">{{
                    MESES[asMes(row).month - 1]
                  }}</span>
                  <template v-else-if="column.key === 'precio_bolsa'">
                    <span v-if="asMes(row).precio_bolsa_avg" class="font-mono text-sm">{{
                      fmtPrecio(asMes(row).precio_bolsa_avg)
                    }}</span>
                    <span v-else class="text-xs text-muted-foreground/60">Sin datos</span>
                  </template>
                  <span
                    v-else-if="column.key === 'dias'"
                    class="font-mono text-sm"
                    :class="
                      asMes(row).dias_con_precios > 0
                        ? 'text-foreground'
                        : 'text-muted-foreground/60'
                    "
                    >{{ asMes(row).dias_con_precios }}</span
                  >
                  <template v-else-if="column.key === 'compras_mwh'">
                    <span
                      v-if="asMes(row).compras_mwh > 0"
                      class="font-mono text-sm text-destructive"
                      >{{ fmtMwh(asMes(row).compras_mwh) }}</span
                    >
                    <span v-else class="text-xs text-muted-foreground/60">—</span>
                  </template>
                  <template v-else-if="column.key === 'compras_cop'">
                    <span
                      v-if="asMes(row).compras_cop > 0"
                      class="font-mono text-sm font-semibold text-destructive"
                      >{{ fmtCop(asMes(row).compras_cop) }}</span
                    >
                    <span v-else class="text-xs text-muted-foreground/60">—</span>
                  </template>
                  <template v-else-if="column.key === 'excedentes_mwh'">
                    <span
                      v-if="asMes(row).excedentes_mwh > 0"
                      class="font-mono text-sm text-amber-700"
                      >{{ fmtMwh(asMes(row).excedentes_mwh) }}</span
                    >
                    <span v-else class="text-xs text-muted-foreground/60">—</span>
                  </template>
                  <template v-else-if="column.key === 'excedentes_cop'">
                    <span
                      v-if="asMes(row).excedentes_cop > 0"
                      class="font-mono text-sm font-semibold text-amber-700"
                      >{{ fmtCop(asMes(row).excedentes_cop) }}</span
                    >
                    <span v-else class="text-xs text-muted-foreground/60">—</span>
                  </template>
                  <template v-else-if="column.key === 'chevron'">
                    <ChevronDownIcon
                      v-if="expandedMonth === asMes(row).month"
                      class="size-4 text-primary"
                    />
                    <ChevronRightIcon v-else class="size-4 text-primary" />
                  </template>
                </template>
              </DataTable>
            </div>
          </div>

          <!-- Expanded month — contract breakdown -->
          <template v-if="expandedMonth && expandedContratos.length > 0">
            <div class="overflow-hidden rounded-xl border border-primary/25 bg-card">
              <div
                class="flex items-center justify-between border-b border-primary/10 bg-primary/5 px-5 py-3"
              >
                <div>
                  <span class="text-base font-bold text-foreground"
                    >{{ MESES[expandedMonth - 1] }} {{ selectedYear }}</span
                  >
                  <span class="ml-2 text-xs text-muted-foreground"
                    >{{ expandedContratos.length }} contratos con descubrimientos</span
                  >
                </div>
                <button
                  type="button"
                  class="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                  @click="expandedMonth = null"
                >
                  <XIcon class="size-4" />
                </button>
              </div>
              <div class="px-5 py-4">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                      <th class="pb-2 text-left">Contrato</th>
                      <th class="pb-2 text-right">Mín MWh</th>
                      <th class="pb-2 text-right">Máx MWh</th>
                      <th class="pb-2 text-right">Gen. Asig.</th>
                      <th class="pb-2 text-right">Compras</th>
                      <th class="pb-2 text-right">Excedentes</th>
                      <th class="pb-2 text-right">Sobrecosto PPA</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="c in expandedContratos" :key="c.contrato_id" class="border-t">
                      <td class="py-2 pr-2">
                        <div class="font-medium text-foreground">{{ c.nombre }}</div>
                        <div class="text-xs text-muted-foreground">{{ c.comprador }}</div>
                      </td>
                      <td class="px-2 py-2 text-right font-mono text-muted-foreground">
                        {{ fmtMwh(c.min_mwh) }}
                      </td>
                      <td class="px-2 py-2 text-right font-mono text-muted-foreground">
                        {{ fmtMwh(c.max_mwh) }}
                      </td>
                      <td class="px-2 py-2 text-right font-mono text-primary">
                        {{ fmtMwh(c.gen_asignada_mwh) }}
                      </td>
                      <td class="px-2 py-2 text-right">
                        <div v-if="c.compras_cop > 0">
                          <span class="font-mono font-semibold text-destructive">{{
                            fmtCop(c.compras_cop)
                          }}</span>
                          <div class="font-mono text-xs text-muted-foreground">
                            {{ fmtMwh(c.compras_mwh) }} MWh
                          </div>
                        </div>
                        <span v-else class="text-xs text-muted-foreground/60">—</span>
                      </td>
                      <td class="px-2 py-2 text-right">
                        <div v-if="c.excedentes_cop > 0">
                          <span class="font-mono font-semibold text-amber-700">{{
                            fmtCop(c.excedentes_cop)
                          }}</span>
                          <div class="font-mono text-xs text-muted-foreground">
                            {{ fmtMwh(c.excedentes_mwh) }} MWh
                          </div>
                        </div>
                        <span v-else class="text-xs text-muted-foreground/60">—</span>
                      </td>
                      <td class="py-2 pl-2 text-right">
                        <span
                          v-if="c.sobrecosto_vs_ppa_cop !== null"
                          class="font-mono text-sm"
                          :class="c.sobrecosto_vs_ppa_cop > 0 ? 'text-destructive' : 'text-success'"
                        >
                          {{ fmtCop(c.sobrecosto_vs_ppa_cop) }}
                        </span>
                        <span v-else class="text-xs text-muted-foreground/60">—</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </template>

          <div
            v-else-if="expandedMonth"
            class="rounded-xl border py-8 text-center text-muted-foreground"
          >
            <CircleCheckIcon class="mx-auto mb-2 size-8 text-success" />
            <p>
              Sin descubrimientos en {{ MESES[expandedMonth - 1] }} — toda la generación dentro de
              compromisos.
            </p>
          </div>
        </div>
      </template>
    </AsyncView>

    <!-- `AsyncView` solo reconoce "vacío" para arreglos: la respuesta acá es un
         objeto, así que este caso (sin datos, sin error, sin cargar) se cubre
         aparte -- en la práctica solo se ve un instante antes del primer `onMounted`. -->
    <div
      v-if="!query.isLoading && !query.error && !query.data"
      class="rounded-xl border py-16 text-center text-muted-foreground"
    >
      <ZapIcon class="mx-auto mb-3 size-10 text-primary" />
      <p>Selecciona un rango de meses para ver los descubrimientos.</p>
    </div>
  </div>
</template>
