<script setup lang="ts">
import type { DataTableColumn, DataTableRow } from '~/components/blocks/DataTable.vue'
import type {
  ClimaForecast,
  DailySpotLatest,
  RegistroOni,
  RegistroPrecioMensual,
  SenalTradingClima,
} from '~/features/mem/types'
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  ChartLineIcon,
  CloudDownloadIcon,
  CloudIcon,
  DatabaseIcon,
} from '@lucide/vue'
// Import explícito: el auto-import de Nuxt sintetiza mal los tipos de props de `DataTable`.
import DataTable from '~/components/blocks/DataTable.vue'
import { logger } from '~/core/logger'
import { EvoService } from '~/features/mem/services/evo'

const evoService = new EvoService()
const router = useRouter()

type TabKey = 'precios' | 'clima' | 'historico'
const activeTab = ref<TabKey>('precios')
const loading = ref(true)
const spot = ref<DailySpotLatest | null>(null)
const clima = ref<ClimaForecast | null>(null)
const histPrices = ref<RegistroPrecioMensual[]>([])
const histOni = ref<RegistroOni[]>([])

interface HoverBar {
  hour: number
  price: number
  marginal: string
}

const hoverBar = ref<HoverBar | null>(null)
const tooltipLeft = ref(0)
const tooltipTop = ref(0)

const chartW = 700
const chartH = 200
const padL = 50
const padR = 60
const padT = 10
const padB = 20

onMounted(async () => {
  try {
    const [spotRes, climaRes, pricesRes, oniRes] = await Promise.all([
      evoService.obtenerSpotVigente().catch(() => null),
      evoService.obtenerPronosticoClima().catch(() => null),
      evoService.obtenerPreciosHistoricos(26).catch(() => null),
      evoService.obtenerOni(26).catch(() => null),
    ])
    if (spotRes) spot.value = spotRes
    if (climaRes) clima.value = climaRes
    if (pricesRes) histPrices.value = [...pricesRes].reverse()
    if (oniRes) histOni.value = [...oniRes].reverse()
  } catch (err) {
    logger.error('mem', err)
  } finally {
    loading.value = false
  }
})

interface Kpi {
  label: string
  value: string
  color: string
}

const spotKpis = computed<Kpi[]>(() => {
  const s = spot.value?.summary
  if (!s) return []
  return [
    {
      label: 'Precio promedio',
      value: `$${s.price_avg?.toFixed(0)}`,
      color: 'var(--color-primary)',
    },
    {
      label: 'Precio máximo',
      value: `$${s.price_max?.toFixed(0)}`,
      color: 'var(--color-destructive)',
    },
    { label: 'Spread', value: `$${s.spread?.toFixed(0)}`, color: 'var(--color-warning)' },
    { label: 'Demanda', value: `${s.total_gwh?.toFixed(1)} GWh`, color: 'var(--color-chart-3)' },
    { label: 'Hidráulica', value: `${s.hydro_pct}%`, color: 'var(--color-success)' },
  ]
})

const prices = computed(() => {
  if (!spot.value?.prices) return []
  return Object.entries(spot.value.prices)
    .map(([h, p]) => ({ hour: Number.parseInt(h), price: p }))
    .sort((a, b) => a.hour - b.hour)
})

const priceMin = computed(() =>
  prices.value.length ? Math.min(...prices.value.map((p) => p.price)) * 0.9 : 0,
)
const priceMax = computed(() => {
  if (!prices.value.length) return 1000
  let mx = Math.max(...prices.value.map((p) => p.price))
  if (spot.value?.scarcity_price) mx = Math.max(mx, spot.value.scarcity_price)
  return mx * 1.05
})

const barStep = computed(() => (chartW - padL - padR) / 24)

function priceToY(price: number): number {
  const range = priceMax.value - priceMin.value
  if (range === 0) return padT
  return padT + (chartH - padT - padB) * (1 - (price - priceMin.value) / range)
}

const peakHour = computed(() => spot.value?.summary?.peak_hour ?? 20)

