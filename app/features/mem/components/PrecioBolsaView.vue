<template>
  <div class="space-y-5">
    <!-- Header -->
    <PageHeader title="Mercado de Energía" subtitle="Precios de bolsa XM + Pronóstico Clima">
      <template #lead>
        <Button text @click="$router.back()" class="-ml-2">
          <template #icon><ArrowLeftIcon class="size-[1em]" /></template>
        </Button>
        <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style="background:#915BD822">
          <ChartLineIcon class="text-sm size-[1em]" style="color:var(--color-unergy-purple)" />
        </div>
      </template>
    </PageHeader>

    <!-- Tabs -->
    <div class="flex gap-1 border-b border-gray-200">
      <button v-for="(tab, i) in TABS" :key="i"
        @click="activeTab = i"
        :class="[
          'px-4 py-2 text-sm font-medium transition-colors -mb-px',
          activeTab === i
            ? 'border-b-2 text-gray-800' : 'text-gray-400 hover:text-gray-600'
        ]"
        :style="activeTab === i ? 'border-color:var(--color-unergy-purple)' : ''">
        {{ tab }}
      </button>
    </div>

    <div v-if="loading" class="flex justify-center py-20">
      <ProgressSpinner />
    </div>

    <!-- ═══ TAB 0: Precios de Bolsa ═══ -->
    <template v-if="!loading && activeTab === 0">
      <div v-if="!spot" class="flex flex-col items-center py-12 gap-2 text-gray-400">
        <CloudDownloadIcon class="text-3xl size-[1em]" />
        <p class="text-sm">Sin datos de predespacho disponibles.</p>
      </div>

      <template v-else>
        <!-- KPI cards -->
        <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div v-for="kpi in spotKpis" :key="kpi.label"
            class="rounded-xl border p-3" :style="`border-color:${kpi.color}33; background:${kpi.color}08`">
            <p class="text-2xl font-bold" :style="`color:${kpi.color}`">{{ kpi.value }}</p>
            <p class="text-xs font-medium mt-0.5" :style="`color:${kpi.color}cc`">{{ kpi.label }}</p>
          </div>
        </div>

        <!-- Price chart (SVG) -->
        <div class="rounded-xl border border-gray-100 bg-white p-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-semibold text-gray-700 text-sm">Precio Bolsa por hora ($/kWh)</h3>
            <span class="text-xs text-gray-400">{{ spot.date }}</span>
          </div>
          <svg :viewBox="`0 0 ${chartW} ${chartH}`" class="w-full" style="max-height:260px"
            @mousemove="onChartMove" @mouseleave="hoverBar = null">
            <!-- Grid lines -->
            <line v-for="y in gridY" :key="'g'+y.val"
              :x1="padL" :x2="chartW - padR" :y1="y.py" :y2="y.py"
              stroke="#e5e7eb" stroke-width="0.5" />
            <text v-for="y in gridY" :key="'t'+y.val"
              :x="padL - 4" :y="y.py + 3" text-anchor="end"
              fill="#9ca3af" font-size="9">{{ y.label }}</text>

            <!-- Bars -->
            <rect v-for="(bar, i) in priceBars" :key="i"
              :x="bar.x" :y="bar.y" :width="bar.w" :height="bar.h"
              :fill="bar.peak ? 'var(--color-unergy-yellow)' : 'var(--color-unergy-purple)'" :opacity="hoverBar?.hour === bar.hour ? 1 : 0.85"
              rx="2" />

            <!-- Scarcity line -->
            <line v-if="spot.scarcity_price"
              :x1="padL" :x2="chartW - padR"
              :y1="priceToY(spot.scarcity_price)" :y2="priceToY(spot.scarcity_price)"
              stroke="#D64455" stroke-width="1" stroke-dasharray="4,3" />
            <text v-if="spot.scarcity_price"
              :x="chartW - padR + 2" :y="priceToY(spot.scarcity_price) + 3"
              fill="#D64455" font-size="8">P.Esc ${{ Math.round(spot.scarcity_price) }}</text>

            <!-- Hour labels -->
            <text v-for="h in 24" :key="'h'+h"
              :x="padL + (h - 0.5) * barStep" :y="chartH - 2"
              text-anchor="middle" fill="#9ca3af" font-size="8">{{ h }}</text>
          </svg>

          <!-- Tooltip -->
          <div v-if="hoverBar"
            class="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs pointer-events-none"
            :style="{ left: tooltipLeft + 'px', top: tooltipTop + 'px' }">
            <p class="font-semibold text-gray-800">Hora {{ hoverBar.hour }}</p>
            <p style="color:var(--color-unergy-purple)">${{ hoverBar.price.toFixed(2) }} /kWh</p>
            <p class="text-gray-400">{{ hoverBar.marginal }}</p>
          </div>
        </div>

        <!-- Generation table -->
        <div class="rounded-xl border border-gray-100 bg-white p-4">
          <h3 class="font-semibold text-gray-700 mb-3 text-sm">Generación por hora (MWh)</h3>
          <DataTable :value="genRows" size="small" stripedRows scrollable scrollHeight="400px"
            :paginator="false" class="text-sm">
            <Column field="hour" header="Hora" style="width:60px">
              <template #body="{ data }">
                <span class="font-mono text-xs font-semibold text-gray-700">{{ data.hour }}</span>
              </template>
            </Column>
            <Column header="Hidráulica" style="min-width:100px">
              <template #body="{ data }">
                <span class="text-blue-600 font-mono text-xs">{{ data.hidro.toLocaleString() }}</span>
              </template>
            </Column>
            <Column header="Térmica" style="min-width:100px">
              <template #body="{ data }">
                <span class="text-orange-600 font-mono text-xs">{{ data.termica.toLocaleString() }}</span>
              </template>
            </Column>
            <Column header="Renovable" style="min-width:100px">
              <template #body="{ data }">
                <span class="text-green-600 font-mono text-xs">{{ data.renovable.toLocaleString() }}</span>
              </template>
            </Column>
            <Column header="Menores" style="min-width:100px">
              <template #body="{ data }">
                <span class="font-mono text-xs" style="color:var(--color-unergy-purple)">{{ data.menor.toLocaleString() }}</span>
              </template>
            </Column>
            <Column header="Precio" style="min-width:90px">
              <template #body="{ data }">
                <span class="font-mono text-xs font-semibold" :class="data.price >= 900 ? 'text-red-600' : 'text-gray-700'">
                  ${{ data.price.toFixed(0) }}
                </span>
              </template>
            </Column>
            <Column header="Marginal" style="min-width:120px">
              <template #body="{ data }">
                <span class="text-xs text-gray-500">{{ data.marginal }}</span>
              </template>
            </Column>
          </DataTable>
        </div>
      </template>
    </template>

    <!-- ═══ TAB 1: Clima / Pronóstico ═══ -->
    <template v-if="!loading && activeTab === 1">
      <div v-if="!clima || !clima.models_available" class="flex flex-col items-center py-12 gap-2 text-gray-400">
        <CloudIcon class="text-3xl size-[1em]" />
        <p class="text-sm">Modelos de pronóstico no disponibles.</p>
        <p class="text-xs">Los endpoints están activos — ejecute el pipeline de entrenamiento.</p>
      </div>

      <template v-else>
        <!-- ENSO classification -->
        <div class="rounded-xl border border-gray-100 bg-white p-4" v-if="clima.enso">
          <h3 class="font-semibold text-gray-700 mb-2 text-sm">Clasificación ENSO</h3>
          <div class="flex items-center gap-4">
            <span class="text-lg font-bold" :class="ensoColor">{{ clima.enso.current_state || (Array.isArray(clima.enso.classification) ? clima.enso.classification[0] : clima.enso.classification) }}</span>
            <span class="text-sm text-gray-500">ONI: {{ clima.enso.latest_oni?.toFixed(2) ?? (Array.isArray(clima.enso.nino34_predicted) ? clima.enso.nino34_predicted[0]?.toFixed(2) : clima.enso.nino34_predicted?.toFixed(2)) }}</span>
          </div>
          <div v-if="clima.enso.probabilities" class="flex gap-3 mt-2">
            <span v-for="(prob, label) in clima.enso.probabilities" :key="label"
              class="text-xs text-gray-500">{{ label.replace('p_','') }}: {{ ((Array.isArray(prob) ? prob[0] : prob) * 100).toFixed(0) }}%</span>
          </div>
        </div>

        <!-- Trading signals -->
        <div class="rounded-xl border border-gray-100 bg-white p-4" v-if="clima.trading_signals?.length">
          <h3 class="font-semibold text-gray-700 mb-3 text-sm">Señales de Trading</h3>
          <DataTable :value="clima.trading_signals" size="small" stripedRows class="text-sm">
            <Column field="month" header="Mes" style="min-width:80px" />
            <Column header="Precio" style="min-width:100px">
              <template #body="{ data }">
                <span class="font-mono text-xs font-semibold">${{ data.price?.toFixed(0) }}</span>
              </template>
            </Column>
            <Column header="Dirección" style="min-width:110px">
              <template #body="{ data }">
                <span :class="[
                  'inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-0.5',
                  data.direction?.includes('COMPRAR') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                ]">
                  <ArrowDownIcon v-if="data.direction?.includes('COMPRAR')" class="text-[10px] size-[1em]" />
                  <ArrowUpIcon v-else class="text-[10px] size-[1em]" />
                  {{ data.direction }}
                </span>
              </template>
            </Column>
            <Column header="Riesgo" style="min-width:90px">
              <template #body="{ data }">
                <span :class="[
                  'text-xs font-medium rounded-full px-2 py-0.5',
                  data.risk_level === 'ALTO' ? 'bg-red-100 text-red-600' :
                  data.risk_level === 'MEDIO' ? 'bg-orange-100 text-orange-600' :
                  'bg-green-100 text-green-600'
                ]">
                  {{ data.risk_level }}
                </span>
              </template>
            </Column>
            <Column header="Régimen" style="min-width:100px">
              <template #body="{ data }">
                <span class="text-xs text-gray-500">{{ data.regime }} ({{ (data.regime_prob * 100).toFixed(0) }}%)</span>
              </template>
            </Column>
            <Column header="Margen" style="min-width:80px">
              <template #body="{ data }">
                <span class="font-mono text-xs" :class="data.margin > 0 ? 'text-green-600' : 'text-red-600'">
                  {{ data.margin > 0 ? '+' : '' }}${{ data.margin?.toFixed(0) }}
                </span>
              </template>
            </Column>
          </DataTable>
        </div>
      </template>
    </template>

    <!-- ═══ TAB 2: Histórico ═══ -->
    <template v-if="!loading && activeTab === 2">
      <div v-if="!histPrices.length" class="flex flex-col items-center py-12 gap-2 text-gray-400">
        <DatabaseIcon class="text-3xl size-[1em]" />
        <p class="text-sm">Sin datos históricos.</p>
      </div>

      <template v-else>
        <!-- Stats row -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div v-for="kpi in histKpis" :key="kpi.label"
            class="rounded-xl border p-3" :style="`border-color:${kpi.color}33; background:${kpi.color}08`">
            <p class="text-2xl font-bold" :style="`color:${kpi.color}`">{{ kpi.value }}</p>
            <p class="text-xs font-medium mt-0.5" :style="`color:${kpi.color}cc`">{{ kpi.label }}</p>
          </div>
        </div>

        <!-- Price + ONI SVG chart -->
        <div class="rounded-xl border border-gray-100 bg-white p-4">
          <h3 class="font-semibold text-gray-700 mb-3 text-sm">Precio Bolsa vs ONI ({{ histPrices.length }} meses)</h3>
          <svg :viewBox="`0 0 ${histChartW} ${histChartH}`" class="w-full" style="max-height:320px">
            <!-- Background ENSO bands -->
            <rect v-for="(band, i) in ensoBands" :key="'b'+i"
              :x="band.x" :y="10" :width="band.w" :height="histChartH - 30"
              :fill="band.color" opacity="0.12" />

            <!-- Price line -->
            <polyline :points="histPriceLine" fill="none" stroke="var(--color-unergy-purple)" stroke-width="1.5" />

            <!-- ONI line (secondary axis) -->
            <polyline :points="histOniLine" fill="none" stroke="#3B82F6" stroke-width="1" stroke-dasharray="4,2" />

            <!-- Zero line for ONI -->
            <line :x1="histPadL" :x2="histChartW - histPadR"
              :y1="oniToY(0)" :y2="oniToY(0)"
              stroke="#94a3b8" stroke-width="0.5" stroke-dasharray="2,2" />

            <!-- Year labels -->
            <template v-for="(yl, i) in histYearLabels" :key="'yl'+i">
              <text :x="yl.x" :y="histChartH - 2" text-anchor="middle" fill="#9ca3af" font-size="9">{{ yl.year }}</text>
            </template>

            <!-- Legend -->
            <line x1="10" x2="30" y1="6" y2="6" stroke="var(--color-unergy-purple)" stroke-width="2" />
            <text x="33" y="9" fill="var(--color-unergy-purple)" font-size="8">Precio COP/kWh</text>
            <line x1="140" x2="160" y1="6" y2="6" stroke="#3B82F6" stroke-width="1" stroke-dasharray="4,2" />
            <text x="163" y="9" fill="#3B82F6" font-size="8">ONI</text>
            <rect x="230" y="2" width="10" height="8" fill="#ef4444" opacity="0.2" />
            <text x="243" y="9" fill="#9ca3af" font-size="8">El Niño</text>
            <rect x="300" y="2" width="10" height="8" fill="#3b82f6" opacity="0.2" />
            <text x="313" y="9" fill="#9ca3af" font-size="8">La Niña</text>
          </svg>
        </div>

        <!-- Price by ENSO phase table -->
        <div class="rounded-xl border border-gray-100 bg-white p-4">
          <h3 class="font-semibold text-gray-700 mb-3 text-sm">Precio promedio por fase ENSO</h3>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div v-for="phase in ensoPhaseStats" :key="phase.label"
              class="rounded-lg p-4 text-center" :style="`background: ${phase.bg}`">
              <p class="text-lg font-bold" :style="`color: ${phase.color}`">{{ phase.label }}</p>
              <p class="text-2xl font-bold mt-1" style="color: var(--color-unergy-deep);">${{ phase.avgPrice }}</p>
              <p class="text-xs mt-1" style="color: #6b5a8a;">{{ phase.count }} meses · prom. COP/kWh</p>
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import { logger } from '~/core/logger'
import { EvoService } from '~/features/mem/services/evo'
import { ArrowDownIcon, ArrowLeftIcon, ArrowUpIcon, ChartLineIcon, CloudDownloadIcon, CloudIcon, DatabaseIcon } from '@lucide/vue'

