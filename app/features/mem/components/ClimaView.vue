<script setup lang="ts">
import type { DataTableColumn, DataTableRow } from '~/components/blocks/DataTable.vue'
import type {
  RegistroOni,
  RegistroPrecioMensual,
  RegistroPrecipitacion,
} from '~/features/mem/types'
import { InfoIcon } from '@lucide/vue'
// Import explícito: el auto-import de Nuxt sintetiza mal los tipos de props de `DataTable`.
import DataTable from '~/components/blocks/DataTable.vue'
import { EvoService } from '~/features/mem/services/evo'

const evoService = new EvoService()

type TabKey = 'oni' | 'precio' | 'precip' | 'datos'
const activeTab = ref<TabKey>('oni')
const REGIONS = ['Andina', 'Caribe', 'Pacifica', 'Orinoquia', 'Amazonia']
const precipRegion = ref('Andina')

const oniData = ref<RegistroOni[]>([])
const priceData = ref<RegistroPrecioMensual[]>([])
const precipData = ref<RegistroPrecipitacion[]>([])

const oniChartMid = 120

function oniToY(val: number): number {
  return oniChartMid - val * 50
}

function ordenados<T extends { year: number; month: number }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => a.year - b.year || a.month - b.month)
}

function totalMeses<T extends { year: number; month: number }>(sorted: T[]): number {
  if (!sorted.length) return 0
  const first = sorted[0]!
  const last = sorted[sorted.length - 1]!
  return (last.year - first.year) * 12 + (last.month - first.month)
}

const oniPoints = computed(() => {
  const sorted = ordenados(oniData.value)
  const total = totalMeses(sorted)
  if (total <= 0) return []
  const first = sorted[0]!
  return sorted.map((d) => {
    const idx = (d.year - first.year) * 12 + (d.month - first.month)
    return { x: 40 + (idx / total) * 840, y: oniToY(d.oni_value || 0) }
  })
})

const oniPointsStr = computed(() => oniPoints.value.map((p) => `${p.x},${p.y}`).join(' '))

const oniXLabels = computed(() => {
  const sorted = ordenados(oniData.value)
  const total = totalMeses(sorted)
  if (total <= 0) return []
  const first = sorted[0]!
  const last = sorted[sorted.length - 1]!
  const labels: { x: number; year: number }[] = []
  const step = Math.max(1, Math.floor((last.year - first.year) / 10))
  for (let y = first.year; y <= last.year; y += step) {
    const idx = (y - first.year) * 12
    labels.push({ x: 40 + (idx / total) * 840, year: y })
  }
  return labels
})

interface Kpi {
  label: string
  value: string | number
  color: string
  sub?: string
}

const ensoKpis = computed<Kpi[]>(() => {
  if (!oniData.value.length) return []
  const latest = oniData.value[0]!
  const oni = latest.oni_value ?? 0
  const phase = latest.enso_phase || 'Neutral'

  const ninoMonths = oniData.value.filter((d) => d.enso_phase === 'El Niño').length
  const ninaMonths = oniData.value.filter((d) => d.enso_phase === 'La Niña').length

  return [
    {
      label: 'ONI Actual',
      value: oni.toFixed(2),
      color: oni > 0.5 ? 'text-destructive' : oni < -0.5 ? 'text-chart-3' : 'text-muted-foreground',
      sub: `${latest.year}-${String(latest.month).padStart(2, '0')}`,
    },
    {
      label: 'Fase ENSO',
      value: phase,
      color:
        phase === 'El Niño'
          ? 'text-destructive'
          : phase === 'La Niña'
            ? 'text-chart-3'
            : 'text-muted-foreground',
    },
    {
      label: 'Meses El Niño',
      value: ninoMonths,
      color: 'text-destructive',
      sub: `de ${oniData.value.length} registros`,
    },
    {
      label: 'Meses La Niña',
      value: ninaMonths,
      color: 'text-chart-3',
      sub: `de ${oniData.value.length} registros`,
    },
  ]
})

// Price vs ENSO chart
const priceMax = computed(() => Math.max(...priceData.value.map((d) => d.price_cop_kwh || 0), 1))
const priceTicks = computed(() => {
  const max = priceMax.value
  const step = max > 1000 ? 500 : max > 500 ? 200 : 100
  const ticks: number[] = []
  for (let v = 0; v <= max * 1.1; v += step) ticks.push(Math.round(v))
  return ticks
})

function priceToY(val: number): number {
  return 230 - (val / (priceMax.value * 1.1)) * 220 + 10
}