interface PriceBar {
  x: number
  y: number
  w: number
  h: number
  hour: number
  price: number
  peak: boolean
  marginal: string
}

const priceBars = computed<PriceBar[]>(() =>
  prices.value.map((p, i) => ({
    x: padL + i * barStep.value + 2,
    y: priceToY(p.price),
    w: barStep.value - 4,
    h: Math.max(0, chartH - padB - priceToY(p.price)),
    hour: p.hour,
    price: p.price,
    peak: p.hour === peakHour.value,
    marginal: spot.value?.marginal_plants?.[String(p.hour)] || '',
  })),
)

const gridY = computed(() => {
  const steps = 5
  const range = priceMax.value - priceMin.value
  if (range === 0) return []
  return Array.from({ length: steps + 1 }, (_, i) => {
    const val = priceMin.value + (range * i) / steps
    return { val, py: priceToY(val), label: `$${Math.round(val)}` }
  })
})

function onChartMove(e: MouseEvent) {
  const svg = e.currentTarget as SVGSVGElement
  const rect = svg.getBoundingClientRect()
  const scaleX = chartW / rect.width
  const mouseX = (e.clientX - rect.left) * scaleX
  const idx = Math.floor((mouseX - padL) / barStep.value)
  if (idx >= 0 && idx < priceBars.value.length) {
    hoverBar.value = priceBars.value[idx]!
    tooltipLeft.value = e.clientX + 12
    tooltipTop.value = e.clientY - 40
  } else {
    hoverBar.value = null
  }
}

interface FilaGeneracion {
  hour: number
  hidro: number
  termica: number
  renovable: number
  menor: number
  price: number
  marginal: string
}

const genRows = computed<FilaGeneracion[]>(() => {
  if (!spot.value?.generation) return []
  return Object.entries(spot.value.generation)
    .map(([h, gen]) => ({
      hour: Number.parseInt(h),
      hidro: Math.round(gen.Hidraulica || gen.hidraulica || 0),
      termica: Math.round(gen.Termica || gen.termica || 0),
      renovable: Math.round(gen.Renovables || gen.renovables || 0),
      menor: Math.round(gen.Menores || gen.menores || 0),
      price: spot.value?.prices?.[h] || 0,
      marginal: spot.value?.marginal_plants?.[h] || '',
    }))
    .sort((a, b) => a.hour - b.hour)
})

const genColumns: DataTableColumn[] = [
  { key: 'hour', header: 'Hora' },
  { key: 'hidro', header: 'Hidráulica' },
  { key: 'termica', header: 'Térmica' },
  { key: 'renovable', header: 'Renovable' },
  { key: 'menor', header: 'Menores' },
  { key: 'precio', header: 'Precio' },
  { key: 'marginal', header: 'Marginal' },
]

function asGeneracion(row: DataTableRow): FilaGeneracion {
  return row as unknown as FilaGeneracion
}

const ensoColor = computed(() => {
  const enso = clima.value?.enso
  const c =
    enso?.current_state ||
    (Array.isArray(enso?.classification) ? enso.classification[0] : enso?.classification) ||
    ''
  if (c.includes('Niño')) return 'text-destructive'
  if (c.includes('Niña')) return 'text-chart-3'
  return 'text-muted-foreground'
})

const senalColumns: DataTableColumn[] = [
  { key: 'month', header: 'Mes' },
  { key: 'price', header: 'Precio' },
  { key: 'direction', header: 'Dirección' },
  { key: 'risk_level', header: 'Riesgo' },
  { key: 'regime', header: 'Régimen' },
  { key: 'margin', header: 'Margen' },
]

function asSenal(row: DataTableRow): SenalTradingClima {
  return row as unknown as SenalTradingClima
}

// ─── Historical chart computations ──────────────────────
const histChartW = 800
const histChartH = 280
const histPadL = 55
const histPadR = 20

const histPriceRange = computed(() => {
  if (!histPrices.value.length) return { min: 0, max: 1000 }
  const vals = histPrices.value.map((p) => Number(p.price_cop_kwh) || 0)
  return { min: Math.min(...vals) * 0.9, max: Math.max(...vals) * 1.05 }
})