const evoService = new EvoService()

const TABS = ['Precios de Bolsa', 'Clima / Pronóstico', 'Histórico']
const activeTab = ref(0)
const loading = ref(true)
const spot = ref(null)
const clima = ref(null)
const hoverBar = ref(null)
const tooltipLeft = ref(0)
const tooltipTop = ref(0)
const histPrices = ref([])
const histOni = ref([])

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
    if (pricesRes) histPrices.value = pricesRes.reverse()
    if (oniRes) histOni.value = oniRes.reverse()
  } catch (e) {
    logger.error('mem', e)
  } finally {
    loading.value = false
  }
})

const spotKpis = computed(() => {
  if (!spot.value?.summary) return []
  const s = spot.value.summary
  return [
    { label: 'Precio promedio', value: `$${s.price_avg?.toFixed(0)}`, color: '#915BD8' },
    { label: 'Precio máximo', value: `$${s.price_max?.toFixed(0)}`, color: '#D64455' },
    { label: 'Spread', value: `$${s.spread?.toFixed(0)}`, color: '#F0C040' },
    { label: 'Demanda', value: `${s.total_gwh?.toFixed(1)} GWh`, color: '#3B82F6' },
    { label: 'Hidráulica', value: `${s.hydro_pct}%`, color: '#10B981' },
  ]
})