const pricePoints = computed(() => {
  const sorted = ordenados(priceData.value)
  const total = totalMeses(sorted)
  if (total <= 0) return []
  const first = sorted[0]!
  return sorted.map((d) => {
    const idx = (d.year - first.year) * 12 + (d.month - first.month)
    return { x: 40 + (idx / total) * 840, y: priceToY(d.price_cop_kwh || 0) }
  })
})

const pricePointsStr = computed(() => pricePoints.value.map((p) => `${p.x},${p.y}`).join(' '))

const priceXLabels = computed(() => {
  const sorted = ordenados(priceData.value)
  const total = totalMeses(sorted)
  if (total <= 0) return []
  const first = sorted[0]!
  const last = sorted[sorted.length - 1]!
  const labels: { x: number; year: number }[] = []
  const step = Math.max(1, Math.floor((last.year - first.year) / 8))
  for (let y = first.year; y <= last.year; y += step) {
    const idx = (y - first.year) * 12
    labels.push({ x: 40 + (idx / total) * 840, year: y })
  }
  return labels
})

interface Band {
  x: number
  w: number
  phase: string
}

const phaseBands = computed<Band[]>(() => {
  const sorted = ordenados(priceData.value)
  const total = totalMeses(sorted)
  if (total <= 0) return []
  const first = sorted[0]!

  const bands: Band[] = []
  let currentPhase: string | null = null
  let startIdx = 0

  sorted.forEach((d, i) => {
    const phase = d.enso_phase || 'Neutral'
    if (phase !== currentPhase) {
      if (currentPhase && currentPhase !== 'Neutral') {
        const idx = (d.year - first.year) * 12 + (d.month - first.month)
        bands.push({
          x: 40 + (startIdx / total) * 840,
          w: ((idx - startIdx) / total) * 840,
          phase: currentPhase,
        })
      }
      currentPhase = phase
      startIdx = (d.year - first.year) * 12 + (d.month - first.month)
    }
    void i
  })
  return bands
})

interface PhaseStat {
  name: string
  color: string
  avgPrice: string
  count: number
}

function avg(arr: number[]): number {
  return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0
}

type FaseEnso = 'El Niño' | 'Neutral' | 'La Niña'

function faseDe(v: string | undefined): FaseEnso {
  return v === 'El Niño' || v === 'La Niña' ? v : 'Neutral'
}

const phaseStats = computed<PhaseStat[]>(() => {
  const groups: Record<FaseEnso, number[]> = { 'El Niño': [], Neutral: [], 'La Niña': [] }
  priceData.value.forEach((d) => {
    groups[faseDe(d.enso_phase)].push(d.price_cop_kwh || 0)
  })
  return [
    {
      name: 'El Niño',
      color: 'bg-destructive',
      avgPrice: avg(groups['El Niño']).toFixed(1),
      count: groups['El Niño'].length,
    },
    {
      name: 'Neutral',
      color: 'bg-muted-foreground',
      avgPrice: avg(groups.Neutral).toFixed(1),
      count: groups.Neutral.length,
    },
    {
      name: 'La Niña',
      color: 'bg-chart-3',
      avgPrice: avg(groups['La Niña']).toFixed(1),
      count: groups['La Niña'].length,
    },
  ]
})

// Precipitation
interface Bar {
  x: number
  y: number
  w: number
  h: number
  anomaly: number
}

const precipBars = computed<Bar[]>(() => {
  const sorted = ordenados(precipData.value)
  if (!sorted.length) return []
  const maxPrecip = Math.max(...sorted.map((d) => d.precip_mm || 0), 1)
  const n = sorted.length
  const barW = Math.max(1, 840 / n - 1)
  return sorted.map((d, i) => {
    const h = ((d.precip_mm || 0) / maxPrecip) * 200
    return { x: 40 + (i / n) * 840, y: 230 - h, w: barW, h, anomaly: d.anomaly_pct || 0 }
  })
})

const precipClimatology = computed(() => {
  const sorted = ordenados(precipData.value)
  if (!sorted.length) return []
  const maxPrecip = Math.max(...sorted.map((d) => d.precip_mm || 0), 1)
  const n = sorted.length
  return sorted.map((d, i) => {
    const y = 230 - ((d.climatology_mm || 0) / maxPrecip) * 200
    return `${40 + (i / n) * 840},${y}`
  })
})

const precipClimatologyStr = computed(() => precipClimatology.value.join(' '))