function histPriceToY(price: number): number {
  const { min, max } = histPriceRange.value
  const range = max - min || 1
  return 20 + (histChartH - 40) * (1 - (price - min) / range)
}

const oniRange = computed(() => {
  if (!histOni.value.length) return { min: -2, max: 2 }
  const vals = histOni.value.map((o) => Number(o.oni_value) || 0)
  return { min: Math.min(...vals, -1.5), max: Math.max(...vals, 1.5) }
})

function oniToY(oni: number): number {
  const { min, max } = oniRange.value
  const range = max - min || 1
  return 20 + (histChartH - 40) * (1 - (oni - min) / range)
}

const histPriceLine = computed(() => {
  const n = histPrices.value.length
  if (!n) return ''
  const step = (histChartW - histPadL - histPadR) / Math.max(n - 1, 1)
  return histPrices.value
    .map((p, i) => `${histPadL + i * step},${histPriceToY(Number(p.price_cop_kwh) || 0)}`)
    .join(' ')
})

const histOniLine = computed(() => {
  const n = histOni.value.length
  if (!n) return ''
  const step = (histChartW - histPadL - histPadR) / Math.max(n - 1, 1)
  return histOni.value
    .map((o, i) => `${histPadL + i * step},${oniToY(Number(o.oni_value) || 0)}`)
    .join(' ')
})

interface EnsoBand {
  x: number
  w: number
  color: string
}

const ensoBands = computed<EnsoBand[]>(() => {
  const n = histOni.value.length
  if (!n) return []
  const step = (histChartW - histPadL - histPadR) / Math.max(n - 1, 1)
  const bands: EnsoBand[] = []
  let start: number | null = null
  let phase: string | null | undefined = null
  for (let i = 0; i < n; i++) {
    const p = histOni.value[i]!.enso_phase
    if (p !== phase) {
      if (start !== null && phase && phase !== 'Neutral') {
        bands.push({
          x: histPadL + start * step,
          w: (i - start) * step,
          color: phase === 'El Niño' ? 'fill-destructive' : 'fill-chart-3',
        })
      }
      start = i
      phase = p
    }
  }
  if (start !== null && phase && phase !== 'Neutral') {
    bands.push({
      x: histPadL + start * step,
      w: (n - start) * step,
      color: phase === 'El Niño' ? 'fill-destructive' : 'fill-chart-3',
    })
  }
  return bands
})

const histYearLabels = computed(() => {
  const n = histPrices.value.length
  if (!n) return []
  const step = (histChartW - histPadL - histPadR) / Math.max(n - 1, 1)
  const labels: { x: number; year: number }[] = []
  let lastYear: number | null = null
  for (let i = 0; i < n; i++) {
    const yr = histPrices.value[i]!.year
    if (yr !== lastYear && histPrices.value[i]!.month <= 2) {
      labels.push({ x: histPadL + i * step, year: yr })
      lastYear = yr
    }
  }
  return labels
})

const histKpis = computed<Kpi[]>(() => {
  const data = histPrices.value
  if (!data.length) return []
  const prices2 = data.map((p) => Number(p.price_cop_kwh) || 0)
  const avg = prices2.reduce((s, p) => s + p, 0) / prices2.length
  const max = Math.max(...prices2)
  const latest = prices2[prices2.length - 1]!
  return [
    { label: 'Meses de datos', value: String(data.length), color: 'var(--color-primary)' },
    { label: 'Precio actual', value: `$${latest.toFixed(0)}`, color: 'var(--color-foreground)' },
    { label: 'Prom. histórico', value: `$${avg.toFixed(0)}`, color: 'var(--color-success)' },
    { label: 'Máx. histórico', value: `$${max.toFixed(0)}`, color: 'var(--color-destructive)' },
  ]
})

interface EnsoPhaseStat {
  label: string
  color: string
  avgPrice: string
  count: number
}