const prices = computed(() => {
  if (!spot.value?.prices) return []
  return Object.entries(spot.value.prices)
    .map(([h, p]) => ({ hour: parseInt(h), price: p }))
    .sort((a, b) => a.hour - b.hour)
})

const priceMin = computed(() => prices.value.length ? Math.min(...prices.value.map(p => p.price)) * 0.9 : 0)
const priceMax = computed(() => {
  if (!prices.value.length) return 1000
  let mx = Math.max(...prices.value.map(p => p.price))
  if (spot.value?.scarcity_price) mx = Math.max(mx, spot.value.scarcity_price)
  return mx * 1.05
})

const barStep = computed(() => (chartW - padL - padR) / 24)

function priceToY(price) {
  const range = priceMax.value - priceMin.value
  if (range === 0) return padT
  return padT + (chartH - padT - padB) * (1 - (price - priceMin.value) / range)
}

const peakHour = computed(() => spot.value?.summary?.peak_hour || 20)

const priceBars = computed(() => {
  return prices.value.map((p, i) => ({
    x: padL + i * barStep.value + 2,
    y: priceToY(p.price),
    w: barStep.value - 4,
    h: Math.max(0, chartH - padB - priceToY(p.price)),
    hour: p.hour,
    price: p.price,
    peak: p.hour === peakHour.value,
    marginal: spot.value?.marginal_plants?.[String(p.hour)] || '',
  }))
})