const precipXLabels = computed(() => {
  const sorted = ordenados(precipData.value)
  if (!sorted.length) return []
  const first = sorted[0]!
  const last = sorted[sorted.length - 1]!
  const n = sorted.length
  const labels: { x: number; year: number }[] = []
  const step = Math.max(1, Math.floor((last.year - first.year) / 8))
  for (let y = first.year; y <= last.year; y += step) {
    const idx = sorted.findIndex((d) => d.year === y && d.month === 1)
    if (idx >= 0) labels.push({ x: 40 + (idx / n) * 840, year: y })
  }
  return labels
})

const precipStats = computed(() => {
  if (!precipData.value.length)
    return { lastMonth: '—', lastAnomaly: '0', avg12m: '—', climatology: '—' }
  const latest = precipData.value[0]!
  const last12 = precipData.value.slice(0, 12)
  return {
    lastMonth: (latest.precip_mm || 0).toFixed(0),
    lastAnomaly: (latest.anomaly_pct || 0).toFixed(0),
    avg12m: avg(last12.map((d) => d.precip_mm || 0)).toFixed(0),
    climatology: (latest.climatology_mm || 0).toFixed(0),
  }
})

async function loadPrecip() {
  try {
    const res = await evoService.obtenerPrecipitacion(precipRegion.value, 10)
    if (res) precipData.value = res
  } catch {
    // degrade -- región sin datos
  }
}

onMounted(async () => {
  const [oniRes, pricesRes] = await Promise.all([
    evoService.obtenerOni(10).catch(() => null),
    evoService.obtenerPreciosHistoricos(26).catch(() => null),
  ])
  if (oniRes) oniData.value = oniRes
  if (pricesRes) priceData.value = pricesRes
  loadPrecip()
})

const columns: DataTableColumn[] = [
  { key: 'fecha', header: 'Fecha' },
  { key: 'oni_value', header: 'ONI', sortable: true },
  { key: 'enso_phase', header: 'Fase' },
  { key: 'soi_value', header: 'SOI' },
  { key: 'pdo_value', header: 'PDO' },
  { key: 'mjo_amplitude', header: 'MJO Amp' },
]

function asOni(row: DataTableRow): RegistroOni {
  return row as unknown as RegistroOni
}

const oniRows = computed(() => oniData.value.slice(0, 120))
</script>