const ensoPhaseStats = computed<EnsoPhaseStat[]>(() => {
  const data = histPrices.value
  if (!data.length) return []
  const groups: Record<string, { prices: number[]; count: number }> = {}
  for (const p of data) {
    const phase = p.enso_phase || 'Neutral'
    if (!groups[phase]) groups[phase] = { prices: [], count: 0 }
    groups[phase].prices.push(Number(p.price_cop_kwh) || 0)
    groups[phase].count++
  }
  const phases = [
    { key: 'El Niño', label: 'El Niño', color: 'var(--color-destructive)' },
    { key: 'Neutral', label: 'Neutral', color: 'var(--color-muted-foreground)' },
    { key: 'La Niña', label: 'La Niña', color: 'var(--color-chart-3)' },
  ]
  return phases
    .filter((p) => groups[p.key])
    .map((p) => {
      const g = groups[p.key]!
      return {
        ...p,
        avgPrice: (g.prices.reduce((s, v) => s + v, 0) / g.count).toFixed(0),
        count: g.count,
      }
    })
})
</script>

<template>
  <div class="space-y-5">
    <PageHeader title="Mercado de Energía" subtitle="Precios de bolsa XM + Pronóstico Clima">
      <template #lead>
        <Button variant="ghost" class="-ml-2" @click="router.back()">
          <ArrowLeftIcon />
        </Button>
        <div class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <ChartLineIcon class="size-4 text-primary" />
        </div>
      </template>
    </PageHeader>

    <GTabs :model-value="activeTab" @update:model-value="(v) => (activeTab = v as TabKey)">
      <GTabsList>
        <GTabsTrigger value="precios">Precios de Bolsa</GTabsTrigger>
        <GTabsTrigger value="clima">Clima / Pronóstico</GTabsTrigger>
        <GTabsTrigger value="historico">Histórico</GTabsTrigger>
      </GTabsList>

      <div v-if="loading" class="flex justify-center py-20">
        <Spinner class="size-8 text-primary" />
      </div>

      <template v-else>
        <!-- ═══ TAB: Precios de Bolsa ═══ -->
        <GTabsContent value="precios" class="space-y-4">
          <div v-if="!spot" class="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <CloudDownloadIcon class="size-8" />
            <p class="text-sm">Sin datos de predespacho disponibles.</p>
          </div>

          <template v-else>
            <div class="grid grid-cols-2 gap-3 md:grid-cols-5">
              <div
                v-for="kpi in spotKpis"
                :key="kpi.label"
                class="rounded-xl border border-(--c)/20 bg-(--c)/5 p-3"
                :style="{ '--c': kpi.color }"
              >
                <p class="text-2xl font-bold text-(--c)">{{ kpi.value }}</p>
                <p class="mt-0.5 text-xs font-medium text-(--c)/80">
                  {{ kpi.label }}
                </p>
              </div>
            </div>

            <div class="rounded-xl border bg-card p-4">
              <div class="mb-3 flex items-center justify-between">
                <h3 class="text-sm font-semibold text-foreground">Precio Bolsa por hora ($/kWh)</h3>
                <span class="text-xs text-muted-foreground">{{ spot.date }}</span>
              </div>
              <svg
                :viewBox="`0 0 ${chartW} ${chartH}`"
                class="max-h-65 w-full"
                @mousemove="onChartMove"
                @mouseleave="hoverBar = null"
              >
                <line
                  v-for="y in gridY"
                  :key="`g${y.val}`"
                  class="stroke-border"
                  :x1="padL"
                  :x2="chartW - padR"
                  :y1="y.py"
                  :y2="y.py"
                  stroke-width="0.5"
                />
                <text
                  v-for="y in gridY"
                  :key="`t${y.val}`"
                  class="fill-muted-foreground"
                  :x="padL - 4"
                  :y="y.py + 3"
                  text-anchor="end"
                  font-size="9"
                >
                  {{ y.label }}
                </text>

                <rect
                  v-for="(bar, i) in priceBars"
                  :key="i"
                  :x="bar.x"
                  :y="bar.y"
                  :width="bar.w"
                  :height="bar.h"
                  :fill="bar.peak ? 'var(--highlight)' : 'var(--color-primary)'"
                  :opacity="hoverBar?.hour === bar.hour ? 1 : 0.85"
                  rx="2"
                />

                <line
                  v-if="spot.scarcity_price"
                  class="stroke-destructive"
                  :x1="padL"
                  :x2="chartW - padR"
                  :y1="priceToY(spot.scarcity_price)"
                  :y2="priceToY(spot.scarcity_price)"
                  stroke-width="1"
                  stroke-dasharray="4,3"
                />
                <text
                  v-if="spot.scarcity_price"
                  class="fill-destructive"
                  :x="chartW - padR + 2"
                  :y="priceToY(spot.scarcity_price) + 3"
                  font-size="8"
                >
                  P.Esc ${{ Math.round(spot.scarcity_price) }}
                </text>

                <text
                  v-for="h in 24"
                  :key="`h${h}`"
                  class="fill-muted-foreground"
                  :x="padL + (h - 0.5) * barStep"
                  :y="chartH - 2"
                  text-anchor="middle"
                  font-size="8"
                >
                  {{ h }}
                </text>
              </svg>

              <div
                v-if="hoverBar"
                class="pointer-events-none fixed top-(--t) left-(--l) z-50 rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg"
                :style="{ '--l': `${tooltipLeft}px`, '--t': `${tooltipTop}px` }"
              >
                <p class="font-semibold text-foreground">Hora {{ hoverBar.hour }}</p>
                <p class="text-primary">${{ hoverBar.price.toFixed(2) }} /kWh</p>
                <p class="text-muted-foreground">{{ hoverBar.marginal }}</p>
              </div>
            </div>

            <div class="rounded-xl border bg-card p-4">
              <h3 class="mb-3 text-sm font-semibold text-foreground">Generación por hora (MWh)</h3>
              <DataTable
                :columns="genColumns"
                :rows="genRows as unknown as DataTableRow[]"
                row-key="hour"
              >
                <template #cell="{ row, column }">
                  <span
                    v-if="column.key === 'hour'"
                    class="font-mono text-xs font-semibold text-foreground"
                    >{{ asGeneracion(row).hour }}</span
                  >
                  <span v-else-if="column.key === 'hidro'" class="font-mono text-xs text-chart-3">{{
                    asGeneracion(row).hidro.toLocaleString()
                  }}</span>
                  <span
                    v-else-if="column.key === 'termica'"
                    class="font-mono text-xs text-warning"
                    >{{ asGeneracion(row).termica.toLocaleString() }}</span
                  >
                  <span
                    v-else-if="column.key === 'renovable'"
                    class="font-mono text-xs text-success"
                    >{{ asGeneracion(row).renovable.toLocaleString() }}</span
                  >
                  <span v-else-if="column.key === 'menor'" class="font-mono text-xs text-primary">{{
                    asGeneracion(row).menor.toLocaleString()
                  }}</span>
                  <span
                    v-else-if="column.key === 'precio'"
                    class="font-mono text-xs font-semibold"
                    :class="asGeneracion(row).price >= 900 ? 'text-destructive' : 'text-foreground'"
                  >
                    ${{ asGeneracion(row).price.toFixed(0) }}
                  </span>
                  <span
                    v-else-if="column.key === 'marginal'"
                    class="text-xs text-muted-foreground"
                    >{{ asGeneracion(row).marginal }}</span
                  >
                </template>
              </DataTable>
            </div>
          </template>
        </GTabsContent>

        <!-- ═══ TAB: Clima / Pronóstico ═══ -->
        <GTabsContent value="clima" class="space-y-4">
          <div
            v-if="!clima || !clima.models_available"
            class="flex flex-col items-center gap-2 py-12 text-muted-foreground"
          >
            <CloudIcon class="size-8" />
            <p class="text-sm">Modelos de pronóstico no disponibles.</p>
            <p class="text-xs">
              Los endpoints están activos — ejecute el pipeline de entrenamiento.
            </p>
          </div>

          <template v-else>
            <div v-if="clima.enso" class="rounded-xl border bg-card p-4">
              <h3 class="mb-2 text-sm font-semibold text-foreground">Clasificación ENSO</h3>
              <div class="flex items-center gap-4">
                <span class="text-lg font-bold" :class="ensoColor">{{
                  clima.enso.current_state ||
                  (Array.isArray(clima.enso.classification)
                    ? clima.enso.classification[0]
                    : clima.enso.classification)
                }}</span>
                <span class="text-sm text-muted-foreground">
                  ONI:
                  {{
                    clima.enso.latest_oni?.toFixed(2) ??
                    (Array.isArray(clima.enso.nino34_predicted)
                      ? clima.enso.nino34_predicted[0]?.toFixed(2)
                      : clima.enso.nino34_predicted?.toFixed(2))
                  }}
                </span>
              </div>
              <div v-if="clima.enso.probabilities" class="mt-2 flex gap-3">
                <span
                  v-for="(prob, label) in clima.enso.probabilities"
                  :key="label"
                  class="text-xs text-muted-foreground"
                >
                  {{ String(label).replace('p_', '') }}:
                  {{ ((Array.isArray(prob) ? (prob[0] ?? 0) : prob) * 100).toFixed(0) }}%
                </span>
              </div>
            </div>

            <div v-if="clima.trading_signals?.length" class="rounded-xl border bg-card p-4">
              <h3 class="mb-3 text-sm font-semibold text-foreground">Señales de Trading</h3>
              <DataTable
                :columns="senalColumns"
                :rows="clima.trading_signals as unknown as DataTableRow[]"
              >
                <template #cell="{ row, column }">
                  <span v-if="column.key === 'month'" class="text-xs">{{
                    asSenal(row).month
                  }}</span>
                  <span v-else-if="column.key === 'price'" class="font-mono text-xs font-semibold"
                    >${{ asSenal(row).price?.toFixed(0) }}</span
                  >
                  <span
                    v-else-if="column.key === 'direction'"
                    class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                    :class="
                      asSenal(row).direction?.includes('COMPRAR')
                        ? 'bg-success/15 text-success'
                        : 'bg-destructive/15 text-destructive'
                    "
                  >
                    <ArrowDownIcon
                      v-if="asSenal(row).direction?.includes('COMPRAR')"
                      class="size-2.5"
                    />
                    <ArrowUpIcon v-else class="size-2.5" />
                    {{ asSenal(row).direction }}
                  </span>
                  <span
                    v-else-if="column.key === 'risk_level'"
                    class="rounded-full px-2 py-0.5 text-xs font-medium"
                    :class="{
                      'bg-destructive/15 text-destructive': asSenal(row).risk_level === 'ALTO',
                      'bg-warning/15 text-warning': asSenal(row).risk_level === 'MEDIO',
                      'bg-success/15 text-success': !['ALTO', 'MEDIO'].includes(
                        asSenal(row).risk_level || '',
                      ),
                    }"
                  >
                    {{ asSenal(row).risk_level }}
                  </span>
                  <span v-else-if="column.key === 'regime'" class="text-xs text-muted-foreground">
                    {{ asSenal(row).regime }} ({{
                      ((asSenal(row).regime_prob || 0) * 100).toFixed(0)
                    }}%)
                  </span>
                  <span
                    v-else-if="column.key === 'margin'"
                    class="font-mono text-xs"
                    :class="(asSenal(row).margin || 0) > 0 ? 'text-success' : 'text-destructive'"
                  >
                    {{ (asSenal(row).margin || 0) > 0 ? '+' : '' }}${{
                      asSenal(row).margin?.toFixed(0)
                    }}
                  </span>
                </template>
              </DataTable>
            </div>
          </template>
        </GTabsContent>

        <!-- ═══ TAB: Histórico ═══ -->
        <GTabsContent value="historico" class="space-y-4">
          <div
            v-if="!histPrices.length"
            class="flex flex-col items-center gap-2 py-12 text-muted-foreground"
          >
            <DatabaseIcon class="size-8" />
            <p class="text-sm">Sin datos históricos.</p>
          </div>

          <template v-else>
            <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div
                v-for="kpi in histKpis"
                :key="kpi.label"
                class="rounded-xl border border-(--c)/20 bg-(--c)/5 p-3"
                :style="{ '--c': kpi.color }"
              >
                <p class="text-2xl font-bold text-(--c)">{{ kpi.value }}</p>
                <p class="mt-0.5 text-xs font-medium text-(--c)/80">
                  {{ kpi.label }}
                </p>
              </div>
            </div>

            <div class="rounded-xl border bg-card p-4">
              <h3 class="mb-3 text-sm font-semibold text-foreground">
                Precio Bolsa vs ONI ({{ histPrices.length }} meses)
              </h3>
              <svg :viewBox="`0 0 ${histChartW} ${histChartH}`" class="max-h-80 w-full">
                <rect
                  v-for="(band, i) in ensoBands"
                  :key="`b${i}`"
                  :x="band.x"
                  y="10"
                  :width="band.w"
                  :height="histChartH - 30"
                  :class="band.color"
                  opacity="0.12"
                />
                <polyline
                  :points="histPriceLine"
                  fill="none"
                  stroke="var(--color-primary)"
                  stroke-width="1.5"
                />
                <polyline
                  class="stroke-chart-3"
                  :points="histOniLine"
                  fill="none"
                  stroke-width="1"
                  stroke-dasharray="4,2"
                />
                <line
                  class="stroke-muted-foreground"
                  :x1="histPadL"
                  :x2="histChartW - histPadR"
                  :y1="oniToY(0)"
                  :y2="oniToY(0)"
                  stroke-width="0.5"
                  stroke-dasharray="2,2"
                />
                <template v-for="(yl, i) in histYearLabels" :key="`yl${i}`">
                  <text
                    class="fill-muted-foreground"
                    :x="yl.x"
                    :y="histChartH - 2"
                    text-anchor="middle"
                    font-size="9"
                  >
                    {{ yl.year }}
                  </text>
                </template>
                <line
                  x1="10"
                  x2="30"
                  y1="6"
                  y2="6"
                  stroke="var(--color-primary)"
                  stroke-width="2"
                />
                <text x="33" y="9" fill="var(--color-primary)" font-size="8">Precio COP/kWh</text>
                <line
                  class="stroke-chart-3"
                  x1="140"
                  x2="160"
                  y1="6"
                  y2="6"
                  stroke-width="1"
                  stroke-dasharray="4,2"
                />
                <text class="fill-chart-3" x="163" y="9" font-size="8">ONI</text>
                <rect class="fill-destructive" x="230" y="2" width="10" height="8" opacity="0.2" />
                <text class="fill-muted-foreground" x="243" y="9" font-size="8">El Niño</text>
                <rect class="fill-chart-3" x="300" y="2" width="10" height="8" opacity="0.2" />
                <text class="fill-muted-foreground" x="313" y="9" font-size="8">La Niña</text>
              </svg>
            </div>

            <div class="rounded-xl border bg-card p-4">
              <h3 class="mb-3 text-sm font-semibold text-foreground">
                Precio promedio por fase ENSO
              </h3>
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div
                  v-for="phase in ensoPhaseStats"
                  :key="phase.label"
                  class="rounded-lg bg-(--c)/8 p-4 text-center"
                  :style="{ '--c': phase.color }"
                >
                  <p class="text-lg font-bold text-(--c)">
                    {{ phase.label }}
                  </p>
                  <p class="mt-1 text-2xl font-bold text-foreground">${{ phase.avgPrice }}</p>
                  <p class="mt-1 text-xs text-muted-foreground">
                    {{ phase.count }} meses · prom. COP/kWh
                  </p>
                </div>
              </div>
            </div>
          </template>
        </GTabsContent>
      </template>
    </GTabs>
  </div>
</template>