const gridY = computed(() => {
  const steps = 5
  const range = priceMax.value - priceMin.value
  if (range === 0) return []
  return Array.from({ length: steps + 1 }, (_, i) => {
    const val = priceMin.value + (range * i) / steps
    return { val, py: priceToY(val), label: `$${Math.round(val)}` }
  })
})

function onChartMove(e) {
  const svg = e.currentTarget
  const rect = svg.getBoundingClientRect()
  const scaleX = chartW / rect.width
  const mouseX = (e.clientX - rect.left) * scaleX
  const idx = Math.floor((mouseX - padL) / barStep.value)
  if (idx >= 0 && idx < priceBars.value.length) {
    hoverBar.value = priceBars.value[idx]
    tooltipLeft.value = e.clientX + 12
    tooltipTop.value = e.clientY - 40
  } else {
    hoverBar.value = null
  }
}

const genRows = computed(() => {
  if (!spot.value?.generation) return []
  return Object.entries(spot.value.generation)
    .map(([h, gen]) => ({
      hour: parseInt(h),
      hidro: Math.round(gen.Hidraulica || gen.hidraulica || 0),
      termica: Math.round(gen.Termica || gen.termica || 0),
      renovable: Math.round(gen.Renovables || gen.renovables || 0),
      menor: Math.round(gen.Menores || gen.menores || 0),
      price: spot.value.prices?.[h] || 0,
      marginal: spot.value.marginal_plants?.[h] || '',
    }))
    .sort((a, b) => a.hour - b.hour)
})