<template>
  <div class="space-y-5">
    <PageHeader
      title="Inteligencia Climática"
      subtitle="ENSO, precipitación y correlación con precios de energía"
    />

    <div
      v-if="!oniData.length && !priceData.length"
      class="flex items-center gap-3 rounded-xl border border-primary/15 bg-primary/5 p-4"
    >
      <InfoIcon class="size-4 text-primary" />
      <p class="text-sm text-muted-foreground">
        Datos climáticos no disponibles — EVO API no configurada. Se mostrarán cuando el servicio
        esté activo.
      </p>
    </div>

    <!-- Current ENSO Status -->
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div v-for="kpi in ensoKpis" :key="kpi.label" class="rounded-xl border bg-card p-4">
        <p class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {{ kpi.label }}
        </p>
        <p class="mt-1 text-2xl font-bold" :class="kpi.color">{{ kpi.value }}</p>
        <p v-if="kpi.sub" class="mt-0.5 text-xs text-primary">{{ kpi.sub }}</p>
      </div>
    </div>

    <GTabs :model-value="activeTab" @update:model-value="(v) => (activeTab = v as TabKey)">
      <GTabsList>
        <GTabsTrigger value="oni">ENSO Timeline</GTabsTrigger>
        <GTabsTrigger value="precio">Precio vs ENSO</GTabsTrigger>
        <GTabsTrigger value="precip">Precipitación</GTabsTrigger>
        <GTabsTrigger value="datos">Datos ONI</GTabsTrigger>
      </GTabsList>

      <GTabsContent value="oni" class="rounded-xl border bg-card p-4">
        <h3 class="mb-4 text-sm font-semibold text-foreground">Índice ONI (Oceanic Niño Index)</h3>
        <div class="overflow-x-auto">
          <svg viewBox="0 0 900 250" class="w-full min-w-150">
            <rect
              class="fill-destructive/5"
              x="40"
              y="10"
              :width="840"
              :height="oniChartMid - 10"
            />
            <rect
              class="fill-chart-3/5"
              x="40"
              :y="oniChartMid"
              :width="840"
              :height="230 - oniChartMid"
            />
            <line
              class="stroke-muted-foreground"
              x1="40"
              :y1="oniChartMid"
              x2="880"
              :y2="oniChartMid"
              stroke-width="0.5"
              stroke-dasharray="4"
            />
            <line
              class="stroke-destructive"
              x1="40"
              :y1="oniToY(0.5)"
              x2="880"
              :y2="oniToY(0.5)"
              stroke-width="0.5"
              stroke-dasharray="2"
            />
            <line
              class="stroke-chart-3"
              x1="40"
              :y1="oniToY(-0.5)"
              x2="880"
              :y2="oniToY(-0.5)"
              stroke-width="0.5"
              stroke-dasharray="2"
            />
            <polyline
              v-if="oniPoints.length"
              :points="oniPointsStr"
              fill="none"
              stroke="var(--color-primary)"
              stroke-width="1.5"
            />
            <text
              class="fill-destructive"
              x="35"
              :y="oniToY(2) + 4"
              font-size="9"
              text-anchor="end"
            >
              2.0
            </text>
            <text
              class="fill-destructive"
              x="35"
              :y="oniToY(1) + 4"
              font-size="9"
              text-anchor="end"
            >
              1.0
            </text>
            <text
              class="fill-muted-foreground"
              x="35"
              :y="oniToY(0.5) + 4"
              font-size="8"
              text-anchor="end"
            >
              0.5
            </text>
            <text
              class="fill-muted-foreground"
              x="35"
              :y="oniChartMid + 4"
              font-size="9"
              text-anchor="end"
            >
              0
            </text>
            <text
              class="fill-muted-foreground"
              x="35"
              :y="oniToY(-0.5) + 4"
              font-size="8"
              text-anchor="end"
            >
              -0.5
            </text>
            <text class="fill-chart-3" x="35" :y="oniToY(-1) + 4" font-size="9" text-anchor="end">
              -1.0
            </text>
            <text class="fill-chart-3" x="35" :y="oniToY(-2) + 4" font-size="9" text-anchor="end">
              -2.0
            </text>
            <template v-for="(label, idx) in oniXLabels" :key="idx">
              <text
                class="fill-muted-foreground"
                :x="label.x"
                y="248"
                font-size="9"
                text-anchor="middle"
              >
                {{ label.year }}
              </text>
            </template>
            <text class="fill-destructive" x="880" :y="oniToY(1.5)" font-size="9" text-anchor="end">
              El Niño
            </text>
            <text class="fill-chart-3" x="880" :y="oniToY(-1.5)" font-size="9" text-anchor="end">
              La Niña
            </text>
          </svg>
        </div>
      </GTabsContent>

      <GTabsContent value="precio" class="space-y-4">
        <div class="rounded-xl border bg-card p-4">
          <h3 class="mb-4 text-sm font-semibold text-foreground">
            Precio Energía vs Fase ENSO (26 años)
          </h3>
          <div class="overflow-x-auto">
            <svg viewBox="0 0 900 280" class="w-full min-w-150">
              <template v-for="(band, idx) in phaseBands" :key="idx">
                <rect
                  :x="band.x"
                  y="10"
                  :width="band.w"
                  :height="230"
                  :class="
                    band.phase === 'El Niño'
                      ? 'fill-destructive/8'
                      : band.phase === 'La Niña'
                        ? 'fill-chart-3/8'
                        : 'fill-transparent'
                  "
                />
              </template>
              <polyline
                v-if="pricePoints.length"
                :points="pricePointsStr"
                fill="none"
                stroke="var(--color-primary)"
                stroke-width="1.5"
              />
              <template v-for="tick in priceTicks" :key="tick">
                <text
                  class="fill-muted-foreground"
                  x="35"
                  :y="priceToY(tick) + 4"
                  font-size="9"
                  text-anchor="end"
                >
                  ${{ tick }}
                </text>
                <line
                  class="stroke-border"
                  x1="40"
                  :y1="priceToY(tick)"
                  x2="880"
                  :y2="priceToY(tick)"
                  stroke-width="0.5"
                />
              </template>
              <template v-for="(label, idx) in priceXLabels" :key="idx">
                <text
                  class="fill-muted-foreground"
                  :x="label.x"
                  y="258"
                  font-size="9"
                  text-anchor="middle"
                >
                  {{ label.year }}
                </text>
              </template>
            </svg>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div v-for="phase in phaseStats" :key="phase.name" class="rounded-xl border bg-card p-4">
            <div class="mb-2 flex items-center gap-2">
              <div class="size-3 rounded-full" :class="phase.color" />
              <h4 class="text-sm font-semibold text-foreground">{{ phase.name }}</h4>
            </div>
            <p class="text-3xl font-bold text-foreground">${{ phase.avgPrice }}</p>
            <p class="text-xs text-muted-foreground">COP/kWh promedio · {{ phase.count }} meses</p>
          </div>
        </div>
      </GTabsContent>

      <GTabsContent value="precip" class="rounded-xl border bg-card p-4">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-foreground">Precipitación Región Andina</h3>
          <Select v-model="precipRegion" @update:model-value="loadPrecip">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="r in REGIONS" :key="r" :value="r">{{ r }}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="overflow-x-auto">
          <svg viewBox="0 0 900 250" class="w-full min-w-150">
            <polyline
              v-if="precipClimatology.length"
              class="fill-chart-3/8 stroke-chart-3"
              :points="precipClimatologyStr"
              stroke-width="0.5"
              stroke-dasharray="3"
            />
            <template v-for="(bar, idx) in precipBars" :key="idx">
              <rect
                :x="bar.x"
                :y="bar.y"
                :width="bar.w"
                :height="bar.h"
                :class="bar.anomaly > 0 ? 'fill-chart-3' : 'fill-warning'"
                :opacity="0.7"
                rx="1"
              />
            </template>
            <template v-for="(label, idx) in precipXLabels" :key="idx">
              <text
                class="fill-muted-foreground"
                :x="label.x"
                y="248"
                font-size="9"
                text-anchor="middle"
              >
                {{ label.year }}
              </text>
            </template>
          </svg>
        </div>

        <div class="mt-4 grid grid-cols-3 gap-4">
          <div class="rounded-lg bg-muted p-3">
            <p class="text-xs text-muted-foreground">Último mes</p>
            <p class="text-lg font-bold text-foreground">{{ precipStats.lastMonth }} mm</p>
            <p
              class="text-xs"
              :class="Number(precipStats.lastAnomaly) > 0 ? 'text-primary' : 'text-warning'"
            >
              {{ Number(precipStats.lastAnomaly) > 0 ? '+' : '' }}{{ precipStats.lastAnomaly }}%
            </p>
          </div>
          <div class="rounded-lg bg-muted p-3">
            <p class="text-xs text-muted-foreground">Promedio 12m</p>
            <p class="text-lg font-bold text-foreground">{{ precipStats.avg12m }} mm</p>
          </div>
          <div class="rounded-lg bg-muted p-3">
            <p class="text-xs text-muted-foreground">Climatología</p>
            <p class="text-lg font-bold text-foreground">{{ precipStats.climatology }} mm</p>
          </div>
        </div>
      </GTabsContent>

      <GTabsContent value="datos" class="rounded-xl border bg-card p-4">
        <DataTable :columns="columns" :rows="oniRows as unknown as DataTableRow[]">
          <template #cell="{ row, column }">
            <span v-if="column.key === 'fecha'" class="font-mono text-xs">
              {{ asOni(row).year }}-{{ String(asOni(row).month).padStart(2, '0') }}
            </span>
            <span
              v-else-if="column.key === 'oni_value'"
              class="font-mono text-sm"
              :class="
                (asOni(row).oni_value ?? 0) > 0.5
                  ? 'text-destructive'
                  : (asOni(row).oni_value ?? 0) < -0.5
                    ? 'text-chart-3'
                    : 'text-muted-foreground'
              "
            >
              {{ asOni(row).oni_value?.toFixed(2) ?? '—' }}
            </span>
            <GBadge
              v-else-if="column.key === 'enso_phase'"
              :color="
                asOni(row).enso_phase === 'El Niño'
                  ? 'destructive'
                  : asOni(row).enso_phase === 'La Niña'
                    ? 'information'
                    : 'default'
              "
            >
              {{ asOni(row).enso_phase || 'Neutral' }}
            </GBadge>
            <span v-else-if="column.key === 'soi_value'" class="font-mono text-xs">{{
              asOni(row).soi_value?.toFixed(1) ?? '—'
            }}</span>
            <span v-else-if="column.key === 'pdo_value'" class="font-mono text-xs">{{
              asOni(row).pdo_value?.toFixed(2) ?? '—'
            }}</span>
            <span v-else-if="column.key === 'mjo_amplitude'" class="font-mono text-xs">{{
              asOni(row).mjo_amplitude?.toFixed(1) ?? '—'
            }}</span>
          </template>
        </DataTable>
      </GTabsContent>
    </GTabs>
  </div>
</template>