const ensoColor = computed(() => {
  const enso = clima.value?.enso
  const c = enso?.current_state || (Array.isArray(enso?.classification) ? enso.classification[0] : enso?.classification) || ''
  if (c.includes('Niño')) return 'text-red-600'
  if (c.includes('Niña')) return 'text-blue-600'
  return 'text-gray-600'
})

// ─── Historical chart computations ──────────────────────
const histChartW = 800
const histChartH = 280
const histPadL = 55
const histPadR = 20

const histPriceRange = computed(() => {
  if (!histPrices.value.length) return { min: 0, max: 1000 }
  const vals = histPrices.value.map(p => Number(p.price_cop_kwh) || 0)
  return { min: Math.min(...vals) * 0.9, max: Math.max(...vals) * 1.05 }
})

function histPriceToY(price) {
  const { min, max } = histPriceRange.value
  const range = max - min || 1
  return 20 + (histChartH - 40) * (1 - (price - min) / range)
}

const oniRange = computed(() => {
  if (!histOni.value.length) return { min: -2, max: 2 }
  const vals = histOni.value.map(o => Number(o.oni_value) || 0)
  return { min: Math.min(...vals, -1.5), max: Math.max(...vals, 1.5) }
})

function oniToY(oni) {
  const { min, max } = oniRange.value
  const range = max - min || 1
  return 20 + (histChartH - 40) * (1 - (oni - min) / range)
}

const histPriceLine = computed(() => {
  const n = histPrices.value.length
  if (!n) return ''
  const step = (histChartW - histPadL - histPadR) / Math.max(n - 1, 1)
  return histPrices.value.map((p, i) => {
    const x = histPadL + i * step
    const y = histPriceToY(Number(p.price_cop_kwh) || 0)
    return `${x},${y}`
  }).join(' ')
})

const histOniLine = computed(() => {
  const n = histOni.value.length
  if (!n) return ''
  const step = (histChartW - histPadL - histPadR) / Math.max(n - 1, 1)
  return histOni.value.map((o, i) => {
    const x = histPadL + i * step
    const y = oniToY(Number(o.oni_value) || 0)
    return `${x},${y}`
  }).join(' ')
})

const ensoBands = computed(() => {
  const n = histOni.value.length
  if (!n) return []
  const step = (histChartW - histPadL - histPadR) / Math.max(n - 1, 1)
  const bands = []
  let start = null
  let phase = null
  for (let i = 0; i < n; i++) {
    const p = histOni.value[i].enso_phase
    if (p !== phase) {
      if (start !== null && phase && phase !== 'Neutral') {
        bands.push({
          x: histPadL + start * step,
          w: (i - start) * step,
          color: phase === 'El Niño' ? '#ef4444' : '#3b82f6',
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
      color: phase === 'El Niño' ? '#ef4444' : '#3b82f6',
    })
  }
  return bands
})

const histYearLabels = computed(() => {
  const n = histPrices.value.length
  if (!n) return []
  const step = (histChartW - histPadL - histPadR) / Math.max(n - 1, 1)
  const labels = []
  let lastYear = null
  for (let i = 0; i < n; i++) {
    const yr = histPrices.value[i].year
    if (yr !== lastYear && histPrices.value[i].month <= 2) {
      labels.push({ x: histPadL + i * step, year: yr })
      lastYear = yr
    }
  }
  return labels
})

const histKpis = computed(() => {
  const data = histPrices.value
  if (!data.length) return []
  const prices = data.map(p => Number(p.price_cop_kwh) || 0)
  const avg = prices.reduce((s, p) => s + p, 0) / prices.length
  const max = Math.max(...prices)
  const min = Math.min(...prices)
  const latest = prices[prices.length - 1]
  return [
    { label: 'Meses de datos', value: data.length, color: '#915BD8' },
    { label: 'Precio actual', value: `$${latest.toFixed(0)}`, color: '#2C2039' },
    { label: 'Prom. histórico', value: `$${avg.toFixed(0)}`, color: '#10B981' },
    { label: 'Máx. histórico', value: `$${max.toFixed(0)}`, color: '#D64455' },
  ]
})

const ensoPhaseStats = computed(() => {
  const data = histPrices.value
  if (!data.length) return []
  const groups = {}
  for (const p of data) {
    const phase = p.enso_phase || 'Neutral'
    if (!groups[phase]) groups[phase] = { prices: [], count: 0 }
    groups[phase].prices.push(Number(p.price_cop_kwh) || 0)
    groups[phase].count++
  }
  const phases = [
    { key: 'El Niño', label: 'El Niño', color: '#D64455', bg: 'rgba(214,68,85,0.08)' },
    { key: 'Neutral', label: 'Neutral', color: '#6b5a8a', bg: 'rgba(107,90,138,0.08)' },
    { key: 'La Niña', label: 'La Niña', color: '#3B82F6', bg: 'rgba(59,130,246,0.08)' },
  ]
  return phases.filter(p => groups[p.key]).map(p => {
    const g = groups[p.key]
    return {
      ...p,
      avgPrice: (g.prices.reduce((s, v) => s + v, 0) / g.count).toFixed(0),
      count: g.count,
    }
  })
})
</script>

<style scoped>
:deep(.p-datatable .p-datatable-thead th) {
  background: #faf9fb;
  color: #6b7280;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 0.5rem 0.75rem;
}
:deep(.p-datatable .p-datatable-tbody td) {
  padding: 0.4rem 0.75rem;
}
</style>
